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
npm start                    # server.js menyajikan dist/ di $PORT (dipakai Firebase App Hosting)
```

Deploy App Hosting: `apphosting.yaml` + `server.js` (tanpa dependensi). `vite.config.js` memetakan
`FIREBASE_WEBAPP_CONFIG` (disediakan App Hosting saat build) ke `VITE_FIREBASE_*`.

## Stack dan prinsip

- React 18 + Vite 6 + Tailwind 4, react-router 6, lucide-react.
- Firebase Auth (email/kata sandi + Google) + Cloud Firestore named database `siman`.
  Masuk Google: popup, beralih ke redirect bila diblokir; pengguna tanpa profil diarahkan ke "Lengkapi profil".
- **100% online**: Firestore satu-satunya sumber data. Jangan menambah localStorage/mode offline untuk data.
- Antarmuka dan istilah berbahasa Indonesia, mengikuti PP 27/2014 jo. PP 28/2020, PMK 150/2014, PMK 181/2016.
- Label "Aplikasi Simulasi Pembelajaran" harus tetap tampil di setiap halaman.

## Peta kode

| Path | Isi |
| --- | --- |
| `src/lib/bmn.js` | **Logika domain murni** (tanpa Firebase): jenis transaksi, kapitalisasi, penyusutan, LBKP, aturan RKBMN, aksi persetujuan usulan. Semua aturan bisnis baru masuk ke sini dan diuji di `tests/`. |
| `src/lib/wasdal.js` | Temuan wasdal otomatis (14 jenis) + skor kepatuhan; ringkasan Neraca BMN (Buku Barang vs Daftar Barang). |
| `src/lib/penilaian.js` | Pencocokan jawaban skenario dengan kunci, skor per kriteria/rubrik Sub-CPMK, nilai huruf, templat skenario. |
| `src/lib/persediaan.js` | Mutasi persediaan FIFO, opname (selisih), LBKP persediaan. |
| `src/lib/rekonsiliasi.js` | Rekonsiliasi SIMAK-BMN vs SAKTI per akun & per nomor SP2D. |
| `src/lib/kodefikasi.js` | Parser CSV kodefikasi (impor dosen). Daftar aktif dipasang di `src/data/kodeBarang.js` (`setKodefikasi`). |
| `src/lib/lampiran.js` | Validasi & pemotongan berkas lampiran (base64 di Firestore). |
| `src/lib/ekspor.js` | Penulis .xlsx (fflate) dan PDF (jsPDF, dimuat saat dibutuhkan). Dipakai lewat `<TombolEkspor>`. |
| `src/lib/db.js` | Penulisan Firestore. `catatTransaksi()`/`catatMutasiPersediaan()` memakai `runTransaction` agar data induk dan bukunya selalu konsisten. |
| `src/lib/akses.js` | Peran, daftar dosen awal (`DOSEN_AWAL`), sinkron profil setelah verifikasi email, aturan ubah peran. |
| `src/lib/auth.jsx` | Login, verifikasi email, profil `users/{uid}`, peran, referensi aktif (`referensi/config` digabung dengan `REFERENSI_DEFAULT`). |
| `src/lib/satker.jsx` | Satker aktif (mahasiswa: miliknya; dosen: dipilih di header) + langganan realtime aset & transaksi. |
| `src/data/kodeBarang.js` | Kodefikasi barang **contoh** + registri kodefikasi aktif (hasil impor CSV). Pakai `cariKode()`/`daftarKode()`, jangan `KODE_BARANG` langsung. |
| `src/components/ui.jsx`, `umpan.jsx` | Komponen dasar (Card, Table, Tabs, Paging, TombolEkspor…), toast `useToast()`, dialog `useKonfirmasi()`. Aksi yang tidak dapat dibatalkan wajib dikonfirmasi. |
| `src/data/kib.js` | Field KIB per jenis. |
| `src/pages/*` | Dashboard, Skenario (soal/penilaian), Aset/KIB, Transaksi (Buku Barang), Persediaan, Inventarisasi, Laporan (LBKP, Neraca BMN, DBKP, Intra/Ekstra, DBR, RB/Hilang, PNBP), Rekonsiliasi, Wasdal, RKBMN, Usulan, Telaah (dosen), Kelas, Pengguna (dosen), Referensi. Halaman dimuat per bagian (`React.lazy` di `App.jsx`). |
| `firestore.rules` | Keamanan per peran. Transaksi tidak bisa diubah/dihapus (jejak audit). |

## Model data Firestore

```
users/{uid}            nama, nim, email, role: kpb|pengelola|admin, kelasId, satkerId, emailTerverifikasi
kelas/{id}             nama, mk, tahunAkademik, semester, dosenUid
referensi/config       batasKapitalisasi{peralatan,gedung}, batasPemeliharaan, sbsk[], tahunAnggaran
referensi/kodefikasi   jumlah, jumlahBagian, sumber   (+ referensi/kodefikasi_{i}: daftar[] ≤2.500 kode)
skenario/{id}          kelasId, judul, petunjuk, batas, status draft|terbit|ditutup, rubrik[], langkah[]
  kunci/jawaban        langkah{langkahId: {jenis, tanggal, nomorDokumen, kodeBarang|target, nilai, kondisiBaru}}  (dosen saja)
  nilai/{satkerId}     total, huruf, rubrik[], langkah[], manual{}, catatan, terbit
satker/{id}            kode, nama, kelasId, anggota[uid], apipUids[uid]
  aset/{id}            kodeBarang, nup, namaBarang, merk, nilai, tglPerolehan, kondisi B|RR|RB,
                       status aktif|rusak_berat|hilang|dihentikan|dihapus, statusPenggunaan, trxTerakhir,
                       pemanfaatan{}, intrakomptabel, bersejarah, lokasiRuang, kib{}
  transaksi/{id}       jenis, tanggal, asetId, efek[{akun,nilai}], dokumen{jenis,nomor}, dibuatOleh
  rkbmn/{tahun-jenis}  status draft→reviu_apip→diajukan→disetujui|dikembalikan, baris[], reviuApip, telaah, tandaTangan[],
                       perubahan{status draft|diajukan|disetujui|ditolak, alasan, baris[], telaah}, revisi, riwayatRevisi[]
  usulan/{id}          jenis, asetIds[], status diajukan|disetujui|ditolak, nomorSK
  inventarisasi/{id}   jenis sensus|opname_kdp, hasil{asetId:{ditemukan,kondisi}}, status
  pnbp/{id}            sumber, nilai, nomorSK
  persediaan/{id}      kode, nama, satuan, saldoQty, lapisan[{tanggal,qty,harga}] (FIFO), tglTerakhir, mutasiTerakhir
  mutasiPersediaan/{id} jenis, arah masuk|keluar, tanggal, barangId, qty, nilai, rincian[] FIFO, dokumen, dibuatOleh  (tidak dapat diubah)
  sakti/{id}           tanggal, akunBelanja, akun, uraian, nilai, nomorSP2D   (diisi dosen)
  rekonsiliasi/{periode} penjelasan{akun: teks}, status draft|final, ringkasan[]
  lampiran/{id}        induk{tipe aset|transaksi, id}, nama, tipe, ukuran ≤2 MB, jumlahPotong, dibuatOleh
    potong/{i}         data (base64 ≤950.000 karakter)
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
4. Dokumen RKBMN baru selalu dibuat dengan status `draft` (diwajibkan rules). KPB hanya mengisi field penyusun;
   CHR APIP, telaah, dan tanda tangan diisi pihak masing-masing. Perubahan hasil penelaahan hanya lewat field `perubahan`.
5. Saldo persediaan hanya berubah lewat `catatMutasiPersediaan()` (pasangan `mutasiTerakhir`, pola sama dengan `trxTerakhir`).
6. Kunci jawaban skenario hanya di `skenario/{id}/kunci/*`; jangan pernah menaruh kunci di dokumen skenario.
7. Lampiran disimpan di Firestore (bukan Cloud Storage: Storage proyek baru butuh paket Blaze dan rules-nya tidak dapat
   membaca keanggotaan satker di named database). Lampiran transaksi tidak dapat dihapus.
8. Aturan bisnis baru → fungsi murni di `src/lib/*.js` + uji di `tests/`; perubahan rules/db → uji di `tests/emulator/`.

## Bootstrap dosen pertama (tanpa Firebase Console)

Email di `DOSEN_AWAL` (`src/lib/akses.js`) — saat ini `mujiburrohman319@gmail.com` — otomatis berperan
Pengelola Barang setelah **emailnya terverifikasi**: masuk dengan Google (email Google sudah terverifikasi,
langsung aktif), atau daftar email/kata sandi → klik tautan verifikasi → "Saya sudah verifikasi". Daftar yang sama ada di fungsi `dosenAwal()` di `firestore.rules`; keduanya wajib
sama (dijaga `tests/akses.test.js`) dan rules harus di-deploy agar berlaku. Verifikasi wajib karena
pendaftaran email/kata sandi tidak membuktikan kepemilikan email.
Dosen/asisten berikutnya, penurunan peran, dan penempatan satker diatur di menu **Pengguna** (`src/pages/Pengguna.jsx`).
Dosen tidak dapat menurunkan perannya sendiri; dosen awal tidak dapat diturunkan dari panel.

## Status terhadap PRD

Selesai (R1 + sebagian R2):
- M0 dashboard + referensi (batas kapitalisasi, batas pemeliharaan, SBSK latihan dapat diedit).
- M1 daftar aset, NUP otomatis, KIB (tanah, gedung, bangunan air, AAB, alat besar), intra/ekstrakomptabel, aset bersejarah.
- M2 29 jenis transaksi PMK 181/2016, penyusutan garis lurus semesteran, inventarisasi (sensus/opname KDP) dengan pembukuan otomatis,
  LBKP semesteran/tahunan + cek silang, DBKP, Buku Intra/Ekstra/Bersejarah, DBR, Daftar RB/Hilang, Buku PNBP, cetak via browser.
- M3 RKBMN pengadaan (uji SBSK + ketersediaan + BMN idle) dan pemeliharaan (uji objek PMK 150/2014), reviu APIP, penelaahan, tanda tangan simulasi.
- M4–M6 usulan 13 jenis; persetujuan dosen membukukan transaksi/ubah status penggunaan; sewa mencatat PNBP.
- Kelas, satker, anggota, peran APIP, data contoh 12 NUP.
- R2/R3 (sesi berikutnya): ekspor Excel/PDF semua laporan, toast & konfirmasi, paging Buku Barang/Daftar Aset,
  code-splitting; wasdal otomatis + Neraca BMN; skenario kasus dengan penilaian otomatis, rubrik Sub-CPMK, rekap Excel;
  persediaan (FIFO, opname, LBKP persediaan); usulan perubahan hasil penelaahan RKBMN; rekonsiliasi SIMAK–SAKTI;
  lampiran dokumen sumber & foto (≤2 MB); impor kodefikasi CSV.
- Uji: `npm test` (domain) + `npm run test:emulator` (aturan keamanan + alur end-to-end dosen/KPB/APIP).

Backlog (urutan disarankan):
1. Uji coba di proyek Firebase sungguhan (deploy rules + indeks), lalu uji kelas kecil.
2. Upgrade `react-router-dom` (peringatan `npm audit`) dan bendera masa depan v7.
3. Wasdal tambahan: opname persediaan semesteran, persediaan usang; temuan dari hasil rekonsiliasi.
4. Skenario: langkah persediaan & usulan (saat ini hanya transaksi BMN yang dinilai otomatis); salin skenario antar kelas.
5. Pembatasan kuota lampiran per satker; pratinjau gambar langsung di aplikasi.

## Penyederhanaan yang disengaja

- Penyusutan memakai nilai aset saat ini sejak tanggal perolehan awal (pengembangan tidak dihitung terpisah).
- Tanda tangan Pengguna/Pengelola Barang berupa nama + tanggal, bukan TTE.
- Tarif sewa memakai rumus pembanding sederhana (nilai buku × 3,33% × bulan/12), bukan formula PMK sewa.
- Persediaan memakai FIFO dan mutasi wajib kronologis; kodefikasi persediaan & akun belanja SAKTI bersifat ilustratif.
- Rekonsiliasi hanya membandingkan perolehan yang dibiayai belanja (pembelian, pengembangan, pembelian persediaan).
- Penilaian otomatis mencocokkan transaksi lewat nomor dokumen; skala huruf di `src/lib/penilaian.js` dapat disesuaikan.
- Angka SBSK dan kodefikasi adalah contoh; dosen menyesuaikan.
