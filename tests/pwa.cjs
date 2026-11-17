// Ujian ringkas PWA: manifest, ikon, service worker (dengan cache/fetch tiruan) dan semakan statik halaman.
// Jalankan: node tests/pwa.cjs   (keluar dengan kod 1 jika ada semakan GAGAL)
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const results = [];
const check = (name, ok, info = '') => results.push({ name, ok: !!ok, info });
const pngSize = f => { const b = fs.readFileSync(path.join(ROOT, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

// --- Manifest ---
const m = JSON.parse(read('manifest.webmanifest'));
check('Manifest: name, short_name, start_url, scope, display', m.name && m.short_name && m.start_url && m.scope && m.display === 'standalone');
check('Manifest: ikon 192 & 512 serta maskable', ['192x192', '512x512'].every(s => m.icons.some(i => i.sizes === s)) && m.icons.some(i => i.purpose === 'maskable'));
for (const i of [...m.icons, ...m.screenshots]) {
  const [w, h] = pngSize(i.src);
  check(`Manifest: saiz sebenar ${i.src} = ${i.sizes}`, `${w}x${h}` === i.sizes, `${w}x${h}`);
}
check('Manifest: shortcut & share_target menuju fail yang wujud',
  [...m.shortcuts.map(s => s.url.split('#')[0] || 'index.html'), m.share_target.action].every(u => fs.existsSync(path.join(ROOT, u.replace('./', '') || 'index.html'))));
check('Manifest: orientation tidak mengunci potret (ada layout desktop & screenshot landskap)', m.orientation !== 'portrait', `orientation=${m.orientation}`);

// --- Saiz aset ---
const logoKB = fs.statSync(path.join(ROOT, 'icons/logo-sekolah.png')).size / 1024 | 0;
check('Aset: logo-sekolah.png < 200 KB (dipaparkan 58-76px, dipra-cache)', logoKB < 200, `${logoKB} KB, ${pngSize('icons/logo-sekolah.png').join('x')}`);

// --- Service worker dalam sandbox ---
function loadSw({ online = true } = {}) {
  const stores = new Map(); const listeners = {}; const abs = r => new URL(typeof r === 'string' ? r : r.url, 'https://app.test/').href;
  const store = name => { if (!stores.has(name)) stores.set(name, new Map()); const s = stores.get(name);
    return { addAll: async urls => urls.forEach(u => s.set(abs(u), { ok: true, url: abs(u), clone() { return this; } })),
      put: async (req, res) => s.set(abs(req), res) }; };
  const caches = { open: async n => store(n), keys: async () => [...stores.keys()], delete: async n => stores.delete(n),
    match: async req => { const k = abs(req); for (const s of stores.values()) if (s.has(k)) return s.get(k); } };
  const fetch = async req => { if (!online) throw new TypeError('offline'); const url = typeof req === 'string' ? req : req.url; return { ok: !url.includes('404'), status: url.includes('404') ? 404 : 200, url, clone() { return this; } }; };
  const self = { location: { origin: 'https://app.test' }, addEventListener: (t, fn) => (listeners[t] = fn), skipWaiting() {}, clients: { claim() {} } };
  const ctx = vm.createContext({ self, caches, fetch, URL, Promise, console, Response });
  vm.runInContext(read('sw.js'), ctx);
  const dispatch = async req => { let p; listeners.fetch({ request: { method: 'GET', ...req }, respondWith: x => (p = x) }); return p === undefined ? 'TIDAK-DIURUS' : p; };
  return { stores, listeners, dispatch, ctx };
}
const swSrc = read('sw.js');
const precache = vm.runInNewContext(swSrc.match(/const STATIC_ASSETS = (\[[\s\S]*?\]);/)[1]);
const missing = precache.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
check('SW: semua fail STATIC_ASSETS wujud (cache.addAll tidak gagal)', missing.length === 0, missing.join(', '));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !f.startsWith('google'));
const notCached = pages.filter(p => !precache.includes(p));
check('SW: semua halaman HTML dipra-cache', notCached.length === 0, notCached.join(', '));

(async () => {
  {
    const sw = loadSw({ online: false });
    await sw.listeners.install({ waitUntil: p => p });
    await new Promise(r => setTimeout(r, 0));
    const res = await sw.dispatch({ url: 'https://app.test/index.html', mode: 'navigate' });
    check('SW offline: navigasi ke halaman dipra-cache dilayan dari cache', res && res.url === 'https://app.test/index.html', JSON.stringify(res && res.url));
    const off = await sw.dispatch({ url: 'https://app.test/tiada.html', mode: 'navigate' });
    check('SW offline: halaman tidak dicache -> offline.html', off && off.url === 'https://app.test/offline.html');
    const q = await sw.dispatch({ url: 'https://app.test/rekod-kes-baru.html?nama=ALI&nokp=090101010001', mode: 'navigate' });
    check('SW offline: halaman dengan parameter carian tetap dilayan dari cache', q && q.url === 'https://app.test/rekod-kes-baru.html', JSON.stringify(q && q.url));
    const asset = await sw.dispatch({ url: 'https://app.test/assets/baru.js', mode: 'no-cors' });
    check('SW offline: aset tidak dicache memulangkan Response 503 (bukan undefined)', asset && asset.status === 503, `dapat ${asset}`);
  }
  {
    const sw = loadSw({ online: true });
    await sw.dispatch({ url: 'https://app.test/rekod-kes-baru.html?nama=ALI&nokp=090101010001', mode: 'navigate' });
    await sw.dispatch({ url: 'https://app.test/hilang-404.html', mode: 'navigate' });
    const runtime = [...sw.stores.entries()].find(([k]) => k.includes('runtime'));
    const keys = runtime ? [...runtime[1].keys()] : [];
    check('SW: URL navigasi dengan No KP murid tidak disimpan dalam cache', !keys.some(k => /nokp=\d/.test(k)), keys.join(', '));
    check('SW: respons 404 tidak dicache', !keys.some(k => k.includes('404')));
    const ext = await sw.dispatch({ url: 'https://script.google.com/macros/s/x/exec', mode: 'cors' });
    check('SW: permintaan ke Apps Script (luar origin) tidak diintersep', ext === 'TIDAK-DIURUS');
  }

  // --- Semakan statik halaman ---
  for (const p of pages) {
    const html = read(p);
    if (p !== 'offline.html') check(`${p}: ada <link rel="manifest"> & theme-color`, /rel="manifest"/.test(html) && /theme-color/.test(html));
  }
  check('offline.html: bahasa Melayu (lang="ms")', /<html[^>]* lang="ms"/.test(read('offline.html')), 'lang="id", teks Bahasa Indonesia');
  const idx = read('index.html');
  for (const id of ['install-status']) check(`index.html: elemen #${id} yang dirujuk skrip wujud`, idx.includes(`id="${id}"`));
  check('index.html: input carian ada <label>/aria-label', !/<input id="student-name"[^>]*placeholder/.test(idx) || /for="student-name"|aria-label/.test(idx.split('student-search-form')[1].split('</form>')[0]));
  const rk = read('rekod-kes-baru.html');
  check('rekod-kes-baru: tarikh lalai ikut waktu tempatan (bukan toISOString/UTC)', !/tarikhEl\.value = new Date\(\)\.toISOString/.test(rk));
  const sk = read('senarai-kes.html');
  check('senarai-kes: pilihan kategori di-escape', !/<option value="\$\{cat\}">\$\{cat\}<\/option>/.test(sk));
  // Mod gelap hanya menukar nilai token, jadi tiada kotak yang tertinggal putih.
  const themeCss = read('assets/theme.css');
  check('theme.css: tidak mewarnakan #search-output/#list-container secara tetap', !/#search-output|#list-container/.test(themeCss));

  // --- Keseragaman reka bentuk: satu sistem (assets/theme.css) untuk semua halaman ---
  for (const p of pages) {
    const html = read(p);
    const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
    const problems = [];
    if (!/href="assets\/theme\.css"/.test(html)) problems.push('tiada theme.css');
    if (!/<html class="ios-ui"/.test(html)) problems.push('tiada class ios-ui');
    if (!/name="theme-color" content="#0f2744"/.test(html)) problems.push('theme-color lain');
    if (/:root\s*\{/.test(css)) problems.push('takrif token sendiri');
    if (/font-family:/.test(css)) problems.push('fon sendiri');
    if (/#0f766e|17px\/1/.test(css)) problems.push('warna/saiz lama');
    check(`${p}: guna sistem reka bentuk yang sama`, !problems.length, problems.join(', '));
  }
  check('Manifest: theme_color sama dengan halaman', m.theme_color === '#0f2744', m.theme_color);

  // --- Laporan ---
  const fail = results.filter(r => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'LULUS' : 'GAGAL'}  ${r.name}${r.info && !r.ok ? '  [' + r.info + ']' : ''}`);
  console.log(`\nJumlah: ${results.length}, Lulus: ${results.length - fail.length}, Gagal: ${fail.length}`);
  process.exitCode = fail.length ? 1 : 0;
})();
