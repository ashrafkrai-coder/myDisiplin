/* Manual photo selection only. No facial analysis or biometric templates. */
(() => {
  'use strict';
  const root = document.getElementById('student-photo-picker');
  if (!root) return;
  const endpoint = 'https://script.google.com/macros/s/AKfycbz6vNSdvbA4syW5rI4kwn4PwOyZeRC43tofD9XCuCDl_LVFdZaiQarZVHXE2d4l4dnu/exec';
  const key = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let students = [], photos = {}, selected = null, generation = 0;
  root.innerHTML = `<section class="photo-panel"><h2>Pilih murid mengikut kelas</h2><div class="photo-controls"><label>Kelas<select id="photo-class"><option value="">Pilih kelas dahulu</option></select></label><label>Cari nama<input id="photo-search" type="search" placeholder="Nama murid"></label><button id="photo-connect" type="button">Sambung / tukar kod akses foto</button></div><p id="photo-status" class="photo-status" role="status"></p><div id="photo-grid" class="photo-grid"></div><div id="photo-selected"></div></section>`;
  const $ = id => document.getElementById(id);
  const classEl = $('photo-class'), status = $('photo-status'), grid = $('photo-grid');
  const dialog = document.createElement('dialog'); dialog.className = 'profile-dialog'; document.body.append(dialog);
  async function api(action, data = {}) {
    const token = sessionStorage.getItem('mydisiplin_photo_token');
    if (!token) throw new Error('Tekan Sambung dan masukkan kod akses foto yang ditetapkan dalam Apps Script.');
    const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action, photoToken:token, ...data})});
    if (!response.ok) throw new Error('Sambungan gagal. Cuba semula.');
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Apps Script perlu dikemas kini untuk fungsi foto.');
    return result;
  }
  function avatar(student, size) {
    const el = photos[student.noKp] ? document.createElement('img') : document.createElement('span');
    el.className = 'student-avatar';
    if (el.tagName === 'IMG') { el.src = photos[student.noKp]; el.alt = 'Foto ' + student.nama; }
    else { el.textContent = student.nama.split(/\s+/).slice(0,2).map(s=>s[0]).join(''); el.setAttribute('aria-label','Belum ada foto'); }
    if (size) { el.style.width = size; el.style.height = size; }
    return el;
  }
  function clearSelection() {
    const hadSelection = !!selected;
    selected = null; $('photo-selected').replaceChildren();
    if ($('nama') && hadSelection) { $('nama').value = ''; $('nokp').value = ''; }
    render();
  }
  function render() {
    grid.replaceChildren();
    const query = $('photo-search').value.trim().toUpperCase();
    const list = students.filter(s=>key(s.kelas)===key(classEl.value) && s.nama.toUpperCase().includes(query));
    for (const student of list) {
      const button = document.createElement('button'); button.type='button'; button.className='photo-card';
      button.setAttribute('aria-pressed',String(selected?.noKp === student.noKp));
      button.append(avatar(student)); const name=document.createElement('span'); name.textContent=student.nama; button.append(name);
      button.addEventListener('click',()=>openProfile(student)); grid.append(button);
    }
    if (classEl.value && !list.length) grid.textContent='Tiada murid sepadan.';
  }
  function selectStudent(student) {
    selected=student; $('nama').value=student.nama; $('nokp').value=student.noKp;
    const option=Array.from($('kelas').options).find(o=>key(o.value)===key(student.kelas));
    if(option) $('kelas').value=option.value;
    const box=$('photo-selected');box.replaceChildren(avatar(student));
    const label=document.createElement('label'); label.className='photo-confirm';
    const check=document.createElement('input');check.type='checkbox';check.id='photo-confirmed';
    label.append(check,document.createTextNode('Saya sahkan murid: '+student.nama));box.append(label);render();
  }
  async function compress(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Pilih foto JPEG, PNG atau WebP.');
    if(file.size>15*1024*1024) throw new Error('Foto terlalu besar. Had fail asal ialah 15 MB.');
    const url=URL.createObjectURL(file), image=new Image();
    try {
      image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
      const side=Math.min(image.naturalWidth,image.naturalHeight);
      canvas.getContext('2d').drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,320,320);
      const data=canvas.toDataURL('image/jpeg',.78);
      if(data.length>150000) throw new Error('Foto masih terlalu besar. Cuba foto lain.');
      return data;
    } finally {URL.revokeObjectURL(url);}
  }
  function openProfile(student) {
    dialog.replaceChildren(); const title=document.createElement('h2');title.textContent=student.nama;
    const klass=document.createElement('p');klass.textContent=student.kelas;
    const preview=avatar(student,'180px');dialog.append(title,klass,preview);
    const msg=document.createElement('p');msg.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='profile-actions';
    const choose=document.createElement('button');choose.type='button';choose.textContent='Pilih murid ini';
    choose.hidden=!$('nama');choose.onclick=()=>{selectStudent(student);dialog.close();};
    const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.hidden=true;
    const camera=document.createElement('input');camera.type='file';camera.accept='image/jpeg,image/png,image/webp';camera.setAttribute('capture','user');camera.hidden=true;
    const upload=document.createElement('button');upload.type='button';upload.textContent='Muat naik / ganti foto';upload.onclick=()=>file.click();
    const capture=document.createElement('button');capture.type='button';capture.textContent='Ambil foto';capture.onclick=()=>camera.click();
    const remove=document.createElement('button');remove.type='button';remove.textContent='Padam foto';remove.disabled=!photos[student.noKp];
    const close=document.createElement('button');close.type='button';close.textContent='Tutup';close.onclick=()=>dialog.close();
    const busy = value => { for(const el of [choose,upload,capture,remove,close]) el.disabled=value; if(!value)remove.disabled=!photos[student.noKp]; };
    async function savePhoto(input) {
      if(!input.files[0])return;busy(true);msg.textContent='Memuat naik foto...';
      try {const data=await compress(input.files[0]);await api('photo_save',{noKp:student.noKp,data});photos[student.noKp]=data;render();openProfile(student);}
      catch(e){msg.textContent=e.message;}finally{busy(false);input.value='';}
    }
    file.onchange=()=>savePhoto(file);camera.onchange=()=>savePhoto(camera);
    remove.onclick=async()=>{
      if(!confirm('Padam foto profil '+student.nama+'?'))return;busy(true);msg.textContent='Memadam foto...';
      try{await api('photo_delete',{noKp:student.noKp});delete photos[student.noKp];render();openProfile(student);}catch(e){msg.textContent=e.message;}finally{busy(false);}
    };
    actions.append(choose,upload,capture,remove,close);dialog.append(actions,file,camera,msg);
    if(!dialog.open)dialog.showModal();
  }
  async function loadClass() {
    const current=++generation;photos={};clearSelection();
    if(!classEl.value){status.textContent='Pilih kelas dahulu.';return;}
    if($('kelas')){const o=Array.from($('kelas').options).find(o=>key(o.value)===key(classEl.value));if(o)$('kelas').value=o.value;}
    status.textContent='Memuat foto kelas...';
    try{const result=await api('photo_list',{kelas:classEl.value});if(current!==generation)return;photos=result.photos||{};render();status.textContent='Tekan foto atau nama untuk membuka profil.';}
    catch(e){if(current===generation)status.textContent=e.message;}
  }
  async function connect() {
    status.textContent='Memuat senarai murid...';grid.replaceChildren();
    try {
      const result=await api('photo_students');students=result.students;
      const previous=classEl.value || ($('kelas')?.value ?? '');classEl.replaceChildren(new Option('Pilih kelas dahulu',''));
      [...new Set(students.map(s=>s.kelas))].sort((a,b)=>a.localeCompare(b)).forEach(c=>classEl.add(new Option(c,c)));
      classEl.value=Array.from(classEl.options).find(o=>key(o.value)===key(previous))?.value||'';await loadClass();
    }catch(e){students=[];photos={};clearSelection();status.textContent=e.message;}
  }
  $('photo-connect').onclick=()=>{const token=prompt('Kod akses foto (PHOTO_ACCESS_TOKEN dalam Apps Script):');if(token?.trim()){sessionStorage.setItem('mydisiplin_photo_token',token.trim());connect();}};
  classEl.onchange=loadClass;$('photo-search').oninput=render;
  // Capture phase prevents the existing save handler from recording an unconfirmed or changed identity.
  $('simpan-btn')?.addEventListener('click',event=>{
    if(selected && (!$('photo-confirmed')?.checked || $('nokp').value!==selected.noKp || $('nama').value!==selected.nama || key($('kelas').value)!==key(selected.kelas))){
      event.stopImmediatePropagation();status.textContent='Sahkan murid yang dipilih sebelum menyimpan.';$('photo-confirmed')?.focus();
    }
  },true);
  window.myDisiplinPhotoPicker={resetAfterSave:clearSelection};
  connect();
})();
