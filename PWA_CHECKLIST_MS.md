# Semakan PWA myDisiplin

## Status semasa
- Manifest lengkap dengan ikon PNG + SVG, `shortcuts`, dan `screenshots`.
- Service worker sudah guna strategi cache pengeluaran (`network-first` + `stale-while-revalidate`).
- Halaman utama menyokong pautan `/?view=kehadiran` dan `/?view=jurnal`.

## Cara uji di komputer ini
Mesin ini belum ada `node`, `npm`, dan `python`, jadi jalankan selepas salah satu runtime dipasang.

1. Pasang Node.js LTS (disyorkan).
2. Jalankan server tempatan:
```powershell
npx serve .
```
3. Buka aplikasi:
`http://localhost:3000`

## Audit Lighthouse (selepas Node dipasang)
```powershell
npx lighthouse http://localhost:3000 --only-categories=pwa --output=html --output-path=./lighthouse-pwa-report.html
```

## Perkara yang perlu lulus
- Installable
- Service worker mengawal halaman
- Manifest sah
- `start_url` boleh dibuka semasa offline
