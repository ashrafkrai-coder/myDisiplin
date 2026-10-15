// Teacher accounts: self-registration (school registration code), login and server-side sessions.
// Accounts live in the 'guru' tab; sessions live in CacheService so they expire on their own.
var GURU_TAB = 'guru';
var SESSION_SECONDS = 21600;
var HASH_ROUNDS = 1000;
var MAX_FAILS = 5;
var FAIL_WINDOW_SECONDS = 900;

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
    sheet.appendRow(['username', 'nama', 'salt', 'hash', 'status', 'dicipta_pada', 'login_terakhir']);
  }
  return sheet;
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
      return { row: i + 1, username: username, nama: String(rows[i][1]), salt: String(rows[i][2]), hash: String(rows[i][3]), status: String(rows[i][4]).toLowerCase() };
    }
  }
  return null;
}

function newSession_(username, nama) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({ u: username, n: nama }), SESSION_SECONDS);
  return { session: token, username: username, nama: nama, expiresIn: SESSION_SECONDS };
}

function registerGuru_(payload) {
  var props = PropertiesService.getScriptProperties();
  var code = props.getProperty('REGISTER_CODE');
  if (!code || code.length < 8) {
    throw authError_('Pendaftaran belum dibuka. Pentadbir perlu tetapkan REGISTER_CODE (sekurang-kurangnya 8 aksara) dalam Script Properties.');
  }
  if (failCount_('regfail') >= 20) throw authError_('Terlalu banyak percubaan. Cuba lagi dalam 15 minit.');
  if (!safeEqual_(payload.kodDaftar || '', code)) {
    addFail_('regfail');
    throw authError_('Kod pendaftaran tidak sah.');
  }

  var username = normalizeUsername_(payload.username);
  var nama = String(payload.nama || '').replace(/[\u0000-\u001f]/g, '').trim();
  var password = String(payload.password || '');
  if (!/^[a-z0-9._]{3,30}$/.test(username)) throw authError_('Username 3-30 aksara: huruf kecil, nombor, titik atau garis bawah sahaja.');
  if (nama.length < 3 || nama.length > 80) throw authError_('Nama penuh mesti 3-80 aksara.');
  if (password.length < 8 || password.length > 72) throw authError_('Kata laluan mesti 8-72 aksara.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = guruSheet_();
    if (findGuru_(sheet, username)) throw authError_('Username sudah digunakan. Pilih username lain.');
    var salt = Utilities.getUuid();
    sheet.appendRow([username, nama, salt, hashPassword_(salt, password), 'aktif',
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), '']);
  } finally {
    lock.releaseLock();
  }
  return Object.assign({ ok: true }, newSession_(username, nama));
}

function loginGuru_(payload) {
  var username = normalizeUsername_(payload.username);
  var failKey = 'fail_' + username;
  if (failCount_(failKey) >= MAX_FAILS) throw authError_('Terlalu banyak percubaan gagal. Cuba lagi dalam 15 minit.');

  var invalid = 'Username atau kata laluan tidak sah.';
  var sheet = guruSheet_();
  var guru = /^[a-z0-9._]{3,30}$/.test(username) ? findGuru_(sheet, username) : null;
  // Hash even for unknown users so response time does not reveal which usernames exist.
  var candidate = hashPassword_(guru ? guru.salt : 'x', String(payload.password || ''));
  if (!guru || !safeEqual_(candidate, guru.hash)) {
    addFail_(failKey);
    throw authError_(invalid);
  }
  if (guru.status !== 'aktif') throw authError_('Akaun ini tidak aktif. Hubungi pentadbir.');

  CacheService.getScriptCache().remove(failKey);
  sheet.getRange(guru.row, 7).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
  return Object.assign({ ok: true }, newSession_(guru.username, guru.nama));
}

// Returns {username, nama} for a valid session, otherwise throws a SESSION error.
function requireSession_(payload) {
  var expired = 'Sesi tamat. Sila log masuk semula.';
  var token = String((payload && payload.session) || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw authError_(expired, 'SESSION');
  var cache = CacheService.getScriptCache();
  var raw = cache.get('sess_' + token);
  if (!raw) throw authError_(expired, 'SESSION');
  var info = JSON.parse(raw);

  // Re-check the account is still active every 5 minutes, so disabling a teacher takes effect quickly.
  var activeKey = 'act_' + info.u;
  if (!cache.get(activeKey)) {
    var guru = findGuru_(guruSheet_(), info.u);
    if (!guru || guru.status !== 'aktif') {
      cache.remove('sess_' + token);
      throw authError_(expired, 'SESSION');
    }
    cache.put(activeKey, '1', 300);
  }
  return { username: info.u, nama: info.n };
}

function logoutGuru_(payload) {
  var token = String((payload && payload.session) || '');
  if (/^[a-f0-9]{64}$/.test(token)) CacheService.getScriptCache().remove('sess_' + token);
  return { ok: true };
}
