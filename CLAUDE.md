# SIMANTAP — catatan untuk Claude Code

Simulator Manajemen Aset Negara untuk praktikum MK Manajemen Barang Milik Negara,
Prodi Akuntansi Sektor Publik, Politeknik Negeri Sambas. Meniru alur kerja SIMAN untuk
pembelajaran; **bukan** sistem resmi, tanpa logo/branding Kemenkeu atau DJKN.

PRD: https://claude.ai/artifact/Dkqb4L4oJzxDpCyAphfJHv

## Perintah

```bash
npm install
cp .env.example .env.local   # isi kredensial Firebase
npm run dev                  # http://localhost:5173
npm test                     # uji logika domain (node:test, tanpa Firebase)
npm run test:emulator        # uji firestore.rules + alur end-to-end db.js di Firebase Emulator (butuh Java)
npm run emulators            # Auth + Firestore lokal; app memakainya bila VITE_USE_EMULATOR=true
npm run build
firebase deploy --only firestore:rules,firestore:indexes   # setelah `firebase use <project>`
```

## Stack dan prinsip

- React 18 + Vite 6 + Tailwind 4, react-router 6, lucide-react.
- Firebase Auth (email/kata sandi) + Cloud Firestore named database `siman-simulasi`.
- **100% online**: Firestore satu-satunya sumber data. Jangan menambah localStorage/mode offline untuk data.
- Antarmuka dan istilah berbahasa Indonesia, mengikuti PP 27/2014 jo. PP 28/2020, PMK 150/2014, PMK 181/2016.
- Label "Aplikasi Simulasi Pembelajaran" harus tetap tampil di setiap halaman.

## Peta kode

| Path | Isi |
| --- | --- |
| `src/lib/bmn.js` | **Logika domain murni** (tanpa Firebase): jenis transaksi, kapitalisasi, penyusutan, LBKP, aturan RKBMN, aksi persetujuan usulan. Semua aturan bisnis baru masuk ke sini dan diuji di `tests/`. |
| `src/lib/db.js` | Penulisan Firestore. `catatTransaksi()` memakai `runTransaction` agar aset dan Buku Barang selalu konsisten. |
| `src/lib/auth.jsx` | Login, profil `users/{uid}`, peran, referensi aktif (`referensi/config` digabung dengan `REFERENSI_DEFAULT`). |
| `src/lib/satker.jsx` | Satker aktif (mahasiswa: miliknya; dosen: dipilih di header) + langganan realtime aset & transaksi. |
| `src/data/kodeBarang.js` | Kodefikasi barang **contoh**, masa manfaat contoh, jenis KIB. |
| `src/data/kib.js` | Field KIB per jenis. |
| `src/pages/*` | Dashboard, Aset/KIB, Transaksi (Buku Barang), Inventarisasi, Laporan (LBKP, DBKP, Intra/Ekstra, DBR, RB/Hilang, PNBP), RKBMN, Usulan, Telaah (dosen), Kelas, Referensi. |
| `firestore.rules` | Keamanan per peran. Transaksi tidak bisa diubah/dihapus (jejak audit). |

## Model data Firestore

```
users/{uid}            nama, nim, email, role: kpb|pengelola|admin, kelasId, satkerId
kelas/{id}             nama, mk, tahunAkademik, semester, dosenUid
referensi/config       batasKapitalisasi{peralatan,gedung}, batasPemeliharaan, sbsk[]
satker/{id}            kode, nama, kelasId, anggota[uid], apipUids[uid]
  aset/{id}            kodeBarang, nup, namaBarang, merk, nilai, tglPerolehan, kondisi B|RR|RB,
                       status aktif|rusak_berat|hilang|dihentikan|dihapus, statusPenggunaan, trxTerakhir,
                       pemanfaatan{}, intrakomptabel, bersejarah, lokasiRuang, kib{}
  transaksi/{id}       jenis, tanggal, asetId, efek[{akun,nilai}], dokumen{jenis,nomor}, dibuatOleh
  rkbmn/{tahun-jenis}  status draft→reviu_apip→diajukan→disetujui|dikembalikan, baris[], reviuApip, telaah, tandaTangan[]
  usulan/{id}          jenis, asetIds[], status diajukan|disetujui|ditolak, nomorSK
  inventarisasi/{id}   jenis sensus|opname_kdp, hasil{asetId:{ditemukan,kondisi}}, status
  pnbp/{id}            sumber, nilai, nomorSK
```

