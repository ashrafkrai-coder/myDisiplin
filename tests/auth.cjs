const assert = require('node:assert/strict');
const { createGas, STUDENTS, CASES } = require('./gas-mock.cjs');

const gas = createGas({ sheets: { data: STUDENTS, 'Rekod kes baru': CASES } });
const { post, sheets, cache, files } = gas;
const good = { username: 'cikgu.aini', nama: 'Aini Binti Ali', password: 'RahsiaBesar1', peranan: 'Guru' };
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg); // vm arrays are another realm
const JPEG = 'data:image/jpeg;base64,/9j/2Q==';

// --- Registration: no code needed ---
let r;
assert.match(post({ action: 'register', ...good, peranan: '' }).error, /Pilih peranan/);
assert.match(post({ action: 'register', ...good, peranan: 'Admin' }).error, /Pilih peranan/);
for (const bad of [{ username: 'AB' }, { username: 'a b c' }, { nama: 'Al' }, { password: 'pendek' }]) {
  r = post({ action: 'register', ...good, ...bad });
  assert.equal(r.ok, false, JSON.stringify(bad));
}
r = post({ action: 'register', ...good });
assert.equal(r.ok, true); assert.match(r.session, /^[a-f0-9]{64}$/); assert.equal(r.username, 'cikgu.aini'); assert.equal(r.peranan, 'Guru');
const guruSession = r.session;
const guruRows = sheets.get('guru').rows;
same(guruRows[0].slice(-1), ['peranan']);
assert.ok(!guruRows[1].includes(good.password), 'password must not be stored in plain text');
assert.equal(guruRows[1][4], 'aktif'); assert.equal(guruRows[1][7], 'Guru');
r = post({ action: 'register', ...good, username: 'CIKGU.AINI' });
assert.equal(r.ok, false); assert.match(r.error, /sudah digunakan/);

// Senior roles register as 'menunggu' (pending), get no session and cannot log in until approved.
for (const peranan of ['Guru Disiplin', 'pk hem', 'PENGETUA']) {
  const username = 'x.' + peranan.replace(/\W/g, '').toLowerCase();
  r = post({ action: 'register', ...good, username, peranan });
  assert.equal(r.ok, true, peranan); assert.equal(r.pending, true, peranan); assert.equal(r.session, undefined, peranan);
  assert.match(r.message, /menunggu kelulusan/);
  assert.match(post({ action: 'login', username, password: good.password }).error, /menunggu kelulusan/, peranan);
}
r = post({ action: 'register', ...good, username: 'pk.hem', nama: 'Encik PK HEM', peranan: 'pk hem' });
assert.equal(r.peranan, 'PK HEM', 'role spelling is normalised');
const pkRow = sheets.get('guru').rows.find(row => row[0] === 'pk.hem');
assert.equal(pkRow[4], 'menunggu'); assert.equal(pkRow[7], 'PK HEM');
// Admin approves by setting status to 'aktif'.
pkRow[4] = 'aktif';
r = post({ action: 'login', username: 'pk.hem', password: good.password });
assert.equal(r.ok, true); assert.equal(r.peranan, 'PK HEM');
const staffSession = r.session;

// Open registration is rate-limited per hour.
const flood = createGas({ sheets: { data: STUDENTS } });
for (let i = 0; i < 30; i++) assert.equal(flood.post({ action: 'register', ...good, username: 'spam' + i }).ok, true);
assert.match(flood.post({ action: 'register', ...good, username: 'spam30' }).error, /Terlalu banyak pendaftaran/);

// --- Login ---
r = post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
assert.equal(r.ok, true); assert.equal(r.peranan, 'Guru');
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'salah' }).ok, false);
assert.equal(post({ action: 'login', username: 'tiada.orang', password: 'x' }).error, 'Nama pengguna atau kata laluan tidak sah.');
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'salah' }).error, 'Nama pengguna atau kata laluan tidak sah.',
  'wrong password and unknown user must give the same message');

// The role chosen at login must match the account; a mismatch is only revealed after a correct password.
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1', peranan: 'Guru' }).ok, true);
assert.match(post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1', peranan: 'Pengetua' }).error, /tidak sepadan.*Guru/);
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'salah', peranan: 'Pengetua' }).error, 'Nama pengguna atau kata laluan tidak sah.');
assert.equal(post({ action: 'login', username: 'pk.hem', password: 'RahsiaBesar1', peranan: 'pk hem' }).ok, true, 'role spelling is normalised at login');

// Accounts created before roles existed (7 columns) log in as Guru.
const legacy = createGas({ sheets: { data: STUDENTS } });
legacy.post({ action: 'register', ...good });
legacy.sheets.get('guru').rows.forEach(row => row.splice(7));
r = legacy.post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
assert.equal(r.ok, true); assert.equal(r.peranan, 'Guru');

