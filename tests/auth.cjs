const assert = require('node:assert/strict');
const { createGas, STUDENTS, CASES } = require('./gas-mock.cjs');

const REG = 'kod-sekolah-2026';
const gas = createGas({ props: { REGISTER_CODE: REG }, sheets: { data: STUDENTS, 'Rekod kes baru': CASES } });
const { post, sheets, props, cache } = gas;
const good = { username: 'cikgu.aini', nama: 'Aini Binti Ali', password: 'RahsiaBesar1', kodDaftar: REG };

// --- Registration ---
let r = post({ action: 'register', ...good, kodDaftar: 'salah' });
assert.equal(r.ok, false); assert.match(r.error, /Kod pendaftaran/);
assert.equal(sheets.has('guru'), false, 'wrong code must not create the guru tab');
for (const bad of [{ username: 'AB' }, { username: 'a b c' }, { nama: 'Al' }, { password: 'pendek' }]) {
  r = post({ action: 'register', ...good, ...bad });
  assert.equal(r.ok, false, JSON.stringify(bad));
}
r = post({ action: 'register', ...good });
assert.equal(r.ok, true); assert.match(r.session, /^[a-f0-9]{64}$/); assert.equal(r.username, 'cikgu.aini');
const guruRows = sheets.get('guru').rows;
assert.equal(guruRows.length, 2);
assert.ok(!guruRows[1].includes(good.password), 'password must not be stored in plain text');
assert.equal(guruRows[1][4], 'aktif');
r = post({ action: 'register', ...good, username: 'CIKGU.AINI' });
assert.equal(r.ok, false); assert.match(r.error, /sudah digunakan/);

// Registration closed when the code is not configured or too short.
const closed = createGas({ sheets: { data: STUDENTS } });
assert.match(closed.post({ action: 'register', ...good }).error, /belum dibuka/);

// --- Login ---
r = post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
assert.equal(r.ok, true);
const session = r.session;
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'salah' }).ok, false);
assert.equal(post({ action: 'login', username: 'tiada.orang', password: 'x' }).error, 'Username atau kata laluan tidak sah.');
assert.equal(post({ action: 'login', username: 'cikgu.aini', password: 'salah' }).error, 'Username atau kata laluan tidak sah.',
  'wrong password and unknown user must give the same message');

// --- Every non-auth action needs a session ---
for (const action of ['sheet_table', 'photo_students', 'photo_batch', 'photo_cases', 'photo_save', 'photo_delete', 'update_status', 'append']) {
  r = post({ action, tab: 'data', noKps: [] });
  assert.equal(r.ok, false, action); assert.equal(r.code, 'SESSION', action);
}
r = post({ action: 'sheet_table', tab: 'data', session: 'f'.repeat(64) });
assert.equal(r.code, 'SESSION', 'unknown session must be rejected');

// --- Data reads ---
r = post({ action: 'sheet_table', tab: 'data', session });
assert.equal(r.ok, true); assert.equal(r.rows.length, 2); assert.equal(r.headers[1], 'NAMA');
r = post({ action: 'sheet_table', tab: 'Rekod kes baru', session });
assert.equal(r.rows[0][4], 'MURID UJIAN');
r = post({ action: 'sheet_table', tab: 'guru', session });
assert.equal(r.ok, false, 'guru tab (hashes) must never be readable');
assert.match(r.error, /tidak dibenarkan/);

// --- Writes record who typed them, and cannot redirect to another sheet/tab ---
r = post({ action: 'append', session, noKp: '100202020002', nama: 'MURID DUA', kelas: '2 AMANAH', tarikh: '2026-10-15', masa: '08:00',
  jenisKesalahan: 'Lewat', kategori: 'Ringan', catatan: 'x', status: 'Dalam Semakan', sheetId: 'orang-lain', tab: 'guru' });
assert.equal(r.ok, true); assert.equal(r.tab, 'Rekod kes baru');
const caseRows = sheets.get('Rekod kes baru').rows;
assert.equal(caseRows[0][11], 'dicipta_oleh', 'legacy header gains the recorder column');
assert.equal(caseRows[2][11], 'cikgu.aini');
assert.equal(sheets.get('guru').rows.length, 2, 'payload.tab must not redirect writes');
r = post({ action: 'update_status', session, rowNumber: 2, status: 'Dalam Semakan' });
assert.equal(r.ok, true); assert.equal(caseRows[1][9], 'Dalam Semakan');
assert.equal(post({ action: 'update_status', session, rowNumber: 1, status: 'x' }).ok, false);

// --- Photos work with a session and fail without ---
r = post({ action: 'photo_students', session });
assert.equal(r.ok, true); assert.equal(r.students.length, 2);

// --- Logout ends the session ---
assert.equal(post({ action: 'logout', session }).ok, true);
assert.equal(post({ action: 'sheet_table', tab: 'data', session }).code, 'SESSION');

// --- Disabling an account ends its sessions (after the 5 minute active-check cache) ---
r = post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
const s2 = r.session;
assert.equal(post({ action: 'sheet_table', tab: 'data', session: s2 }).ok, true);
sheets.get('guru').rows[1][4] = 'tidak aktif';
cache.delete('act_cikgu.aini'); // simulate the 5 minute re-check
assert.equal(post({ action: 'sheet_table', tab: 'data', session: s2 }).code, 'SESSION');
assert.match(post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' }).error, /tidak aktif/);
sheets.get('guru').rows[1][4] = 'aktif';

// --- Brute force lock ---
const lock = createGas({ props: { REGISTER_CODE: REG }, sheets: { data: STUDENTS } });
lock.post({ action: 'register', ...good });
for (let i = 0; i < 5; i++) lock.post({ action: 'login', username: 'cikgu.aini', password: 'salah' + i });
r = lock.post({ action: 'login', username: 'cikgu.aini', password: 'RahsiaBesar1' });
assert.equal(r.ok, false); assert.match(r.error, /Terlalu banyak/, 'correct password must be refused while locked');

console.log('PASS auth: register validation, hashed storage, login, session gate on every action, tab whitelist, write attribution, logout, disable, lockout.');
