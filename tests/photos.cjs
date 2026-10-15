const assert = require('node:assert/strict');
const { createGas, STUDENTS, CASES } = require('./gas-mock.cjs');

const REG = 'kod-sekolah-2026';
const gas = createGas({ props: { REGISTER_CODE: REG }, sheets: { data: STUDENTS, 'Rekod kes baru': CASES } });
const { post, props, cache, log } = gas;
const session = post({ action: 'register', username: 'cikgu.foto', nama: 'Cikgu Foto', password: 'RahsiaBesar1', kodDaftar: REG }).session;
const call = p => post({ session, ...p });
const JPEG = 'data:image/jpeg;base64,/9j/2Q==';

// Session is required for every photo action.
assert.equal(post({ action: 'photo_students' }).code, 'SESSION');
assert.equal(post({ action: 'photo_save', noKp: '090101010001', data: JPEG }).code, 'SESSION');
assert.equal(log.driveWrites, 0);

// Roster: trimmed headers, leading-zero ID.
const roster = call({ action: 'photo_students' }).students;
assert.equal(roster[0].noKp, '090101010001');
assert.equal(roster[0].kelas, '1 AL-FARABI');
const id = roster[0].noKp;

// Validation.
assert.match(call({ action: 'photo_save', noKp: 'unknown', data: 'x' }).error, /tidak ditemui/);
assert.match(call({ action: 'photo_save', noKp: id, data: 'data:image/jpeg;base64,AAAA' }).error, /JPEG/);
assert.match(call({ action: 'photo_save', noKp: id, data: 'data:image/jpeg;base64,' + 'a'.repeat(150000) }).error, /saiz/);
assert.match(call({ action: 'photo_save', noKp: id, data: 'data:image/png;base64,AAAA' }).error, /Format/);
assert.equal(log.locked, 0, 'lock released after failures');

// Save / list; class matching ignores case, spaces and hyphens.
assert.equal(call({ action: 'photo_save', noKp: id, data: JPEG }).ok, true);
assert.ok(props.get('photo_' + id));
assert.equal(call({ action: 'photo_list', kelas: '1 AL-FARABI' }).photos[id], JPEG);
assert.ok(call({ action: 'photo_list', kelas: '1 al farabi' }).photos[id], 'class names compare normalized');
assert.equal(Object.keys(call({ action: 'photo_list', kelas: '2 AMANAH' }).photos).length, 0);

// Batch path: no roster needed, rejects bad IDs, uses cache.
const batch = call({ action: 'photo_batch', noKps: [id, '../x', '111111111111'] }).photos;
assert.deepEqual(Object.keys(batch), [id]);
assert.ok([...cache.keys()].some(k => k.startsWith('ph_')));

// Replacing a photo trashes the previous Drive file.
const before = props.get('photo_' + id);
assert.equal(call({ action: 'photo_save', noKp: id, data: JPEG }).ok, true);
assert.notEqual(props.get('photo_' + id), before);
assert.ok(log.trashed.includes(before));

// Case records for the profile card, matched on IC.
const cases = call({ action: 'photo_cases', noKp: id });
assert.equal(cases.cases.length, 1);
assert.equal(cases.cases[0].jenis, 'KEKEMASAN DIRI');
assert.equal(cases.student.nama, 'MURID UJIAN');
assert.equal(call({ action: 'photo_cases', noKp: roster[1].noKp }).cases.length, 0);

// Delete is idempotent and tolerates a Drive file that is already gone.
gas.context.DriveApp.getFileById = () => { throw new Error('not found'); };
assert.equal(call({ action: 'photo_delete', noKp: id }).ok, true);
assert.ok(!props.has('photo_' + id));
assert.equal(call({ action: 'photo_delete', noKp: id }).ok, true);
assert.equal(log.locked, 0);

console.log('PASS photos: session gate, roster, validation, save/list/batch/cache, replace, cases, delete.');
