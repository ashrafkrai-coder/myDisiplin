# Sediakan akaun, peranan dan gambar bukti kes

Setiap pengguna mendaftar sendiri mengikut peranan, tanpa kod pendaftaran. Semua bacaan dan penulisan data melalui Apps Script,
jadi Google Sheet boleh dijadikan **peribadi**.

## Peranan dan akses

| Peranan | Selepas daftar | Akses |
|---|---|---|
| Guru | Terus aktif | **Rekod Kes Baru sahaja** (termasuk muat naik gambar bukti) |
| Guru Disiplin | `menunggu` kelulusan pentadbir | Semua: Utama, Rekod Kes, Senarai Kes, Dashbord, Profil Murid, tukar status, lihat gambar bukti |
| PK HEM | `menunggu` kelulusan pentadbir | Sama seperti Guru Disiplin |
| Pengetua | `menunggu` kelulusan pentadbir | Sama seperti Guru Disiplin |

**Meluluskan akaun:** dalam tab `guru`, tukar lajur `status` akaun itu daripada `menunggu` kepada `aktif` (dropdown).
Pendaftaran terbuka dihadkan kepada 30 akaun baharu sejam untuk menyekat pendaftaran automatik.

Had akses dikuatkuasakan di pelayan (Apps Script), bukan sekadar disembunyikan pada skrin.

## A. Kemas kini Apps Script (lakukan SEBELUM menerbitkan halaman baharu)

1. Dalam projek Apps Script, fail mestilah: `Code.gs`, `Auth.gs`, **`Students.gs`**, **`Evidence.gs`** dan **`Diagnostik.gs`** (tiga terakhir baharu).
   Salin kandungan daripada folder `gas/`. **Padam fail `Photos.gs`**; fungsi foto murid telah dibuang.
2. **Project Settings → Script Properties** (pilihan, pembersihan): `REGISTER_CODE`, `PHOTO_FOLDER_ID` dan semua property `photo_...` tidak lagi digunakan dan boleh dipadam.
3. **Deploy → Manage deployments → Edit → Version: New version → Deploy.** Gunakan deployment sedia ada supaya URL kekal.
   Kali pertama gambar bukti dimuat naik, Google akan meminta kebenaran Drive. Pemilik skrip perlu benarkan.

## B. Akaun sedia ada

- Tab `guru` mendapat lajur baharu `peranan` secara automatik. Akaun lama tanpa peranan dikira **Guru**.
- Untuk menaikkan peranan akaun sedia ada: taip `Guru Disiplin`, `PK HEM` atau `Pengetua` dalam lajur `peranan`. Berkuat kuasa dalam 5 minit.
- Semua pengguna perlu log masuk semula sekali selepas kemas kini ini.

## Pengurusan akaun (tab `guru`)

| Tindakan | Cara |
|---|---|
| Luluskan Guru Disiplin / PK HEM / Pengetua | Tukar `status` daripada `menunggu` kepada `aktif` |
| Tukar peranan | Ubah lajur `peranan` (dropdown) |
| Nyahaktifkan pengguna | Tukar lajur `status` kepada `tidak aktif`. Berkuat kuasa dalam 5 minit. |
| Aktifkan semula | Tukar `status` kepada `aktif` |
| Lupa kata laluan | Padam barisnya; pengguna mendaftar semula dengan username yang sama |
| Lihat log masuk terakhir | Lajur `login_terakhir` |

Kata laluan disimpan sebagai hash bergaram. Lima percubaan gagal mengunci username selama 15 minit. Sesi tamat selepas 6 jam.

## Gambar bukti kes

- Dalam **Rekod Kes Baru → Butiran Kes**, tekan **Ambil Gambar** (kamera) atau **Pilih dari Galeri**. Maksimum 3 gambar bagi setiap kes.
  Gambar dikecilkan (maksimum 1280px, JPEG) sebelum dihantar.
- Gambar disimpan dalam folder Drive peribadi `myDisiplin Bukti Kes`. ID fail ditulis dalam lajur `bukti` tab "Rekod kes baru".
- Hanya Guru Disiplin, PK HEM dan Pengetua boleh melihatnya: **Senarai Kes → Lihat Gambar Bukti**.
- Lajur `dicipta_oleh` merekod username yang menaip setiap kes.

## Uji sambungan

Dalam editor Apps Script, pilih fungsi **`ujiSambungan`** → **Run** → buka **Execution log**.
Ia menyemak Google Sheet, tab dan header, senarai murid, akaun dan peranan (termasuk akaun yang menunggu kelulusan) dan folder Drive gambar bukti.
Setiap baris bertanda `LULUS` atau `GAGAL` dengan sebabnya.
