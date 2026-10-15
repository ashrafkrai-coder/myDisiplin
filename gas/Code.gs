const DEFAULT_SHEET_ID = '1n3_wQUNOO1iW8mFc-etoncKfuda4Ce94pusKv6s2vRs';
const DEFAULT_TAB_NAME = 'Rekod kes baru';
const STUDENT_TAB_NAME = 'data';
// Tabs the app may read through sheet_table. The 'guru' tab (password hashes) is deliberately absent.
const READABLE_TABS = [STUDENT_TAB_NAME, DEFAULT_TAB_NAME];
const CASE_HEADERS = ['id', 'no_kp', 'tarikh', 'masa', 'nama', 'kelas', 'jenis_kesalahan', 'kategori', 'catatan', 'status', 'dicipta_pada', 'dicipta_oleh'];

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || '').toLowerCase();

    // Public actions: everything else needs a valid teacher session.
    if (action === 'register') return jsonResponse_(registerGuru_(payload));
    if (action === 'login') return jsonResponse_(loginGuru_(payload));
    if (action === 'logout') return jsonResponse_(logoutGuru_(payload));

    const user = requireSession_(payload);

    if (action.indexOf('photo_') === 0) {
      return jsonResponse_(handlePhotoAction_(payload));
    }
    if (action === 'sheet_table') {
      return jsonResponse_(readTable_(payload.tab));
    }

    // The target sheet is fixed on the server; clients cannot choose another spreadsheet or tab.
    const spreadsheet = SpreadsheetApp.openById(DEFAULT_SHEET_ID);
    let sheet = spreadsheet.getSheetByName(DEFAULT_TAB_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(DEFAULT_TAB_NAME);

    if (action === 'update_status') {
      ensureHeader_(sheet);
      const rowNumber = Number(payload.rowNumber || 0);
      const statusValue = payload.status || 'Dalam Semakan';
      if (!rowNumber || rowNumber < 2) {
        return jsonResponse_({ ok: false, error: 'rowNumber tidak sah.' });
      }

      const statusCol = findStatusColumn_(sheet);
      if (!statusCol) {
        return jsonResponse_({ ok: false, error: 'Kolum status tidak ditemui.' });
      }

      sheet.getRange(rowNumber, statusCol).setValue(statusValue);
      return jsonResponse_({ ok: true, action: 'update_status', rowNumber: rowNumber, status: statusValue });
    }

    if (action !== 'append') throw new Error('Tindakan tidak sah.');
    ensureHeader_(sheet);

    const now = new Date();
    sheet.appendRow([
      payload.id || payload.noKp || String(now.getTime()),
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
      user.username
    ]);

    return jsonResponse_({ ok: true, tab: DEFAULT_TAB_NAME });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || String(error), code: error.code || '' });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, message: 'GAS Web App aktif. Gunakan POST.' });
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
  // Older sheets have 11 columns; add the "who recorded it" column once.
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h || '').trim().toLowerCase();
  });
  if (headers.indexOf('dicipta_oleh') < 0) {
    sheet.getRange(1, lastCol + 1).setValue('dicipta_oleh');
  }
}

function findStatusColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (!lastCol) return 0;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === 'status') {
      return i + 1;
    }
  }
  return 0;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
