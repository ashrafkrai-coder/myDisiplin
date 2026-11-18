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

function doGet() {
  return jsonResponse_({ ok: true, message: 'GAS Web App aktif. Gunakan POST.' });
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
