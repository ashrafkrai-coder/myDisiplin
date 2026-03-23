# Setup Google Apps Script (Rekod Kes Baru)

1. Buka Google Sheet anda (ID: `1n3_wQUNOO1iW8mFc-etoncKfuda4Ce94pusKv6s2vRs`).
2. Pergi ke `Extensions` -> `Apps Script`.
3. Buang kod sedia ada dalam `Code.gs`, kemudian tampal kandungan fail `gas/Code.gs`.
4. Klik `Deploy` -> `New deployment` -> jenis `Web app`.
5. Tetapan deployment:
   - Execute as: `Me`
   - Who has access: `Anyone`
6. Klik `Deploy`, kemudian salin `Web app URL`.
7. Dalam fail `rekod-kes-baru.html`, isi nilai `GAS_ENDPOINT` dengan URL tadi.

Contoh:

```js
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycb.../exec";
```

Nota:
- Data akan ditulis ke tab `Rekod kes baru`.
- Jika tab belum wujud, script akan cipta tab automatik.
- Header akan dibuat automatik pada rekod pertama.
