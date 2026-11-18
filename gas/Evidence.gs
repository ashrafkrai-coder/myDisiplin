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
