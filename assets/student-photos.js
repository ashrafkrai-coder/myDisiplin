/* Manual photo selection only. No facial analysis or biometric templates. */
(() => {
  'use strict';
  const root = document.getElementById('student-photo-picker');
  if (!root) return;
  // Must match the KELAS values in the sheet exactly; the server filters by exact name.
  const CLASSES = ['1 AL-FARABI','1 AMANAH','1 BAKTI','1 CEKAL','1 DAMAI','1 GIGIH','1 HORMAT','1 IKHLAS','1 JUJUR','2 AL-FARABI','2 AMANAH','2 BAKTI','2 CEKAL','2 DAMAI','2 GIGIH','2 HORMAT','2 IKHLAS','2 JUJUR','3 AL-FARABI','3 AMANAH','3 BAKTI','3 CEKAL','3 DAMAI','3 GIGIH','3 HORMAT','3 IKHLAS','3 JUJUR','4 AMANAH','4 BAKTI','4 CEKAL','4 DAMAI','4 GIGIH','4 HORMAT','4 IKHLAS','4 JUJUR','4 PVMA','5 AMANAH','5 BAKTI','5 CEKAL','5 DAMAI','5 GIGIH','5 HORMAT','5 IKHLAS','5 JUJUR','5 PVMA'];
  const key = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let students = [], photos = {}, selected = null, generation = 0, loadedKey = null;
  root.innerHTML = `<section class="photo-panel"><details id="photo-menu"${root.dataset.open === 'true' ? ' open' : ''}><summary>Foto murid (pilih mengikut kelas)</summary><div class="photo-controls"><label>Kelas<select id="photo-class"><option value="">Pilih kelas dahulu</option></select></label><label>Cari nama<input id="photo-search" type="search" placeholder="Nama murid"></label></div><p id="photo-status" class="photo-status" role="status"></p><div id="photo-grid" class="photo-grid"></div></details><div id="photo-selected"></div></section>`;
  const $ = id => document.getElementById(id);
  const menu = $('photo-menu'), classEl = $('photo-class'), status = $('photo-status'), grid = $('photo-grid');
  CLASSES.forEach(c => classEl.add(new Option(c, c)));
  const dialog = document.createElement('dialog'); dialog.className = 'profile-dialog'; document.body.append(dialog);
  const api = (action, data = {}) => window.myDisiplinAuth.call(action, data);
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
      image.src=url;
      try{await image.decode();}catch(e){throw new Error('Fail foto rosak atau tidak boleh dibaca. Cuba foto lain.');}
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
      const side=Math.min(image.naturalWidth,image.naturalHeight);
      canvas.getContext('2d').drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,320,320);
      const data=canvas.toDataURL('image/jpeg',.78);
      if(data.length>150000) throw new Error('Foto masih terlalu besar. Cuba foto lain.');
      return data;
    } finally {URL.revokeObjectURL(url);}
  }
  const caseCache = {};
  const formatIc = v => /^\d{12}$/.test(v) ? v.slice(0,6)+'-'+v.slice(6,8)+'-'+v.slice(8) : v;
  // Students with discipline records get full name, IC and offences; others show nothing extra.
  async function showCases(student, box) {
    try {
      if (!caseCache[student.noKp]) caseCache[student.noKp] = (await api('photo_cases',{noKp:student.noKp})).cases || [];
      const cases = caseCache[student.noKp];
      if (!box.isConnected || !cases.length) return;
      const head = document.createElement('div');head.className='case-head';
      const name = document.createElement('p');name.innerHTML='<strong>Nama penuh:</strong> ';name.append(student.nama);
      const ic = document.createElement('p');ic.innerHTML='<strong>No. KP:</strong> ';ic.append(formatIc(student.noKp));
      const title = document.createElement('h3');title.textContent='Kesalahan disiplin ('+cases.length+')';
      const list = document.createElement('ol');list.className='case-list';
      for (const c of cases) {
        const li = document.createElement('li');
        const main = document.createElement('strong');main.textContent=c.jenis||'(Jenis kesalahan tidak dinyatakan)';
        const meta = document.createElement('div');
        meta.textContent=[c.tarikh,c.masa,c.kategori,c.status].filter(Boolean).join(' · ');
        li.append(main,meta);
        if (c.catatan) { const note=document.createElement('div');note.textContent=c.catatan;li.append(note); }
        list.append(li);
      }
      head.append(name,ic);box.replaceChildren(head,title,list);
    } catch (e) { /* Case details are optional; the photo tools must keep working. */ }
  }
  function openProfile(student) {
    dialog.replaceChildren(); const title=document.createElement('h2');title.textContent=student.nama;
    const klass=document.createElement('p');klass.textContent=student.kelas;
    const preview=avatar(student,'180px');
    const info=document.createElement('div');info.className='case-info';info.setAttribute('aria-live','polite');
    dialog.append(title,klass,preview,info);
    showCases(student,info);
    const msg=document.createElement('p');msg.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='profile-actions';
    const choose=document.createElement('button');choose.type='button';choose.textContent='Pilih murid ini';
    choose.hidden=!$('nama');choose.onclick=()=>{selectStudent(student);dialog.close();menu.open=false;};
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
    const current=++generation;photos={};loadedKey=null;clearSelection();
    if(!classEl.value){status.textContent='Pilih kelas dahulu.';return;}
    if($('kelas')){const o=Array.from($('kelas').options).find(o=>key(o.value)===key(classEl.value));if(o)$('kelas').value=o.value;}
    // Photos are fetched and shown only while the menu is open; opening it triggers the load.
    if(!menu.open){status.textContent='Buka menu untuk melihat foto kelas.';return;}
    loadedKey=key(classEl.value);
    status.textContent='Memuat foto kelas...';
    render();
    // Small parallel batches: cards fill in as each batch returns instead of waiting for the whole class.
    const ids=students.filter(s=>key(s.kelas)===key(classEl.value)).map(s=>s.noKp);
    const batches=[];for(let i=0;i<ids.length;i+=8)batches.push(ids.slice(i,i+8));
    let done=0;
    try{
      await Promise.all(batches.map(async noKps=>{
        const result=await api('photo_batch',{noKps});
        if(current!==generation)return;
        Object.assign(photos,result.photos||{});done++;
        status.textContent='Memuat foto kelas... ('+done+'/'+batches.length+')';render();
      }));
      if(current===generation)status.textContent='Tekan foto atau nama untuk membuka profil.';
    }catch(e){if(current===generation)status.textContent=e.message;}
  }
  async function connect() {
    status.textContent='Memuat senarai murid...';grid.replaceChildren();
    try {
      const result=await api('photo_students');students=result.students;
      const previous=classEl.value || ($('kelas')?.value ?? '');
      const known=new Set(Array.from(classEl.options).map(o=>key(o.value)));
      [...new Set(students.map(s=>s.kelas))].filter(c=>!known.has(key(c))).sort((a,b)=>a.localeCompare(b)).forEach(c=>classEl.add(new Option(c,c)));
      classEl.value=Array.from(classEl.options).find(o=>key(o.value)===key(previous))?.value||'';await loadClass();
    }catch(e){students=[];photos={};clearSelection();status.textContent=e.message;}
  }
  // The class list is built in, so the dropdown works at once; the roster loads in the background.
  classEl.onchange=()=>{
    if(!classEl.value){loadClass();return;}
    if(students.length)loadClass();else connect();
  };$('photo-search').oninput=render;
  menu.addEventListener('toggle',()=>{
    if(menu.open && classEl.value && students.length && loadedKey!==key(classEl.value))loadClass();
  });
  // Capture phase prevents the existing save handler from recording an unconfirmed or changed identity.
  $('simpan-btn')?.addEventListener('click',event=>{
    if(selected && (!$('photo-confirmed')?.checked || $('nokp').value!==selected.noKp || $('nama').value!==selected.nama || key($('kelas').value)!==key(selected.kelas))){
      event.stopImmediatePropagation();status.textContent='Sahkan murid yang dipilih sebelum menyimpan.';$('photo-confirmed')?.focus();
    }
  },true);
  window.myDisiplinPhotoPicker={resetAfterSave:clearSelection};
  connect();
})();
