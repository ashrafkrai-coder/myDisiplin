// Staff accounts: self-registration (no code), admin approval for senior roles, login, roles and sessions.
// Accounts live in the 'guru' tab; sessions live in CacheService so they expire on their own.
var GURU_TAB = 'guru';
var GURU_HEADERS = ['username', 'nama', 'salt', 'hash', 'status', 'dicipta_pada', 'login_terakhir', 'peranan'];
var SESSION_SECONDS = 21600;
var HASH_ROUNDS = 1000;
var MAX_FAILS = 5;
var FAIL_WINDOW_SECONDS = 900;

// Roles. 'Guru' may only record new cases and is active as soon as it registers. The other roles also
// see case lists, the dashboard and student profiles, so their accounts start as 'menunggu' (pending)
// until an admin sets the status to 'aktif' in the 'guru' tab.
var ROLES = ['Guru', 'Guru Disiplin', 'PK HEM', 'Pengetua'];
var DEFAULT_ROLE = 'Guru';
var STAFF_ROLES = ['Guru Disiplin', 'PK HEM', 'Pengetua'];
var STATUS_ACTIVE = 'aktif';
var STATUS_PENDING = 'menunggu';
// Registration is open, so cap it to slow down automated sign-ups.
var MAX_REGISTRATIONS_PER_HOUR = 30;

function authError_(message, code) {
  var error = new Error(message);
  if (code) error.code = code;
  return error;
}

function guruSheet_() {
  var spreadsheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID);
  var sheet = spreadsheet.getSheetByName(GURU_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(GURU_TAB);
    sheet.appendRow(GURU_HEADERS);
  } else if (sheet.getLastColumn() < GURU_HEADERS.length) {
    // Older tabs have no 'peranan' column; accounts without a role count as 'Guru'.
    sheet.getRange(1, GURU_HEADERS.length).setValue('peranan');
  }
  return sheet;
}

// Maps any spelling of a role ('pk hem', 'PKHEM', 'guru disiplin') to its canonical name, or ''.
function normalizeRole_(value) {
  var wanted = String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
  for (var i = 0; i < ROLES.length; i++) {
    if (ROLES[i].toUpperCase().replace(/[^A-Z]/g, '') === wanted) return ROLES[i];
  }
  return '';
}

function isStaffRole_(role) {
  return STAFF_ROLES.indexOf(role) >= 0;
}

function toHex_(bytes) {
  return bytes.map(function (b) { return ('0' + ((b & 255).toString(16))).slice(-2); }).join('');
}

function hashPassword_(salt, password) {
  var saltBytes = Utilities.newBlob(salt).getBytes();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password);
  for (var i = 0; i < HASH_ROUNDS; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest.concat(saltBytes));
  }
  return toHex_(digest);
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function normalizeUsername_(value) {
  return String(value || '').trim().toLowerCase();
}

function failCount_(key) {
  return Number(CacheService.getScriptCache().get(key) || 0);
}

function addFail_(key) {
  CacheService.getScriptCache().put(key, String(failCount_(key) + 1), FAIL_WINDOW_SECONDS);
}

function findGuru_(sheet, username) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normalizeUsername_(rows[i][0]) === username) {
      return {
        row: i + 1, username: username, nama: String(rows[i][1]), salt: String(rows[i][2]), hash: String(rows[i][3]),
        status: String(rows[i][4]).toLowerCase(), peranan: normalizeRole_(rows[i][7]) || DEFAULT_ROLE
      };
    }
  }
  return null;
}

function newSession_(username, nama, peranan) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({ u: username, n: nama }), SESSION_SECONDS);
  return { session: token, username: username, nama: nama, peranan: peranan, expiresIn: SESSION_SECONDS };
}

