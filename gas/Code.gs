// myDisiplin — kod pelayan Google Apps Script (SATU fail sahaja).
// Tampal KESELURUHAN fail ini ke dalam Code.gs dalam editor Apps Script, padam semua fail .gs lain,
// kemudian Deploy → Manage deployments → Edit → New version → Deploy.
// Bahagian: 1. Penghala (doPost/doGet)  2. Akaun & peranan  3. Murid  4. Gambar bukti  5. Uji sambungan

// ===================== 1. Penghala =====================

const DEFAULT_SHEET_ID = '1n3_wQUNOO1iW8mFc-etoncKfuda4Ce94pusKv6s2vRs';
const DEFAULT_TAB_NAME = 'Rekod kes baru';
const STUDENT_TAB_NAME = 'data';
// Tabs the app may read through sheet_table. The 'guru' tab (password hashes) is deliberately absent.
// The case tab is readable by Guru Disiplin, PK HEM and Pengetua only.
const READABLE_TABS = [STUDENT_TAB_NAME, DEFAULT_TAB_NAME];
const STAFF_ONLY_TABS = [DEFAULT_TAB_NAME];
const CASE_HEADERS = ['id', 'no_kp', 'tarikh', 'masa', 'nama', 'kelas', 'jenis_kesalahan', 'kategori', 'catatan', 'status', 'dicipta_pada', 'dicipta_oleh', 'bukti'];

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || '').toLowerCase();

    // Public actions: everything else needs a valid session.
    if (action === 'register') return jsonResponse_(registerGuru_(payload));
    if (action === 'login') return jsonResponse_(loginGuru_(payload));
    if (action === 'logout') return jsonResponse_(logoutGuru_(payload));

    const user = requireSession_(payload);

    // --- Every role (Guru included): what is needed to record a case ---
    if (action === 'whoami') return jsonResponse_(whoAmI_(user));
    if (action === 'student_list') return jsonResponse_({ ok: true, students: studentList_() });
    if (action === 'late_count') return jsonResponse_({ ok: true, count: lateCount_(payload.noKp) });
    if (action === 'sheet_table') {
      if (STAFF_ONLY_TABS.indexOf(String(payload.tab || '')) >= 0) requireStaff_(user);
      return jsonResponse_(readTable_(payload.tab));
    }
    if (action === 'append') return jsonResponse_(appendCase_(payload, user));

    // --- Guru Disiplin, PK HEM and Pengetua only ---
    requireStaff_(user);
    if (action === 'student_cases') return jsonResponse_(studentCases_(payload.noKp));
    if (action === 'case_evidence') return jsonResponse_(caseEvidence_(payload.rowNumber));
    if (action === 'update_status') return jsonResponse_(updateStatus_(payload));
    throw new Error('Tindakan tidak sah.');
  } catch (error) {
    return jsonResponse_({ ok: false, error: mesejRalat_(error), code: error.code || '' });
  }
}

// Our own errors are already in Malay. System errors from JavaScript or Google services are in
// English, so they are translated here, with what to do about them.
function mesejRalat_(error) {
  var text = String((error && error.message) || error || '');
  var missing = text.match(/^([\w$]+) is not defined/);
  if (missing) {
    return 'Ralat pelayan: fungsi "' + missing[1] + '" tidak ditemui. Fail Apps Script belum lengkap: salin semua fail ' +
      'daripada folder gas/ (Code.gs, Auth.gs, Students.gs, Evidence.gs, Diagnostik.gs), kemudian deploy versi baharu.';
  }
  if (/permission|authoriz|izin|kebenaran/i.test(text)) {
    return 'Ralat pelayan: Apps Script belum diberi kebenaran ke Google Sheet atau Drive. Pemilik skrip perlu jalankan ' +
      'fungsi ujiSambungan sekali dalam editor dan benarkan akses.';
  }
  if (/lock/i.test(text) && /timeout|wait/i.test(text)) {
    return 'Ramai pengguna menyimpan serentak. Cuba lagi sebentar.';
  }
  if (/too many times|Exceeded maximum|timed out|timeout|Service unavailable|try again/i.test(text)) {
    return 'Pelayan sibuk atau melebihi had Google. Cuba lagi sebentar.';
  }
  if (/not found|tidak ditemui|No item with the given ID|does not exist/i.test(text) && !/tidak ditemui/.test(text)) {
    return 'Ralat pelayan: Google Sheet, tab atau fail Drive tidak ditemui. Semak ID sheet dan nama tab.';
  }
  if (error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError || error instanceof SyntaxError) {
    return 'Ralat pelayan (' + text + '). Laporkan kepada pentadbir sistem.';
  }
  return text || 'Ralat pelayan yang tidak diketahui.';
}

