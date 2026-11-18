/* Student picker by class. No student photos.
   - Record page (rekod-kes-baru.html): uses the form's own Tingkatan and Kelas dropdowns, lists that
     class's students, and fills Nama and No KP when one is tapped.
   - Profile page (profil-murid.html, Guru Disiplin / PK HEM / Pengetua): has its own Tingkatan and Kelas
     dropdowns and opens the student's discipline history. */
(() => {
  'use strict';
  const root = document.getElementById('student-picker');
  if (!root) return;
  const auth = window.myDisiplinAuth;
  const $ = id => document.getElementById(id);
  const isFormPage = !!$('nama') && !!$('kelas') && !!$('tingkatan');
  const canSeeProfile = !!auth?.isStaff();
  // Built-in so the dropdowns work at once; classes found in the roster are added after it loads.
  const CLASSES = ['1 AL-FARABI','1 AMANAH','1 BAKTI','1 CEKAL','1 DAMAI','1 GIGIH','1 HORMAT','1 IKHLAS','1 JUJUR','2 AL-FARABI','2 AMANAH','2 BAKTI','2 CEKAL','2 DAMAI','2 GIGIH','2 HORMAT','2 IKHLAS','2 JUJUR','3 AL-FARABI','3 AMANAH','3 BAKTI','3 CEKAL','3 DAMAI','3 GIGIH','3 HORMAT','3 IKHLAS','3 JUJUR','4 AMANAH','4 BAKTI','4 CEKAL','4 DAMAI','4 GIGIH','4 HORMAT','4 IKHLAS','4 JUJUR','4 PVMA','5 AMANAH','5 BAKTI','5 CEKAL','5 DAMAI','5 GIGIH','5 HORMAT','5 IKHLAS','5 JUJUR','5 PVMA'];
  const key = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || '?';
  const formatIc = v => /^\d{12}$/.test(v) ? v.slice(0, 6) + '-' + v.slice(6, 8) + '-' + v.slice(8) : v;
  // Class names start with the form number ('1 AMANAH'); the rest is the name shown in the Kelas dropdown.
  const formOf = c => (String(c).trim().match(/^\d+/) || [''])[0];
  const nameOf = c => String(c).trim().replace(/^\d+\s*/, '') || String(c);
  let students = [], selected = null, loaded = false;

  const SEARCH_ICON = '<svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const searchBox = placeholder => '<div class="search-box">' + SEARCH_ICON + '<input id="picker-search" type="search" autocomplete="off" aria-label="Cari nama murid" placeholder="' + placeholder + '"></div>';
  if (isFormPage) {
    root.innerHTML = `<label for="picker-search">Cari Nama Murid</label>${searchBox('Taip nama murid')}<p id="picker-status" class="picker-status" role="status"></p><div id="picker-list" class="picker-list"></div><div id="picker-selected"></div>`;
  } else {
    root.innerHTML = `<section class="picker-panel">${searchBox('Cari nama murid')}<div class="picker-controls"><label>Tingkatan<select id="picker-form"></select></label><label>Kelas<select id="picker-class"></select></label></div><p id="picker-status" class="picker-status" role="status"></p><div id="picker-list" class="picker-list"></div></section>`;
  }
  const formEl = isFormPage ? $('tingkatan') : $('picker-form');
  const classEl = isFormPage ? $('kelas') : $('picker-class');
  const searchEl = $('picker-search'), status = $('picker-status'), list = $('picker-list');

  // --- Profile page's own dropdowns (the record page's are managed by rekod-kes-baru.html) ---
  let allClasses = CLASSES.slice();
  function fillForms() {
    const forms = [...new Set(allClasses.map(formOf).filter(Boolean))].sort((a, b) => a - b);
    const current = formEl.value;
    formEl.replaceChildren(new Option('Pilih', ''));
    forms.forEach(f => formEl.add(new Option(f, f)));
    formEl.value = forms.includes(current) ? current : '';
  }
  function fillClasses(selectedClass) {
    classEl.replaceChildren(new Option(formEl.value ? 'Pilih kelas' : 'Pilih tingkatan dahulu', ''));
    allClasses.filter(c => formOf(c) === formEl.value).forEach(c => classEl.add(new Option(nameOf(c), c)));
    classEl.disabled = !formEl.value;
    classEl.value = Array.from(classEl.options).find(o => o.value && key(o.value) === key(selectedClass))?.value || '';
  }
  function setClass(value) {
    if (isFormPage) { window.myDisiplinSetKelas?.(value); return; }
    formEl.value = Array.from(formEl.options).some(o => o.value && o.value === formOf(value)) ? formOf(value) : '';
    fillClasses(value);
  }
  if (!isFormPage) { fillForms(); fillClasses(''); }


  function badge(student) {
    const el = document.createElement('span');
    el.className = 'student-initials'; el.setAttribute('aria-hidden', 'true');
    el.textContent = initials(student.nama);
    return el;
  }

  // Name search works across the whole school; Tingkatan and Kelas, when chosen, narrow it down.
  const MAX_ROWS = 30;
  function render() {
    list.replaceChildren();
    // On the record page the list is hidden once a student is chosen, to keep the form short.
    list.hidden = isFormPage && !!selected;
    if (!loaded || (isFormPage && selected)) { if (selected) status.textContent = ''; return; }
    const query = searchEl.value.trim().toUpperCase();
    if (!classEl.value && query.length < 2) {
      status.textContent = 'Taip sekurang-kurangnya 2 huruf nama, atau pilih tingkatan dan kelas.';
      return;
    }
    const words = query.split(/\s+/).filter(Boolean);
    const matches = students.filter(s =>
      (!classEl.value || key(s.kelas) === key(classEl.value)) &&
      (!formEl.value || formOf(s.kelas) === formEl.value) &&
      words.every(w => s.nama.toUpperCase().includes(w)));
    const rows = classEl.value ? matches : matches.slice(0, MAX_ROWS);
    for (const student of rows) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'picker-row';
      button.setAttribute('aria-pressed', String(selected?.noKp === student.noKp));
      const name = document.createElement('span'); name.className = 'picker-name'; name.textContent = student.nama;
      // Without a class filter, show each student's class so namesakes can be told apart.
      if (!classEl.value) { const klass = document.createElement('small'); klass.textContent = student.kelas; name.append(klass); }
      button.append(badge(student), name);
      button.addEventListener('click', () => isFormPage ? selectStudent(student) : openProfile(student));
      list.append(button);
    }
    status.textContent = !rows.length ? 'Tiada murid sepadan.'
      : (matches.length > rows.length ? 'Menunjukkan ' + rows.length + ' daripada ' + matches.length + ' murid. Taip nama penuh untuk tapis. ' : '') +
        (isFormPage ? 'Tekan nama murid untuk mengisi borang.' : 'Tekan nama murid untuk melihat profil.');
  }

  function clearSelection() {
    const had = !!selected;
    selected = null;
    if (isFormPage) {
      $('picker-selected').replaceChildren();
      if (had) { $('nama').value = ''; $('nokp').value = ''; }
    }
    render();
  }

  function selectStudent(student) {
    selected = student;
    $('nama').value = student.nama; $('nokp').value = student.noKp; $('nokp').dispatchEvent(new Event('change'));
    setClass(student.kelas);
    const box = $('picker-selected'); box.replaceChildren(badge(student));
    const label = document.createElement('label'); label.className = 'picker-confirm';
    const check = document.createElement('input'); check.type = 'checkbox'; check.id = 'picker-confirmed';
    label.append(check, document.createTextNode('Saya sahkan murid: ' + student.nama + ' (' + student.kelas + ')'));
    const change = document.createElement('button'); change.type = 'button'; change.className = 'picker-change';
    change.textContent = 'Tukar murid';
    change.addEventListener('click', () => { clearSelection(); searchEl.focus(); });
    box.append(label, change);
    render();
  }

  // ── Profile card (profil-murid.html) ──────────────────────────────────────────────
  // Shown on the page under the search when a name is chosen. Staff roles only (server-enforced).
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

  // Malaysian IC: YYMMDD-PB-###G. Birth date from the first six digits, gender from the last (odd = lelaki).
  function fromIc(noKp) {
    if (!/^\d{12}$/.test(noKp)) return null;
    const yy = Number(noKp.slice(0, 2)), mm = Number(noKp.slice(2, 4)), dd = Number(noKp.slice(4, 6));
    const now = new Date();
    const year = yy + (2000 + yy > now.getFullYear() ? 1900 : 2000);
    const born = new Date(year, mm - 1, dd);
    if (born.getMonth() !== mm - 1 || born.getDate() !== dd) return null;
    let age = now.getFullYear() - year;
    if (now.getMonth() < mm - 1 || (now.getMonth() === mm - 1 && now.getDate() < dd)) age--;
    return {
      lahir: dd + ' ' + BULAN[mm - 1] + ' ' + year,
      umur: age + ' tahun',
      jantina: Number(noKp.slice(-1)) % 2 ? 'Lelaki' : 'Perempuan'
    };
  }

  // Case dates come as "1/11/2026" (d/m/y) or "2026-11-01".
  function caseDate(text) {
    const s = String(text || '').trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  const formatDate = d => d ? d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() : '-';

  function tahap(cases) {
    if (!cases.length) return { text: 'Tiada rekod disiplin', cls: 'tahap-baik' };
    if (cases.some(c => /berat/i.test(c.kategori))) return { text: 'Ada kes berat', cls: 'tahap-berat' };
    if (cases.length >= 3 || cases.some(c => /sederhana/i.test(c.kategori))) return { text: 'Perlu pemantauan', cls: 'tahap-pantau' };
    return { text: 'Kes ringan', cls: 'tahap-ringan' };
  }

  const buktiDialog = el('dialog', 'profile-dialog bukti-viewer'); document.body.append(buktiDialog);
  async function showBukti(c) {
    const body = el('div', '', 'Memuat gambar...');
    const close = el('button', '', 'Tutup'); close.type = 'button'; close.onclick = () => buktiDialog.close();
    const actions = el('div', 'profile-actions'); actions.append(close);
    buktiDialog.replaceChildren(el('h2', '', 'Gambar Bukti — ' + (c.jenis || 'Kes')), body, actions);
    if (!buktiDialog.open) buktiDialog.showModal();
    try {
      const photos = (await auth.call('case_evidence', { rowNumber: c.row })).photos || [];
      if (!photos.length) { body.textContent = 'Gambar bukti tidak ditemui.'; return; }
      body.replaceChildren(...photos.map((src, i) => { const img = el('img'); img.src = src; img.alt = 'Gambar bukti ' + (i + 1); return img; }));
    } catch (e) { body.textContent = e.message; }
  }

  // Parents' phone: one or more numbers ("012-3456789 / 019-8765432"), each with Call and WhatsApp links.
  function phoneRow(telefon) {
    const box = el('div', 'kad-info-item kad-info-penuh');
    box.append(el('span', 'kad-label', 'No. Telefon Ibu Bapa'));
    const numbers = String(telefon || '').split(/[\/,;|]|\s+dan\s+/i).map(t => t.trim()).filter(t => t.replace(/\D/g, '').length >= 9);
    if (!numbers.length) {
      box.append(el('span', 'kad-value kad-kosong', telefon ? telefon : 'Belum diisi dalam tab data'));
      return box;
    }
    for (const number of numbers) {
      const digits = number.replace(/\D/g, '');
      const intl = digits.startsWith('60') ? digits : digits.startsWith('0') ? '6' + digits : digits;
      const line = el('div', 'kad-telefon');
      const call = el('a', 'kad-tel-btn', '📞 Panggil'); call.href = 'tel:+' + intl;
      const wa = el('a', 'kad-tel-btn kad-tel-wa', 'WhatsApp'); wa.href = 'https://wa.me/' + intl; wa.target = '_blank'; wa.rel = 'noopener';
      line.append(el('span', 'kad-value', number), call, wa);
      box.append(line);
    }
    return box;
  }

  function infoRow(label, value) {
    const box = el('div', 'kad-info-item');
    box.append(el('span', 'kad-label', label), el('span', 'kad-value', value || '-'));
    return box;
  }

  function stat(label, value, cls) {
    const box = el('div', 'kad-stat ' + (cls || ''));
    box.append(el('span', 'kad-stat-num', String(value)), el('span', 'kad-stat-label', label));
    return box;
  }

  // ── Student photo (staff only): shrink to a 320x320 JPEG, centre-cropped, before upload ──
  async function compressPhoto(file) {
    if (!/^image\//.test(file.type)) throw new Error('Fail bukan gambar.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Foto terlalu besar (had 20 MB).');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      try { await image.decode(); } catch { throw new Error('Foto rosak atau format tidak disokong. Cuba foto lain.'); }
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 320;
      canvas.getContext('2d').drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
      for (const quality of [0.82, 0.7, 0.55]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= 140000) return data;
      }
      throw new Error('Foto masih terlalu besar. Cuba foto lain.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function photoTools(student, photo, rerender) {
    const bar = el('div', 'kad-foto-bar');
    const status = el('span', 'kad-foto-status');
    const camera = el('input'); camera.type = 'file'; camera.accept = 'image/*'; camera.setAttribute('capture', 'environment'); camera.hidden = true;
    const gallery = el('input'); gallery.type = 'file'; gallery.accept = 'image/jpeg,image/png,image/webp'; gallery.hidden = true;
    const take = el('button', 'kad-foto-btn', '📷 Ambil Foto'); take.type = 'button'; take.onclick = () => camera.click();
    const upload = el('button', 'kad-foto-btn', '🖼️ Muat Naik Foto'); upload.type = 'button'; upload.onclick = () => gallery.click();
    const remove = el('button', 'kad-foto-btn kad-foto-padam', '🗑️ Padam Foto'); remove.type = 'button'; remove.hidden = !photo;
    const busy = (on, text) => { [take, upload, remove].forEach(b => { b.disabled = on; }); status.textContent = text || ''; };
    async function save(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      busy(true, 'Memuat naik foto...');
      try {
        const data = await compressPhoto(file);
        await auth.call('student_photo_save', { noKp: student.noKp, data });
        rerender(data);
      } catch (e) { busy(false, e.message); }
    }
    camera.onchange = () => save(camera);
    gallery.onchange = () => save(gallery);
    remove.onclick = async () => {
      if (!confirm('Padam foto ' + student.nama + '?')) return;
      busy(true, 'Memadam foto...');
      try { await auth.call('student_photo_delete', { noKp: student.noKp }); rerender(''); }
      catch (e) { busy(false, e.message); }
    };
    bar.append(take, upload, remove, status, camera, gallery);
    return bar;
  }

  function renderCard(box, student, cases, photo) {
    const ic = fromIc(student.noKp);
    const sorted = cases.map(c => Object.assign({ _d: caseDate(c.tarikh) }, c))
      .sort((a, b) => (b._d ? b._d.getTime() : 0) - (a._d ? a._d.getTime() : 0));
    const count = re => cases.filter(c => re.test(c.kategori || '')).length;
    const selesai = cases.filter(c => /selesai/i.test(c.status || '')).length;
    const level = tahap(cases);

    // Header
    const head = el('div', 'kad-head');
    let avatar;
    if (photo) {
      avatar = el('img', 'kad-avatar kad-avatar-foto'); avatar.src = photo; avatar.alt = 'Foto ' + student.nama;
    } else {
      avatar = el('div', 'kad-avatar', initials(student.nama)); avatar.setAttribute('aria-hidden', 'true');
    }
    const title = el('div', 'kad-title');
    title.append(el('h2', 'kad-nama', student.nama),
      el('p', 'kad-kelas', student.kelas + (formOf(student.kelas) ? ' · Tingkatan ' + formOf(student.kelas) : '')),
      el('span', 'kad-tahap ' + level.cls, level.text));
    const x = el('button', 'kad-tutup', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Tutup profil');
    x.onclick = () => box.close();
    head.append(avatar, title, x);

    // Personal details
    const info = el('div', 'kad-info');
    info.append(infoRow('No. Kad Pengenalan', formatIc(student.noKp)), infoRow('Jantina', ic && ic.jantina),
      infoRow('Tarikh Lahir', ic && ic.lahir), infoRow('Umur', ic && ic.umur), phoneRow(student.telefon));

    // Discipline summary
    const ringkas = el('section', 'kad-section');
    const stats = el('div', 'kad-stats');
    stats.append(stat('Jumlah kes', cases.length, 'kad-stat-jumlah'), stat('Berat', count(/berat/i), 'kad-stat-berat'),
      stat('Sederhana', count(/sederhana/i), 'kad-stat-sederhana'), stat('Ringan', count(/ringan/i), 'kad-stat-ringan'));
    const statusLine = el('p', 'kad-note', cases.length
      ? (cases.length - selesai) + ' dalam semakan · ' + selesai + ' selesai · kes terakhir: ' + formatDate(sorted[0]._d)
      : 'Murid ini tiada sebarang rekod kesalahan disiplin.');
    ringkas.append(el('h3', 'kad-h3', 'Ringkasan Disiplin'), stats, statusLine);

    // Case history, newest first
    const sejarah = el('section', 'kad-section');
    sejarah.append(el('h3', 'kad-h3', 'Sejarah Kes (' + cases.length + ')'));
    if (sorted.length) {
      const list = el('ol', 'kad-timeline');
      for (const c of sorted) {
        const item = el('li', 'kad-kes');
        const top = el('div', 'kad-kes-top');
        top.append(el('strong', '', c.jenis || '(Jenis tidak dinyatakan)'));
        if (c.kategori) top.append(el('span', 'kad-chip kad-chip-' + String(c.kategori).toLowerCase(), c.kategori));
        top.append(el('span', 'kad-chip ' + (/selesai/i.test(c.status) ? 'kad-chip-selesai' : 'kad-chip-semakan'), c.status || 'Dalam Semakan'));
        item.append(top, el('div', 'kad-kes-meta', [formatDate(c._d), c.masa].filter(Boolean).join(' · ')));
        if (c.catatan) item.append(el('div', 'kad-kes-catatan', c.catatan));
        if (c.bukti && c.row) {
          const btn = el('button', 'kad-bukti-btn', '📷 Lihat gambar bukti (' + c.bukti + ')');
          btn.type = 'button'; btn.onclick = () => showBukti(c);
          item.append(btn);
        }
        list.append(item);
      }
      sejarah.append(list);
    }

    // Actions
    const actions = el('div', 'kad-actions');
    const add = el('a', 'kad-btn kad-btn-utama', '+ Tambah Rekod Kes');
    add.href = 'rekod-kes-baru.html?' + new URLSearchParams({ nama: student.nama, nokp: student.noKp, kelas: student.kelas });
    const print = el('button', 'kad-btn', '🖨️ Cetak Profil'); print.type = 'button';
    // Print only the card (see the @media print rules in student-picker.css).
    print.onclick = () => printProfile(box);
    const close = el('button', 'kad-btn', 'Tutup'); close.type = 'button';
    close.onclick = () => box.close();
    actions.append(add, print, close);

    const fotoBar = photoTools(student, photo, newPhoto => renderCard(box, student, cases, newPhoto));
    box.replaceChildren(head, fotoBar, info, ringkas, sejarah, actions);
  }

  let profileRequest = 0;
  // Popup behaviour: a tap on the dim background closes it; after closing, focus returns to the search.
  const profileBox = $('profil-kad');
  let printing = false;
  if (profileBox) {
    profileBox.addEventListener('click', event => { if (event.target === profileBox) profileBox.close(); });
    profileBox.addEventListener('close', () => { if (!printing) { profileRequest++; profileBox.replaceChildren(); } });
  }

  // A modal popup prints on one page only, so for printing the card is shown as a normal (non-modal)
  // dialog in the page flow, then reopened as a popup afterwards.
  function printProfile(box) {
    printing = true;
    box.close();
    box.show();
    document.body.classList.add('cetak-profil');
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('cetak-profil');
      box.close();
      box.showModal();
      printing = false;
    }, { once: true });
    window.print();
  }

  async function openProfile(student) {
    if (!canSeeProfile) return;
    const box = $('profil-kad');
    if (!box) return;
    // A slow reply for an earlier student must not replace the card of the one chosen last.
    const request = ++profileRequest;
    box.replaceChildren(el('p', 'kad-note', 'Memuat profil ' + student.nama + '...'));
    if (!box.open) box.showModal();
    box.scrollTop = 0;
    try {
      const result = await auth.call('student_cases', { noKp: student.noKp });
      // The phone number comes only with the profile (staff only), not with the student list.
      const full = Object.assign({}, student, { telefon: (result.student && result.student.telefon) || '' });
      if (request === profileRequest) renderCard(box, full, result.cases || [], result.photo || '');
    } catch (e) {
      if (request === profileRequest) box.replaceChildren(el('p', 'kad-note kad-ralat', e.message));
    }
  }

  // A different class means a different student: drop the current choice.
  function onClassChange() {
    if (selected && key(classEl.value) === key(selected.kelas)) { render(); return; }
    clearSelection();
  }

  const targetId = new URLSearchParams(location.search).get('murid');

  async function connect() {
    status.textContent = 'Memuat senarai murid...';
    try {
      students = (await auth.call('student_list')).students || [];
      loaded = true;
      if (!isFormPage) {
        const known = new Set(allClasses.map(key));
        [...new Set(students.map(s => s.kelas))].filter(c => !known.has(key(c))).sort((a, b) => a.localeCompare(b)).forEach(c => allClasses.push(c));
        fillForms();
        // Deep link (?murid=<noKp>): open that student's class and profile.
        const target = targetId && students.find(s => key(s.noKp) === key(targetId.padStart(12, '0')));
        setClass(target ? target.kelas : classEl.value);
        render();
        if (target) openProfile(target);
        return;
      }
      render();
    } catch (e) { students = []; status.textContent = e.message; }
  }

  if (isFormPage) {
    // rekod-kes-baru.html rebuilds the Kelas list when Tingkatan changes, so watch both.
    formEl.addEventListener('change', onClassChange);
    classEl.addEventListener('change', onClassChange);
  } else {
    formEl.addEventListener('change', () => { fillClasses(''); onClassChange(); });
    classEl.addEventListener('change', onClassChange);
  }
  // A new search after choosing a student starts over: the Tingkatan and Kelas the choice filled in
  // would otherwise hide students in other classes.
  searchEl.addEventListener('input', () => {
    if (isFormPage && selected) { clearSelection(); setClass(''); }
    render();
  });

  // Capture phase stops the save handler from recording an unconfirmed or edited identity.
  $('simpan-btn')?.addEventListener('click', event => {
    if (selected && (!$('picker-confirmed')?.checked || $('nokp').value !== selected.noKp || $('nama').value !== selected.nama || key($('kelas').value) !== key(selected.kelas))) {
      event.stopImmediatePropagation();
      status.textContent = 'Sahkan murid yang dipilih sebelum menyimpan.';
      $('picker-confirmed')?.focus();
    }
  }, true);

  window.myDisiplinStudentPicker = { resetAfterSave: () => { searchEl.value = ''; clearSelection(); } };
  connect();
})();