// --- Every non-auth action needs a session ---
for (const action of ['whoami', 'sheet_table', 'student_list', 'late_count', 'student_cases', 'case_evidence', 'update_status', 'append']) {
  r = post({ action, tab: 'data' });
  assert.equal(r.ok, false, action); assert.equal(r.code, 'SESSION', action);
}
assert.equal(post({ action: 'sheet_table', tab: 'data', session: 'f'.repeat(64) }).code, 'SESSION', 'unknown session must be rejected');
assert.equal(post({ action: 'photo_students', session: staffSession }).ok, false, 'student photo actions are gone');

// --- Guru: may record cases only ---
const asGuru = p => post({ session: guruSession, ...p });
assert.equal(asGuru({ action: 'whoami' }).peranan, 'Guru');
assert.equal(asGuru({ action: 'student_list' }).students.length, 2, 'Guru needs the roster to pick a student');
assert.equal(asGuru({ action: 'late_count', noKp: '090101010001' }).count, 0);
assert.equal(asGuru({ action: 'sheet_table', tab: 'data' }).code, 'ROLE', 'the data tab holds parents phone numbers');
assert.equal(asGuru({ action: 'student_list' }).students[0].telefon, undefined, 'student_list never carries phone numbers');
for (const p of [{ action: 'sheet_table', tab: 'Rekod kes baru' }, { action: 'student_cases', noKp: '090101010001' },
  { action: 'case_evidence', rowNumber: 2 }, { action: 'update_status', rowNumber: 2, status: 'Selesai' }]) {
  r = asGuru(p);
  assert.equal(r.ok, false, p.action); assert.equal(r.code, 'ROLE', p.action);
}
assert.equal(sheets.get('Rekod kes baru').rows[1][9], 'Selesai', 'refused update must not change the sheet');

// --- Recording a case, with evidence photos ---
const guruCount = sheets.get('guru').rows.length;
r = asGuru({ action: 'append', noKp: '100202020002', nama: 'MURID DUA', kelas: '2 AMANAH', tarikh: '2026-10-15', masa: '08:00',
  jenisKesalahan: 'TINGKAH LAKU TIDAK PENTINGKAN MASA', kategori: 'Ringan', catatan: 'x', status: 'Dalam Semakan',
  sheetId: 'orang-lain', tab: 'guru', bukti: [JPEG, JPEG] });
assert.equal(r.ok, true); assert.equal(r.tab, 'Rekod kes baru'); assert.equal(r.bukti, 2);
const caseRows = sheets.get('Rekod kes baru').rows;
same(caseRows[0].slice(11), ['dicipta_oleh', 'bukti'], 'legacy header gains the new columns');
assert.equal(caseRows[2][11], 'cikgu.aini');
assert.equal(caseRows[2][12].split(',').length, 2);
assert.equal(sheets.get('guru').rows.length, guruCount, 'payload.tab must not redirect writes');
assert.equal(asGuru({ action: 'late_count', noKp: '100202020002' }).count, 1);

// Bad evidence is refused before anything is written.
const before = caseRows.length, driveBefore = files.size;
for (const bukti of [[JPEG, JPEG, JPEG, JPEG], ['data:image/png;base64,AAAA'], ['data:image/jpeg;base64,AAAA'], ['data:image/jpeg;base64,' + 'a'.repeat(400000)], 'x']) {
  r = asGuru({ action: 'append', noKp: '1', nama: 'Y', bukti });
  assert.equal(r.ok, false, String(bukti).slice(0, 30));
}
assert.equal(caseRows.length, before); assert.equal(files.size, driveBefore);
assert.equal(asGuru({ action: 'append', noKp: '1', nama: 'Tanpa Bukti' }).ok, true, 'evidence is optional');
assert.equal(caseRows[caseRows.length - 1][12], '');

// --- Staff roles: full access ---
const asStaff = p => post({ session: staffSession, ...p });
r = asStaff({ action: 'sheet_table', tab: 'Rekod kes baru' });
assert.equal(r.ok, true); assert.equal(r.rows[0][4], 'MURID UJIAN');
assert.match(asStaff({ action: 'sheet_table', tab: 'guru' }).error, /tidak dibenarkan/, 'guru tab (hashes) is never readable');
r = asStaff({ action: 'student_cases', noKp: '100202020002' });
assert.equal(r.student.nama, 'MURID DUA'); assert.equal(r.cases.length, 1); assert.equal(r.cases[0].bukti, 2);
assert.equal(asStaff({ action: 'student_cases', noKp: '090101010001' }).cases[0].jenis, 'KEKEMASAN DIRI');
r = asStaff({ action: 'case_evidence', rowNumber: 3 });
same(r.photos, [JPEG, JPEG]);
same(asStaff({ action: 'case_evidence', rowNumber: 2 }).photos, [], 'case without evidence');
assert.equal(asStaff({ action: 'case_evidence', rowNumber: 99 }).ok, false);
// A file ID typed into the sheet that is outside the evidence folder is not served.
files.set('outsider0001', { bytes: [255, 216, 255, 217], folder: 'other-folder' });
caseRows[2][12] = 'outsider0001';
same(asStaff({ action: 'case_evidence', rowNumber: 3 }).photos, []);
r = asStaff({ action: 'update_status', rowNumber: 2, status: 'Dalam Semakan' });
assert.equal(r.ok, true); assert.equal(caseRows[1][9], 'Dalam Semakan');
assert.equal(asStaff({ action: 'update_status', rowNumber: 1, status: 'x' }).ok, false);

