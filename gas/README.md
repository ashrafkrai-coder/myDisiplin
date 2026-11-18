# Sediakan Google Apps Script

1. Buka Google Sheet (ID: `1n3_wQUNOO1iW8mFc-etoncKfuda4Ce94pusKv6s2vRs`).
2. Pergi ke **Extensions → Apps Script**.
3. Buka `Code.gs`, padam semua kandungannya, kemudian tampal **keseluruhan** fail `gas/Code.gs`.
   Semua kod pelayan ada dalam fail ini sahaja. Padam fail `.gs` lain jika ada.
4. Tekan **Simpan**.
5. Deployment pertama: **Deploy → New deployment →** jenis **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   Kemas kini seterusnya: **Deploy → Manage deployments → Edit → New version → Deploy** (URL kekal sama).
6. Salin **Web app URL** dan letakkan dalam `ENDPOINT` di `assets/auth.js`.
7. Buka URL itu dalam pelayar: mesti memaparkan `"versi"` terkini dan `"tiada":[]`.

Panduan penuh (peranan, kelulusan akaun, gambar bukti, uji sambungan): [SETUP_AKAUN_GURU.md](SETUP_AKAUN_GURU.md).