// Version of the server code. Opening the web app URL in a browser shows it, together with a check that
// every part of the code is present, so a half-pasted or not-yet-deployed script is easy to spot.
var VERSI_PELAYAN = '2026-11-18.1';
var FUNGSI_WAJIB = ['registerGuru_', 'loginGuru_', 'requireSession_', 'studentList_', 'lateCount_', 'studentCases_',
  'validateEvidence_', 'saveEvidence_', 'caseEvidence_', 'ujiSambungan'];

function doGet() {
  var tiada = FUNGSI_WAJIB.filter(function (name) { return typeof globalThis[name] !== 'function'; });
  return jsonResponse_({
    ok: tiada.length === 0,
    message: tiada.length ? 'Kod Apps Script TIDAK lengkap.' : 'GAS Web App aktif. Gunakan POST.',
    versi: VERSI_PELAYAN,
    tiada: tiada
  });
}

// The target sheet is fixed on the server; clients cannot choose another spreadsheet or tab.
function caseSheet_() {
  const spreadsheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID);
  let sheet = spreadsheet.getSheetByName(DEFAULT_TAB_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(DEFAULT_TAB_NAME);
  ensureHeader_(sheet);
  return sheet;
}

function appendCase_(payload, user) {
  // Validate the evidence photos before writing anything, so a bad photo never leaves a half-saved case.
  const photos = validateEvidence_(payload.bukti);
  const sheet = caseSheet_();
  const now = new Date();
  const id = payload.id || payload.noKp || String(now.getTime());
  const fileIds = saveEvidence_(photos, id);
  sheet.appendRow([
    id,
    payload.noKp || '',
    payload.tarikh || '',
    payload.masa || '',
    payload.nama || '',
    payload.kelas || '',
    payload.jenisKesalahan || payload.jeniskesalahan || payload.jenis_kesalahan || '',
    payload.kategori || '',
    payload.catatan || '',
    payload.status || 'Dalam Semakan',
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    user.username,
    fileIds.join(',')
  ]);
  return { ok: true, tab: DEFAULT_TAB_NAME, bukti: fileIds.length };
}

function updateStatus_(payload) {
  const sheet = caseSheet_();
  const rowNumber = Number(payload.rowNumber || 0);
  const statusValue = payload.status || 'Dalam Semakan';
  if (!rowNumber || rowNumber < 2) throw new Error('rowNumber tidak sah.');
  const statusCol = findColumn_(sheet, 'status');
  if (!statusCol) throw new Error('Kolum status tidak ditemui.');
  sheet.getRange(rowNumber, statusCol).setValue(statusValue);
  return { ok: true, action: 'update_status', rowNumber: rowNumber, status: statusValue };
}

// Header labels plus display values, from row 2 onward (row index + 2 is the sheet row number).
function readTable_(tab) {
  const name = String(tab || '');
  if (READABLE_TABS.indexOf(name) < 0) throw new Error('Tab tidak dibenarkan.');
  const sheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID).getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 1) return { ok: true, headers: [], rows: [] };
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(function (h) { return String(h); });
  return { ok: true, headers: headers, rows: values };
}

function parsePayload_(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch (jsonError) {
    const params = body.split('&').reduce(function (acc, pair) {
      const parts = pair.split('=');
      if (!parts.length) return acc;
      const key = decodeURIComponent(parts[0] || '');
      const val = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
      if (key) acc[key] = val;
      return acc;
    }, {});
    return params;
  }
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CASE_HEADERS);
    return;
  }
  // Older sheets lack the newer columns; add them once, in order, at the end.
  let lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  ['dicipta_oleh', 'bukti'].forEach(function (name) {
    if (headers.indexOf(name) < 0) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(name);
      headers.push(name);
    }
  });
}

// 1-based column number of a header (case-insensitive), or 0.
function findColumn_(sheet, name) {
  const lastCol = sheet.getLastColumn();
  if (!lastCol) return 0;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === name) return i + 1;
  }
  return 0;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== 2. Akaun & peranan =====================

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

// ===================== 3. Murid =====================

// Student roster and per-student case history. No student photos are stored.