// --- Student photos: staff only, validated, replace trashes nothing visible, delete clears ---
const KP = '090101010001';
for (const p of [{ action: 'student_photo_save', noKp: KP, data: JPEG }, { action: 'student_photo_delete', noKp: KP }]) {
  assert.equal(asGuru(p).code, 'ROLE', 'Guru cannot ' + p.action);
}
assert.equal(asStaff({ action: 'student_cases', noKp: KP }).photo, '', 'no photo yet');
assert.match(asStaff({ action: 'student_photo_save', noKp: '999999999999', data: JPEG }).error, /tidak ditemui/);
assert.match(asStaff({ action: 'student_photo_save', noKp: KP, data: 'data:image/png;base64,AAAA' }).error, /Format/);
assert.match(asStaff({ action: 'student_photo_save', noKp: KP, data: 'data:image/jpeg;base64,AAAA' }).error, /JPEG/);
assert.match(asStaff({ action: 'student_photo_save', noKp: KP, data: 'data:image/jpeg;base64,' + 'a'.repeat(150000) }).error, /saiz/);
r = asStaff({ action: 'student_photo_save', noKp: KP, data: JPEG });
assert.equal(r.ok, true);
const firstPhoto = gas.props.get('photo_' + KP);
assert.ok(firstPhoto, 'photo file recorded');
assert.ok(asStaff({ action: 'student_cases', noKp: KP }).photo.startsWith('data:image/jpeg;base64,'), 'profile returns the photo');
assert.equal(asStaff({ action: 'student_photo_save', noKp: KP, data: JPEG }).ok, true);
assert.notEqual(gas.props.get('photo_' + KP), firstPhoto, 'replacing stores a new file');
assert.equal(asStaff({ action: 'student_photo_delete', noKp: KP }).ok, true);
assert.equal(gas.props.has('photo_' + KP), false);
assert.equal(asStaff({ action: 'student_cases', noKp: KP }).photo, '');
assert.equal(asStaff({ action: 'student_photo_delete', noKp: KP }).ok, true, 'delete is idempotent');

// --- Parents' phone number: only on the staff profile ---
assert.equal(asStaff({ action: 'student_cases', noKp: KP }).student.telefon, '', 'no phone column yet: empty');
const telGas = createGas({ sheets: { data: [['BIL', 'NAMA', 'NO. KAD PENGENALAN', ' KELAS', 'NO. TELEFON IBU BAPA'], ['1', 'MURID UJIAN', '090101010001', '1 AL-FARABI', '012-3456789']] } });
telGas.post({ action: 'register', username: 'pk.tel', nama: 'PK Telefon', password: 'RahsiaBesar1', peranan: 'PK HEM' });
telGas.sheets.get('guru').rows[1][4] = 'aktif';
const telSession = telGas.post({ action: 'login', username: 'pk.tel', password: 'RahsiaBesar1' }).session;
assert.equal(telGas.post({ action: 'student_cases', session: telSession, noKp: KP }).student.telefon, '012-3456789');
assert.equal(telGas.post({ action: 'student_list', session: telSession }).students[0].telefon, undefined);

// --- Role changes in the sheet apply after the 5 minute cache ---
sheets.get('guru').rows[1][7] = 'Guru Disiplin';
cache.delete('role_cikgu.aini');
assert.equal(asGuru({ action: 'whoami' }).peranan, 'Guru Disiplin');
assert.equal(asGuru({ action: 'sheet_table', tab: 'Rekod kes baru' }).ok, true);
sheets.get('guru').rows[1][7] = 'Guru';
cache.delete('role_cikgu.aini');

// --- Logout ends the session ---
assert.equal(post({ action: 'logout', session: staffSession }).ok, true);
assert.equal(asStaff({ action: 'sheet_table', tab: 'data' }).code, 'SESSION');

// --- Disabling an account ends its sessions (after the 5 minute cache) ---
assert.equal(asGuru({ action: 'student_list' }).ok, true);
sheets.get('guru').rows[1][4] = 'tidak aktif';
cache.delete('role_cikgu.aini');
assert.equal(asGuru({ action: 'student_list' }).code, 'SESSION');
assert.match(post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' }).error, /tidak aktif/);
sheets.get('guru').rows[1][4] = 'aktif';

// --- Brute force lock ---
const lock = createGas({ sheets: { data: STUDENTS } });
lock.post({ action: 'register', ...good });
for (let i = 0; i < 5; i++) lock.post({ action: 'login', username: 'cikgu.aini', password: 'salah' + i });
r = lock.post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
assert.equal(r.ok, false); assert.match(r.error, /Terlalu banyak/, 'correct password must be refused while locked');

console.log('PASS auth: open registration (Guru active, senior roles pending approval), rate limit, legacy accounts, Guru record-only access, staff access, evidence photos, role change, logout, disable, lockout.');
