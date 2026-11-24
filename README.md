# SIMANTAP — Simulator Manajemen Aset Negara

Aplikasi web simulasi untuk praktikum Mata Kuliah **Manajemen Barang Milik Negara**,
Prodi Akuntansi Sektor Publik, Politeknik Negeri Sambas. Mahasiswa berperan sebagai
Kuasa Pengguna Barang pada satker simulasi; dosen berperan sebagai Pengelola Barang.

> Aplikasi pembelajaran — bukan sistem resmi pengelolaan BMN. Seluruh data adalah data latihan.

## Menjalankan

1. Buat project di [Firebase Console](https://console.firebase.google.com), aktifkan
   **Authentication → Email/Password** dan **Google**, lalu tambahkan domain aplikasi di
   **Authentication → Settings → Authorized domains**, serta **Firestore** (named database `siman`, region `asia-southeast2`/`asia-southeast1`).
2. `cp .env.example .env.local` lalu isi kredensial web app.
3. `npm install && npm run dev`
4. Terapkan aturan keamanan dan indeks: `firebase use <project-id>` lalu
   `firebase deploy --only firestore:rules,firestore:indexes`.
5. Dosen awal (`mujiburrohman319@gmail.com`, diatur di `src/lib/akses.js` dan `firestore.rules`) cukup mendaftar
   di halaman masuk lalu memverifikasi email; peran Pengelola Barang aktif otomatis. Dosen lain diatur di menu **Pengguna**.
6. Sebagai dosen: menu **Kelas & Satker** → buat kelas → tambah satker → tambah email mahasiswa → *Isi data contoh*.

Deploy:
- **Firebase App Hosting** (otomatis dari GitHub `main`): App Hosting menjalankan `npm run build` lalu `npm start`
  (`server.js` menyajikan `dist/` di `$PORT`). Konfigurasi web Firebase diambil otomatis dari `FIREBASE_WEBAPP_CONFIG`;
  nama database diatur di `apphosting.yaml`. Pastikan backend App Hosting terhubung ke web app di proyek yang sama.
- **Firebase Hosting** (statis): `npm run build && firebase deploy --only hosting`.

## Pengujian

- `npm test`: uji logika domain (cepat, tanpa Firebase).
- `npm run test:emulator`: uji aturan keamanan (`firestore.rules`) dan alur end-to-end
  (`src/lib/db.js` asli) terhadap Firebase Emulator. Membutuhkan Java 11+; emulator diunduh otomatis saat pertama kali dijalankan.
  Jalankan setiap kali mengubah `firestore.rules` atau `src/lib/db.js`, sebelum `firebase deploy`.

### Mencoba aplikasi tanpa proyek Firebase

1. `npm run emulators` (Auth + Firestore lokal; antarmuka emulator di http://127.0.0.1:4000).
2. Isi `.env.local` dengan `VITE_FIREBASE_API_KEY=demo`, `VITE_FIREBASE_PROJECT_ID=demo-simantap`,
   `VITE_FIRESTORE_DB=siman`, `VITE_USE_EMULATOR=true`, lalu `npm run dev` di terminal lain.
3. Daftar akun, lalu ubah `role` menjadi `pengelola` lewat antarmuka emulator (tab Firestore).
   Data emulator hilang saat emulator dimatikan.

## Fitur utama

- Penatausahaan: Daftar Aset & KIB, 29 jenis transaksi, persediaan (FIFO, opname), inventarisasi, LBKP, Neraca BMN, DBR, ekspor Excel/PDF.
- Pengawasan: wasdal otomatis dengan skor kepatuhan; rekonsiliasi SIMAK–SAKTI dengan Berita Acara.
- Perencanaan & pengelolaan: RKBMN (reviu APIP, penelaahan, usulan perubahan), usulan pengelolaan 13 jenis.
- Pembelajaran: skenario kasus dengan kunci jawaban, penilaian otomatis per rubrik Sub-CPMK, rekap nilai Excel.
- Lampiran dokumen sumber & foto (≤2 MB, disimpan di Firestore); impor kodefikasi barang resmi dari CSV (menu Referensi).

## Alur praktikum

| Pertemuan | Menu |
| --- | --- |
| 7–8 Perencanaan kebutuhan | RKBMN → reviu APIP → Penelaahan (dosen) |
| 10–11 Penatausahaan | Transaksi BMN, Daftar Aset & KIB, Inventarisasi, Laporan (LBKP/DBKP/DBR) |
| 12 Penggunaan & pemanfaatan | Usulan PSP/sewa/pinjam pakai → Buku PNBP |
| 13–14 Pemindahtanganan & penghapusan | Koreksi kondisi → Usulan penghapusan/hibah → SK simulasi → transaksi otomatis |

Detail arsitektur dan backlog: lihat `CLAUDE.md`.
