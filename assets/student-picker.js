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

  const dialog = document.createElement('dialog'); dialog.className = 'profile-dialog'; document.body.append(dialog);

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

  // Profile dialog: name, IC, class and every discipline record. Staff roles only (server-enforced).
  async function openProfile(student) {
    if (!canSeeProfile) return;
    dialog.replaceChildren();
    const title = document.createElement('h2'); title.textContent = student.nama;
    const meta = document.createElement('p'); meta.className = 'profile-meta';
    meta.textContent = student.kelas + ' · No. KP ' + formatIc(student.noKp);
    const info = document.createElement('div'); info.className = 'case-info'; info.setAttribute('aria-live', 'polite');
    info.textContent = 'Memuat rekod disiplin...';
    const actions = document.createElement('div'); actions.className = 'profile-actions';
    const add = document.createElement('a'); add.className = 'profile-add';
    add.href = 'rekod-kes-baru.html?' + new URLSearchParams({ nama: student.nama, nokp: student.noKp, kelas: student.kelas });
    add.textContent = 'Tambah rekod kes';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Tutup'; close.onclick = () => dialog.close();
    actions.append(add, close);
    dialog.append(title, meta, info, actions);
    if (!dialog.open) dialog.showModal();
    try {
      const cases = (await auth.call('student_cases', { noKp: student.noKp })).cases || [];
      if (!cases.length) { info.textContent = 'Tiada rekod kesalahan disiplin.'; return; }
      const heading = document.createElement('h3'); heading.textContent = 'Kesalahan disiplin (' + cases.length + ')';
      const ol = document.createElement('ol'); ol.className = 'case-list';
      for (const c of cases) {
        const li = document.createElement('li');
        const main = document.createElement('strong'); main.textContent = c.jenis || '(Jenis kesalahan tidak dinyatakan)';
        const line = document.createElement('div');
        line.textContent = [c.tarikh, c.masa, c.kategori, c.status, c.bukti ? c.bukti + ' gambar bukti' : ''].filter(Boolean).join(' · ');
        li.append(main, line);
        if (c.catatan) { const note = document.createElement('div'); note.textContent = c.catatan; li.append(note); }
        ol.append(li);
      }
      info.replaceChildren(heading, ol);
    } catch (e) { info.textContent = e.message; }
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