function registerGuru_(payload) {
  var peranan = normalizeRole_(payload.peranan);
  if (!peranan) throw authError_('Pilih peranan: ' + ROLES.join(', ') + '.');
  var staff = isStaffRole_(peranan);

  var username = normalizeUsername_(payload.username);
  var nama = String(payload.nama || '').replace(/[\u0000-\u001f]/g, '').trim();
  var password = String(payload.password || '');
  if (!/^[a-z0-9._]{3,30}$/.test(username)) throw authError_('Nama pengguna 3-30 aksara: huruf kecil, nombor, titik atau garis bawah sahaja.');
  if (nama.length < 3 || nama.length > 80) throw authError_('Nama penuh mesti 3-80 aksara.');
  if (password.length < 8 || password.length > 72) throw authError_('Kata laluan mesti 8-72 aksara.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = guruSheet_();
    if (findGuru_(sheet, username)) throw authError_('Nama pengguna sudah digunakan. Pilih nama pengguna lain.');
    var cache = CacheService.getScriptCache();
    var hourKey = 'reg_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHH');
    var made = Number(cache.get(hourKey) || 0);
    if (made >= MAX_REGISTRATIONS_PER_HOUR) throw authError_('Terlalu banyak pendaftaran baharu. Cuba lagi dalam sejam.');
    cache.put(hourKey, String(made + 1), 3600);
    var salt = Utilities.getUuid();
    sheet.appendRow([username, nama, salt, hashPassword_(salt, password), staff ? STATUS_PENDING : STATUS_ACTIVE,
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), '', peranan]);
  } finally {
    lock.releaseLock();
  }
  // Senior roles get no session until an admin approves them.
  if (staff) {
    return { ok: true, pending: true, username: username, peranan: peranan,
      message: 'Akaun ' + peranan + ' telah didaftarkan dan menunggu kelulusan pentadbir. Anda boleh log masuk selepas diluluskan.' };
  }
  return Object.assign({ ok: true }, newSession_(username, nama, peranan));
}

function loginGuru_(payload) {
  var username = normalizeUsername_(payload.username);
  var failKey = 'fail_' + username;
  if (failCount_(failKey) >= MAX_FAILS) throw authError_('Terlalu banyak percubaan gagal. Cuba lagi dalam 15 minit.');

  var invalid = 'Nama pengguna atau kata laluan tidak sah.';
  var sheet = guruSheet_();
  var guru = /^[a-z0-9._]{3,30}$/.test(username) ? findGuru_(sheet, username) : null;
  // Hash even for unknown users so response time does not reveal which usernames exist.
  var candidate = hashPassword_(guru ? guru.salt : 'x', String(payload.password || ''));
  if (!guru || !safeEqual_(candidate, guru.hash)) {
    addFail_(failKey);
    throw authError_(invalid);
  }
  var chosen = normalizeRole_(payload.peranan);
  if (payload.peranan && chosen !== guru.peranan) {
    throw authError_('Peranan tidak sepadan. Akaun ini berdaftar sebagai ' + guru.peranan + '.');
  }
  if (guru.status === STATUS_PENDING) throw authError_('Akaun ' + guru.peranan + ' anda masih menunggu kelulusan pentadbir.');
  if (guru.status !== STATUS_ACTIVE) throw authError_('Akaun ini tidak aktif. Hubungi pentadbir.');

  var cache = CacheService.getScriptCache();
  cache.remove(failKey);
  cache.remove('role_' + guru.username);
  sheet.getRange(guru.row, 7).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
  return Object.assign({ ok: true }, newSession_(guru.username, guru.nama, guru.peranan));
}

// Returns {username, nama, peranan} for a valid session, otherwise throws a SESSION error.
function requireSession_(payload) {
  var expired = 'Sesi tamat. Sila log masuk semula.';
  var token = String((payload && payload.session) || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw authError_(expired, 'SESSION');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess_' + token);
  if (!raw) throw authError_(expired, 'SESSION');
  var info = JSON.parse(raw);

  // Role and active status are re-read from the sheet every 5 minutes, so disabling an account
  // or changing a role in the 'guru' tab takes effect without a new login.
  var roleKey = 'role_' + info.u;
  var role = cache.get(roleKey);
  if (!role) {
    var guru = findGuru_(guruSheet_(), info.u);
    if (!guru || guru.status !== STATUS_ACTIVE) {
      cache.remove('sess_' + token);
      throw authError_(expired, 'SESSION');
    }
    role = guru.peranan;
    cache.put(roleKey, role, 300);
  }
  return { username: info.u, nama: info.n, peranan: normalizeRole_(role) || DEFAULT_ROLE };
}

// Guru Disiplin, PK HEM and Pengetua only.
function requireStaff_(user) {
  if (!isStaffRole_(user.peranan)) {
    throw authError_('Akses ini hanya untuk ' + STAFF_ROLES.join(', ') + '. Guru hanya boleh merekod kes.', 'ROLE');
  }
}

// Lets the app refresh the name and role it shows (e.g. after an admin changes a role in the sheet).
function whoAmI_(user) {
  return { ok: true, username: user.username, nama: user.nama, peranan: user.peranan };
}

function logoutGuru_(payload) {
  var token = String((payload && payload.session) || '');
  if (/^[a-f0-9]{64}$/.test(token)) CacheService.getScriptCache().remove('sess_' + token);
  return { ok: true };
}
