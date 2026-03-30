const DEFAULT_SHEET_ID = '1n3_wQUNOO1iW8mFc-etoncKfuda4Ce94pusKv6s2vRs';
const DEFAULT_TAB_NAME = 'Rekod kes baru';

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const sheetId = payload.sheetId || (e && e.parameter && e.parameter.sheetId) || DEFAULT_SHEET_ID;
    const tabName = payload.tab || (e && e.parameter && e.parameter.tab) || DEFAULT_TAB_NAME;

    if (!sheetId) {
      return jsonResponse_({ ok: false, error: 'sheetId tidak ditemui.' });
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    let sheet = spreadsheet.getSheetByName(tabName);
    if (!sheet) sheet = spreadsheet.insertSheet(tabName);

    const action = String(payload.action || '').toLowerCase();
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
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
    ]);

    return jsonResponse_({ ok: true, tab: tabName, sheetId: sheetId });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message || String(error) });
  }
}

function doGet(e) {
  return jsonResponse_({
    ok: true,
    message: 'GAS Web App aktif. Gunakan POST untuk simpan rekod.',
    sheetId: (e && e.parameter && e.parameter.sheetId) || DEFAULT_SHEET_ID,
    tab: (e && e.parameter && e.parameter.tab) || DEFAULT_TAB_NAME
  });
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
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'id',
    'no_kp',
    'tarikh',
    'masa',
    'nama',
    'kelas',
    'jenis_kesalahan',
    'kategori',
    'catatan',
    'status',
    'dicipta_pada'
  ]);
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
