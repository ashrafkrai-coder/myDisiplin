# Aktifkan profil foto murid

1. Kemas kini `Code.gs` dalam projek Apps Script yang digunakan oleh myDisiplin. Tambah fail skrip `Photos.gs` dan salin kandungannya dari folder ini.
2. Dalam Project Settings → Script Properties, tambah `PHOTO_ACCESS_TOKEN`. Gunakan kod rawak sekurang-kurangnya 24 aksara. Jangan masukkan kod ini ke GitHub atau kod HTML. Kongsi hanya dengan guru yang dibenarkan mengurus foto.
3. Jalankan `photoStudents_` sekali dari editor dan benarkan akses Sheets serta Drive yang diperlukan.
4. Deploy → Manage deployments → Edit → New version → Deploy. Gunakan deployment sedia ada supaya URL aplikasi kekal. Deployment baharu dengan URL berlainan memerlukan kemas kini endpoint dalam `assets/student-photos.js` dan halaman rekod.
5. Buka Profil & Foto Murid, tekan Sambung, masukkan kod akses foto. Kod berada dalam sessionStorage tab pelayar sahaja; tutup tab untuk menamatkan sesi foto.
6. Pilih kelas dan murid. Ambil foto atau muat naik JPEG/PNG/WebP. Foto dipotong di tengah menjadi persegi 320 × 320. Pastikan wajah berada di tengah. Semak foto selepas dimuat naik; foto kabur boleh diganti.
7. Dalam Rekod Kes Baru, tekan foto/nama → Pilih murid ini → tandakan pengesahan → lengkapkan butiran kes → Simpan Rekod. Kelas kekal selepas simpan.

Foto disimpan di folder Drive `myDisiplin Foto Murid` yang dicipta oleh Apps Script. Jangan kongsi folder secara awam. Jika menggunakan PHOTO_FOLDER_ID sendiri, pilih folder persendirian. ID fail disimpan dalam Script Properties, bukan tab Sheets awam. Foto dimuat melalui POST yang mengesahkan kod di pelayan; foto tidak disimpan dalam cache service worker atau localStorage. Semua guru dengan kod foto boleh membaca, mengganti dan memadam foto.

Login asal myDisiplin masih merupakan kawalan dalam pelayar. Kod foto di pelayan adalah kawalan berasingan untuk endpoint baharu. Tiada pengecaman wajah automatik.

Perubahan dalam GitHub tidak mengemas kini deployment Apps Script secara automatik. Langkah 1–4 diperlukan sebelum fungsi baharu boleh digunakan. Foto sebenar dan data murid tidak dimasukkan dalam repositori.