// Roster from the 'data' tab: [{nama, kelas, noKp}]. Any signed-in role (used to pick a student when recording).
function studentList_() {
  var sheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID).getSheetByName(STUDENT_TAB_NAME);
  if (!sheet) throw new Error('Tab data tidak ditemui.');
  var rows = sheet.getDataRange().getDisplayValues();
  var headers = rows.shift().map(function (h) { return String(h).toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  var n = headers.indexOf('NAMA'), k = headers.indexOf('KELAS'), id = headers.indexOf('NOKADPENGENALAN');
  if (n < 0 || k < 0 || id < 0) throw new Error('Kolum NAMA, KELAS dan NO. KAD PENGENALAN diperlukan.');
  return rows.filter(function (r) { return r[n] && r[k] && r[id]; }).map(function (r) {
    return { nama: r[n].trim(), kelas: r[k].trim(), noKp: icKey_(r[id]) };
  });
}

function icKey_(value) {
  return String(value || '').replace(/[^0-9]/g, '').padStart(12, '0');
}

// Rows of the case tab as objects keyed by normalised header (e.g. 'nokp', 'jeniskesalahan').
function caseRows_() {
  var sheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID).getSheetByName(DEFAULT_TAB_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getDataRange().getDisplayValues();
  var headers = rows.shift().map(function (h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); });
  return rows.map(function (r) {
    var o = {};
    headers.forEach(function (h, i) { if (h && !(h in o)) o[h] = String(r[i] == null ? '' : r[i]).trim(); });
    return o;
  });
}

// How many lateness cases a student already has. Lets a Guru grade lateness without reading other cases.
var LATE_TYPE = 'TINGKAH LAKU TIDAK PENTINGKAN MASA';
function lateCount_(noKp) {
  var digits = String(noKp || '').replace(/[^0-9]/g, '');
  if (!digits) return 0;
  var key = icKey_(digits);
  return caseRows_().filter(function (c) {
    return c.nokp && icKey_(c.nokp) === key && String(c.jeniskesalahan || '').toUpperCase() === LATE_TYPE;
  }).length;
}

// Profile: the student plus their discipline records. Guru Disiplin, PK HEM and Pengetua only.
function studentCases_(noKp) {
  var key = icKey_(noKp);
  var student = studentList_().filter(function (s) { return s.noKp === key; })[0];
  if (!student) throw new Error('Murid tidak ditemui dalam tab data.');
  var cases = caseRows_().filter(function (c) { return c.nokp && icKey_(c.nokp) === key; }).map(function (c) {
    return {
      tarikh: c.tarikh || '', masa: c.masa || '', jenis: c.jeniskesalahan || '', kategori: c.kategori || '',
      catatan: c.catatan || '', status: c.status || '', bukti: c.bukti ? c.bukti.split(',').length : 0
    };
  });
  return { ok: true, student: student, cases: cases };
}

// ===================== 4. Gambar bukti =====================

// Evidence photos (gambar bukti) attached to a case. Stored as private files in one Drive folder;
// the case row keeps their file IDs in the 'bukti' column.
var MAX_EVIDENCE = 3;
var MAX_EVIDENCE_CHARS = 400000; // data URI length, about 300 KB of JPEG

// Returns decoded JPEG byte arrays, or throws before anything is saved.
function validateEvidence_(list) {
  if (list == null || list === '') return [];
  if (!Array.isArray(list)) throw new Error('Format gambar bukti tidak sah.');
  if (list.length > MAX_EVIDENCE) throw new Error('Maksimum ' + MAX_EVIDENCE + ' gambar bukti bagi setiap kes.');
  return list.map(function (data) {
    data = String(data || '');
    if (data.length > MAX_EVIDENCE_CHARS || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)) {
      throw new Error('Format atau saiz gambar bukti tidak sah.');
    }
    var bytes = Utilities.base64Decode(data.split(',')[1]);
    if (bytes.length < 4 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216) throw new Error('Fail JPEG gambar bukti tidak sah.');
    return bytes;
  });
}

function evidenceFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('EVIDENCE_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);
  var folder = DriveApp.createFolder('myDisiplin Bukti Kes');
  props.setProperty('EVIDENCE_FOLDER_ID', folder.getId());
  return folder;
}

function saveEvidence_(photos, caseId) {
  if (!photos.length) return [];
  var folder = evidenceFolder_();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var safeId = String(caseId).replace(/[^0-9A-Za-z]/g, '').slice(0, 20);
  return photos.map(function (bytes, i) {
    var name = safeId + '_' + stamp + '_' + (i + 1) + '.jpg';
    return folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', name)).getId();
  });
}

