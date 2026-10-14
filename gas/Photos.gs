// These actions use a server-side access token and private Drive files.
function handlePhotoAction_(payload) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('PHOTO_ACCESS_TOKEN');
  if (!secret || secret.length < 24) throw new Error('Pentadbir perlu tetapkan PHOTO_ACCESS_TOKEN sekurang-kurangnya 24 aksara dalam Script Properties.');
  if (String(payload.photoToken || '') !== secret) throw new Error('Kod akses foto tidak sah.');
  var students = photoStudents_();
  if (payload.action === 'photo_students') return {ok:true, students:students};
  if (payload.action === 'photo_list') {
    if (!payload.kelas) throw new Error('Pilih kelas dahulu.');
    var photos = {};
    students.filter(function(s){return s.kelas === payload.kelas;}).forEach(function(s){
      var id = props.getProperty('photo_' + s.noKp);
      if (id) {
        try { var blob=DriveApp.getFileById(id).getBlob(); photos[s.noKp]='data:image/jpeg;base64,'+Utilities.base64Encode(blob.getBytes()); }
        catch(e) { /* Missing photo is shown as initials; do not abort the class. */ }
      }
    });
    return {ok:true, photos:photos};
  }
  if (!students.some(function(s){return s.noKp === String(payload.noKp);})) throw new Error('Murid tidak ditemui dalam tab data.');
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
