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