Catatan: PRD menulis `kelas/{k}/satker/{s}`; implementasi memakai koleksi `satker` tingkat atas
dengan field `kelasId` agar aturan keamanan dan query lebih sederhana.

## Aturan penting (jangan dilanggar)

1. Nilai, kondisi, dan status aset **hanya** berubah lewat `catatTransaksi()` → `terapkanTransaksi()`.
   Atribut lain (merk, lokasi, KIB, status penggunaan) lewat `ubahAtributAset()`.
   Ditegakkan juga oleh `firestore.rules`: perubahan field nilai/kondisi/status wajib satu batch dengan transaksi
   baru, dan `aset.trxTerakhir` menunjuk transaksi itu (transaksi pun harus berpasangan dengan asetnya).
   Mengubah `firestore.rules` atau `db.js` → jalankan `npm run test:emulator`.
2. `transaksi.efek` = pengaruh ke neraca intrakomptabel per akun. LBKP dihitung dari efek ini;
   uji `LBKP ... sama dengan saldo dari aset` menjaga konsistensinya. Jenis transaksi baru wajib menambah uji.
3. Koreksi = transaksi baru. Jangan pernah menambah update/delete pada `transaksi`.
4. Dokumen RKBMN baru selalu dibuat dengan status `draft` (diwajibkan rules).

## Bootstrap dosen pertama

Daftar lewat halaman masuk, lalu di Firebase Console ubah `users/{uid}.role` menjadi `pengelola`.
Dosen berikutnya dapat dipromosikan dari menu Kelas & Satker.

## Status terhadap PRD

Selesai (R1 + sebagian R2):
- M0 dashboard + referensi (batas kapitalisasi, batas pemeliharaan, SBSK latihan dapat diedit).
- M1 daftar aset, NUP otomatis, KIB (tanah, gedung, bangunan air, AAB, alat besar), intra/ekstrakomptabel, aset bersejarah.
- M2 29 jenis transaksi PMK 181/2016, penyusutan garis lurus semesteran, inventarisasi (sensus/opname KDP) dengan pembukuan otomatis,
  LBKP semesteran/tahunan + cek silang, DBKP, Buku Intra/Ekstra/Bersejarah, DBR, Daftar RB/Hilang, Buku PNBP, cetak via browser.
- M3 RKBMN pengadaan (uji SBSK + ketersediaan + BMN idle) dan pemeliharaan (uji objek PMK 150/2014), reviu APIP, penelaahan, tanda tangan simulasi.
- M4–M6 usulan 13 jenis; persetujuan dosen membukukan transaksi/ubah status penggunaan; sewa mencatat PNBP.
- Kelas, satker, anggota, peran APIP, data contoh 12 NUP.
- Uji emulator: 45 uji aturan keamanan + 11 langkah alur end-to-end (dosen, KPB, APIP).

Backlog (urutan disarankan):
1. ~~Uji rules dengan Firebase Emulator~~ — selesai: `tests/emulator/` (rules + alur end-to-end). Belum dicoba pada proyek Firebase sungguhan.
2. Persediaan (aset lancar): Buku Persediaan per jenis, opname fisik, LBKP persediaan.
3. Unggah dokumen sumber dan foto aset ke Cloud Storage (maks. 2 MB).
4. Usulan Perubahan Hasil Penelaahan RKBMN (dalam tahun pelaksanaan anggaran).
5. M7: temuan wasdal otomatis, simulasi rekonsiliasi SIMAK vs SAKTI, ringkasan Neraca BMN.
6. R3: skenario kasus, rubrik penilaian per Sub-CPMK, rekap nilai ekspor Excel.
7. Impor kodefikasi barang resmi dari CSV ke `referensi` (gantikan `src/data/kodeBarang.js`), masa manfaat dari KMK terbaru.
8. Ekspor PDF/Excel terformat, code-splitting per halaman (bundle 768 kB).

## Penyederhanaan yang disengaja

- Penyusutan memakai nilai aset saat ini sejak tanggal perolehan awal (pengembangan tidak dihitung terpisah).
- Tanda tangan Pengguna/Pengelola Barang berupa nama + tanggal, bukan TTE.
- Tarif sewa memakai rumus pembanding sederhana (nilai buku × 3,33% × bulan/12), bukan formula PMK sewa.
- Angka SBSK dan kodefikasi adalah contoh; dosen menyesuaikan.
