// These actions use a server-side access token and private Drive files.
function handlePhotoAction_(payload) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('PHOTO_ACCESS_TOKEN');
  if (!secret || secret.length < 24) throw new Error('Pentadbir perlu tetapkan PHOTO_ACCESS_TOKEN sekurang-kurangnya 24 aksara dalam Script Properties.');
  if (String(payload.photoToken || '') !== secret) throw new Error('Kod akses foto tidak sah.');
  if (payload.action === 'photo_batch') {
    // Fast path: no roster read. Only 12-digit IDs that already have a stored photo are returned.
    var batch = {};
    (Array.isArray(payload.noKps) ? payload.noKps : []).slice(0, 12).forEach(function(k){
      k = String(k);
      if (!/^d{12}$/.test(k)) return;
      var fileId = props.getProperty('photo_' + k);
      if (!fileId) return;
      var uri = photoDataUri_(fileId);
      if (uri) batch[k] = uri;
    });
    return {ok:true, photos:batch};
  }
  var students = photoStudents_();
  if (payload.action === 'photo_students') return {ok:true, students:students};
  if (payload.action === 'photo_list') {
    if (!payload.kelas) throw new Error('Pilih kelas dahulu.');
    var photos = {};
    var wanted = classKey_(payload.kelas);
    students.filter(function(s){return classKey_(s.kelas) === wanted;}).forEach(function(s){
      var id = props.getProperty('photo_' + s.noKp);
      if (id) {
        var uri = photoDataUri_(id);
        if (uri) photos[s.noKp] = uri; /* Missing photo is shown as initials; do not abort the class. */
      }
    });
    return {ok:true, photos:photos};
  }
  if (!students.some(function(s){return s.noKp === String(payload.noKp);})) throw new Error('Murid tidak ditemui dalam tab data.');
  if (payload.action === 'photo_cases') {
    var noKp = String(payload.noKp);
    var student = students.filter(function(s){return s.noKp === noKp;})[0];
    return {ok:true, student:student, cases:photoCases_(noKp)};
  }
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var property='photo_'+payload.noKp, previous=props.getProperty(property);
    if(payload.action === 'photo_delete') {
      if(previous){try{DriveApp.getFileById(previous).setTrashed(true);}catch(e){/* File already gone; still clear the reference. */}}
      props.deleteProperty(property);return {ok:true};
    }
    if(payload.action !== 'photo_save') throw new Error('Tindakan foto tidak sah.');
    var data=String(payload.data || '');
    if(data.length>150000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)) throw new Error('Format atau saiz foto tidak sah.');
    var bytes=Utilities.base64Decode(data.split(',')[1]);
    if(bytes.length<4 || (bytes[0]&255)!==255 || (bytes[1]&255)!==216) throw new Error('Fail JPEG tidak sah.');
    var folderId=props.getProperty('PHOTO_FOLDER_ID');
    var folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('myDisiplin Foto Murid');
    if(!folderId)props.setProperty('PHOTO_FOLDER_ID',folder.getId());
    var file=folder.createFile(Utilities.newBlob(bytes,'image/jpeg',Utilities.getUuid()+'.jpg'));
    props.setProperty(property,file.getId());
    if(previous){try{DriveApp.getFileById(previous).setTrashed(true);}catch(e){}}
    return {ok:true};
  } finally {lock.releaseLock();}
}
function photoStudents_() {
  var sheet=SpreadsheetApp.openById(DEFAULT_SHEET_ID).getSheetByName('data');
  if(!sheet)throw new Error('Tab data tidak ditemui.');
  var rows=sheet.getDataRange().getDisplayValues();
  var headers=rows.shift().map(function(h){return String(h).toUpperCase().replace(/[^A-Z0-9]/g,'');});
  var n=headers.indexOf('NAMA'),k=headers.indexOf('KELAS'),id=headers.indexOf('NOKADPENGENALAN');
  if(n<0 || k<0 || id<0)throw new Error('Kolum NAMA, KELAS dan NO. KAD PENGENALAN diperlukan.');
  return rows.filter(function(r){return r[n] && r[k] && r[id];}).map(function(r){return {nama:r[n].trim(),kelas:r[k].trim(),noKp:r[id].replace(/[^0-9]/g,'').padStart(12,'0')};});
}
// Discipline records for one student, matched on IC number from the case sheet.
function photoCases_(noKp) {
  var sheet=SpreadsheetApp.openById(DEFAULT_SHEET_ID).getSheetByName(DEFAULT_TAB_NAME);
  if(!sheet || sheet.getLastRow()<2) return [];
  var rows=sheet.getDataRange().getDisplayValues();
  var headers=rows.shift().map(function(h){return String(h).toLowerCase().replace(/[^a-z0-9]/g,'');});
  var col=function(name){return headers.indexOf(name);};
  var ic=col('nokp'), tarikh=col('tarikh'), masa=col('masa'), jenis=col('jeniskesalahan'), kategori=col('kategori'), catatan=col('catatan'), status=col('status');
  if(ic<0) return [];
  var get=function(r,i){return i<0?'':String(r[i]).trim();};
  return rows.filter(function(r){
    return String(r[ic]).replace(/[^0-9]/g,'').padStart(12,'0')===noKp;
  }).map(function(r){
    return {tarikh:get(r,tarikh),masa:get(r,masa),jenis:get(r,jenis),kategori:get(r,kategori),catatan:get(r,catatan),status:get(r,status)};
  });
}
// Class names are compared ignoring case, spaces and hyphens so '1 AL FARABI' and '1 AL-FARABI' match.
function classKey_(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
// Reads a stored photo as a data URI. Cached by Drive file ID, which changes whenever the photo is replaced.
function photoDataUri_(fileId) {
  var cache = CacheService.getScriptCache(), key = 'ph_' + fileId;
  var hit = cache.get(key);
  if (hit) return hit;
  try {
    var uri = 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes());
    if (uri.length < 90000) cache.put(key, uri, 21600);
    return uri;
  } catch (e) { return ''; }
}
