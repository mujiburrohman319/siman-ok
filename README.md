# SIMANTAP — Simulator Manajemen Aset Negara

Aplikasi web simulasi untuk praktikum Mata Kuliah **Manajemen Barang Milik Negara**,
Prodi Akuntansi Sektor Publik, Politeknik Negeri Sambas. Mahasiswa berperan sebagai
Kuasa Pengguna Barang pada satker simulasi; dosen berperan sebagai Pengelola Barang.

> Aplikasi pembelajaran — bukan sistem resmi pengelolaan BMN. Seluruh data adalah data latihan.

## Menjalankan

1. Buat project di [Firebase Console](https://console.firebase.google.com), aktifkan
   **Authentication → Email/Password** dan **Firestore** (named database `siman-simulasi`, region `asia-southeast2`/`asia-southeast1`).
2. `cp .env.example .env.local` lalu isi kredensial web app.
3. `npm install && npm run dev`
4. Terapkan aturan keamanan dan indeks: `firebase use <project-id>` lalu
   `firebase deploy --only firestore:rules,firestore:indexes`.
5. Daftar akun pertama, lalu ubah `users/{uid}.role` menjadi `pengelola` di Firestore Console.
6. Sebagai dosen: menu **Kelas & Satker** → buat kelas → tambah satker → tambah email mahasiswa → *Isi data contoh*.

Deploy hosting: `npm run build && firebase deploy --only hosting` (atau Firebase App Hosting).

## Alur praktikum

| Pertemuan | Menu |
| --- | --- |
| 7–8 Perencanaan kebutuhan | RKBMN → reviu APIP → Penelaahan (dosen) |
| 10–11 Penatausahaan | Transaksi BMN, Daftar Aset & KIB, Inventarisasi, Laporan (LBKP/DBKP/DBR) |
| 12 Penggunaan & pemanfaatan | Usulan PSP/sewa/pinjam pakai → Buku PNBP |
| 13–14 Pemindahtanganan & penghapusan | Koreksi kondisi → Usulan penghapusan/hibah → SK simulasi → transaksi otomatis |

Detail arsitektur dan backlog: lihat `CLAUDE.md`.