// Evidence for one case row, as data URIs. Only files inside the evidence folder are returned,
// so an ID typed into the sheet by hand cannot be used to read other Drive files.
function caseEvidence_(rowNumber) {
  rowNumber = Number(rowNumber || 0);
  var sheet = caseSheet_();
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('rowNumber tidak sah.');
  var col = findColumn_(sheet, 'bukti');
  var raw = col ? String(sheet.getRange(rowNumber, col).getValues()[0][0] || '') : '';
  var ids = raw.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^[A-Za-z0-9_-]{10,}$/.test(s); });
  var folderId = PropertiesService.getScriptProperties().getProperty('EVIDENCE_FOLDER_ID');
  var photos = [];
  ids.slice(0, MAX_EVIDENCE).forEach(function (id) {
    try {
      var file = DriveApp.getFileById(id);
      var parents = file.getParents(), inFolder = false;
      while (parents.hasNext()) { if (parents.next().getId() === folderId) inFolder = true; }
      if (inFolder) photos.push('data:image/jpeg;base64,' + Utilities.base64Encode(file.getBlob().getBytes()));
    } catch (e) { /* File deleted or not accessible: skip it. */ }
  });
  return { ok: true, photos: photos };
}

// ===================== 5. Uji sambungan =====================

// Connection test. In the Apps Script editor choose "ujiSambungan" and press Run, then open the
// Execution log. It only reads, except for creating the evidence folder in Drive if it is missing.
function ujiSambungan() {
  var lines = [];
  var ok = true;
  function lulus(text) { lines.push('LULUS  ' + text); }
  function gagal(text) { lines.push('GAGAL  ' + text); ok = false; }

  // 1. Spreadsheet
  var ss;
  try {
    ss = SpreadsheetApp.openById(DEFAULT_SHEET_ID);
    lulus('Google Sheet dibuka: "' + ss.getName() + '"');
  } catch (e) {
    gagal('Google Sheet tidak dapat dibuka: ' + e.message);
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  // 2. Tabs and headers
  function semakTab(name, wanted) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) { gagal('Tab "' + name + '" tidak ditemui'); return; }
    var lastCol = sheet.getLastColumn();
    var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }) : [];
    var missing = wanted.filter(function (h) { return headers.indexOf(h.replace(/[^a-z0-9]/g, '')) < 0; });
    var rows = Math.max(0, sheet.getLastRow() - 1);
    if (missing.length) gagal('Tab "' + sheet.getName() + '" (' + rows + ' baris): header tiada: ' + missing.join(', '));
    else lulus('Tab "' + sheet.getName() + '": ' + rows + ' baris data, header lengkap');
  }
  semakTab(STUDENT_TAB_NAME, ['nama', 'kelas', 'no kad pengenalan']);
  semakTab(DEFAULT_TAB_NAME, ['no_kp', 'nama', 'kelas', 'jenis_kesalahan', 'kategori', 'status', 'dicipta_oleh', 'bukti']);
  semakTab(GURU_TAB, ['username', 'nama', 'salt', 'hash', 'status', 'peranan']);

  // 3. The functions the app uses
  try { lulus('Senarai murid (student_list): ' + studentList_().length + ' murid'); }
  catch (e) { gagal('Senarai murid: ' + e.message); }
  try { lulus('Bacaan rekod kes (late_count) berfungsi: ' + caseRows_().length + ' kes dibaca'); }
  catch (e) { gagal('Bacaan rekod kes: ' + e.message); }

  // 4. Accounts and roles
  try {
    var rows = guruSheet_().getDataRange().getValues().slice(1);
    var count = {};
    rows.forEach(function (r) { var role = normalizeRole_(r[7]) || DEFAULT_ROLE + ' (kosong)'; count[role] = (count[role] || 0) + 1; });
    lulus('Akaun: ' + rows.length + ' — ' + Object.keys(count).map(function (k) { return k + ': ' + count[k]; }).join(', '));
    if (!rows.some(function (r) { return isStaffRole_(normalizeRole_(r[7])) && String(r[4]).toLowerCase() === STATUS_ACTIVE; })) {
      gagal('Tiada akaun aktif Guru Disiplin / PK HEM / Pengetua. Isi lajur "peranan" dalam tab guru.');
    }
    var pending = rows.filter(function (r) { return String(r[4]).toLowerCase() === STATUS_PENDING; });
    if (pending.length) {
      lines.push('INFO   ' + pending.length + ' akaun menunggu kelulusan (tukar status kepada "aktif" untuk lulus): ' +
        pending.map(function (r) { return r[0] + ' (' + (normalizeRole_(r[7]) || DEFAULT_ROLE) + ')'; }).join(', '));
    }
  } catch (e) { gagal('Tab guru: ' + e.message); }

  // 5. Drive folder for evidence photos
  try { lulus('Folder Drive gambar bukti: "' + evidenceFolder_().getName() + '"'); }
  catch (e) { gagal('Folder Drive gambar bukti: ' + e.message); }

  lines.push(ok ? '\nSEMUA LULUS: sambungan ke Google Sheet dan Drive berfungsi.' : '\nADA YANG GAGAL: lihat baris GAGAL di atas.');
  Logger.log(lines.join('\n'));
  return lines.join('\n');
}
