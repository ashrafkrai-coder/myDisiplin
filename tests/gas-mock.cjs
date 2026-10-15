// In-memory Apps Script environment for running gas/*.gs under Node.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), crypto = require('node:crypto');

function createGas(options = {}) {
  const props = new Map(Object.entries(options.props || {}));
  const cache = new Map();
  const sheets = new Map();
  let uuid = 0;
  const log = { driveWrites: 0, trashed: [], locked: 0 };

  class Sheet {
    constructor(name, rows) { this.name = name; this.rows = rows.map(r => r.slice()); }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
    getDataRange() {
      const self = this, width = this.getLastColumn();
      const grid = () => self.rows.map(r => Array.from({ length: width }, (_, i) => r[i] === undefined ? '' : r[i]));
      return { getValues: grid, getDisplayValues: () => grid().map(r => r.map(String)) };
    }
    getRange(row, col, nRows = 1, nCols = 1) {
      const self = this;
      return {
        getValues: () => Array.from({ length: nRows }, (_, i) => Array.from({ length: nCols }, (_, j) => (self.rows[row - 1 + i] || [])[col - 1 + j] ?? '')),
        setValue: v => { while (self.rows.length < row) self.rows.push([]); self.rows[row - 1][col - 1] = v; }
      };
    }
    appendRow(r) { this.rows.push(r.slice()); }
  }
  for (const [name, rows] of Object.entries(options.sheets || {})) sheets.set(name, new Sheet(name, rows));

  const context = {
    console,
    Object, Array, String, Number, JSON, Math, Date, Error, RegExp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, String(v)), remove: k => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { log.locked++; }, releaseLock: () => { log.locked--; } }) },
    SpreadsheetApp: { openById: () => ({
      getSheetByName: n => sheets.get(n) || null,
      insertSheet: n => { const s = new Sheet(n, []); sheets.set(n, s); return s; }
    }) },
    Session: { getScriptTimeZone: () => 'Asia/Kuala_Lumpur' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ getContent: () => t, setMimeType() { return this; } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, value) => {
        const input = Array.isArray(value) ? Buffer.from(value.map(b => b & 255)) : Buffer.from(String(value), 'utf8');
        return Array.from(crypto.createHash('sha256').update(input).digest()).map(b => b > 127 ? b - 256 : b);
      },
      newBlob: (b, type, name) => (typeof b === 'string' ? { getBytes: () => Array.from(Buffer.from(b, 'utf8')).map(x => x > 127 ? x - 256 : x) } : b),
      base64Decode: s => Array.from(Buffer.from(s, 'base64')),
      base64Encode: b => Buffer.from(b).toString('base64'),
      getUuid: () => crypto.randomUUID(),
      formatDate: () => '2026-01-01 00:00:00'
    },
    DriveApp: {
      createFolder: () => ({ getId: () => 'folder', createFile: () => { log.driveWrites++; return { getId: () => 'file' + (++uuid) }; } }),
      getFolderById: () => ({ createFile: () => { log.driveWrites++; return { getId: () => 'file' + (++uuid) }; } }),
      getFileById: id => ({ getBlob: () => ({ getBytes: () => [255, 216, 255, 217] }), setTrashed: () => { log.trashed.push(id); } })
    }
  };
  vm.createContext(context);
  for (const f of options.files || ['Auth.gs', 'Photos.gs', 'Code.gs']) {
    const src = fs.readFileSync(path.join(__dirname, '../gas', f), 'utf8');
    // `const` at top level of a script is not a property of the context object; expose via var.
    vm.runInContext(src.replace(/^const /gm, 'var '), context);
  }

  const post = body => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  return { context, props, cache, sheets, log, post, Sheet };
}

const STUDENTS = [
  ['BIL', 'NAMA', 'NO. KAD PENGENALAN', ' KELAS'],
  ['1', 'MURID UJIAN', '090101010001', '1 AL-FARABI'],
  ['2', 'MURID DUA', '100202020002', '2 AMANAH']
];
const CASES = [
  ['id', 'no_kp', 'tarikh', 'masa', 'nama', 'kelas', 'jenis_kesalahan', 'kategori', 'catatan', 'status', 'dicipta_pada'],
  ['1', '090101010001', '29/3/2026', '7:37:42 PG', 'MURID UJIAN', '1 AL-FARABI', 'KEKEMASAN DIRI', 'Ringan', 'Rambut', 'Selesai', '2026-03-29 07:37:42']
];

module.exports = { createGas, STUDENTS, CASES };
