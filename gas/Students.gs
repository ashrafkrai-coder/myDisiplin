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
