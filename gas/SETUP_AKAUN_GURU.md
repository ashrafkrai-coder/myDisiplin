# Sediakan akaun guru dan foto murid

Sistem ini menggantikan satu kod akses bersama dengan akaun guru yang mendaftar sendiri.
Semua bacaan dan penulisan data melalui Apps Script, jadi Google Sheet boleh dijadikan **peribadi**.

## A. Kemas kini Apps Script (lakukan SEBELUM menerbitkan halaman baharu)

1. Dalam projek Apps Script yang sama, pastikan ada tiga fail: `Code.gs`, `Photos.gs` dan **`Auth.gs`** (baharu). Salin kandungan daripada folder `gas/`.
2. **Project Settings → Script Properties**, tambah:
   - `REGISTER_CODE`: kod pendaftaran sekolah, sekurang-kurangnya 8 aksara. Beri hanya kepada guru yang dibenarkan. Tanpa kod ini pendaftaran ditutup.
   - Kod `PHOTO_ACCESS_TOKEN` lama tidak lagi digunakan dan boleh dipadam.
3. Jalankan fungsi `guruSheet_` sekali dari editor dan benarkan akses Sheets. Tab `guru` akan dicipta.
4. **Deploy → Manage deployments → Edit → Version: New version → Deploy.** Gunakan deployment sedia ada supaya URL kekal.

> Server lama menganggap sebarang tindakan tidak dikenali sebagai "tambah rekod". Jangan terbitkan halaman baharu ke GitHub Pages sebelum langkah 4 siap.

## B. Selepas deploy

1. Buka `login.html` → tab **Daftar Akaun** → isi nama, username, kata laluan dan kod pendaftaran.
2. Setiap guru mendaftar sendiri. Semua guru melihat semua kelas dan semua murid.
3. Jadikan Google Sheet **peribadi**: Share → General access → *Restricted*. Aplikasi tidak lagi membaca sheet terus.

## Pengurusan akaun (tab `guru`)

| Tindakan | Cara |
|---|---|
| Nyahaktifkan guru | Tukar lajur `status` kepada `tidak aktif`. Berkuat kuasa dalam 5 minit. |
| Aktifkan semula | Tukar `status` kepada `aktif` |
| Guru lupa kata laluan | Padam barisnya; guru mendaftar semula dengan username yang sama |
| Lihat siapa log masuk terakhir | Lajur `login_terakhir` |

Kata laluan disimpan sebagai hash bergaram, bukan teks biasa. Lima percubaan gagal mengunci username selama 15 minit.
Sesi tamat selepas 6 jam. Lajur `dicipta_oleh` dalam tab "Rekod kes baru" merekod username guru yang menaip setiap kes.

## Foto murid

Foto disimpan dalam folder Drive `myDisiplin Foto Murid` (persendirian). ID fail disimpan dalam Script Properties.
Hanya guru yang telah log masuk boleh melihat, memuat naik atau memadam foto. Tiada pengecaman wajah.
