// CONTOH kodefikasi barang untuk latihan.
// Struktur kode mengikuti pola Golongan.Bidang.Kelompok.SubKelompok.SubSubKelompok,
// tetapi daftar dan nomor di bawah ini ILUSTRATIF. Ganti dengan tabel kodefikasi resmi
// (PMK penggolongan & kodefikasi BMN) sebelum dipakai sebagai bahan ujian.
//
// kib: jenis Kartu Identitas Barang yang dipakai (null = tidak ada KIB khusus)
// masaManfaat: tahun (0 = tidak disusutkan) — contoh, sesuaikan dengan KMK masa manfaat terbaru
// aab: true jika Alat Angkutan Bermotor (objek RKBMN pemeliharaan & SBSK AADB)

export const GOLONGAN = {
  '2': 'Tanah',
  '3': 'Peralatan dan Mesin',
  '4': 'Gedung dan Bangunan',
  '5': 'Jalan, Irigasi dan Jaringan',
  '6': 'Aset Tetap Lainnya',
  '7': 'Konstruksi Dalam Pengerjaan',
  '8': 'Aset Tak Berwujud',
}

export const KODE_BARANG = [
  { kode: '2.01.01.01.001', uraian: 'Tanah Bangunan Kantor Pemerintah', kib: 'tanah', masaManfaat: 0 },
  { kode: '2.01.01.01.002', uraian: 'Tanah Bangunan Pendidikan', kib: 'tanah', masaManfaat: 0 },
  { kode: '2.01.01.01.003', uraian: 'Tanah Bangunan Rumah Negara', kib: 'tanah', masaManfaat: 0 },
  { kode: '3.02.01.01.001', uraian: 'Station Wagon', kib: 'aab', masaManfaat: 7, aab: true },
  { kode: '3.02.01.01.003', uraian: 'Mini Bus', kib: 'aab', masaManfaat: 7, aab: true },
  { kode: '3.02.01.04.001', uraian: 'Sepeda Motor', kib: 'aab', masaManfaat: 7, aab: true },
  { kode: '3.03.01.01.001', uraian: 'Mesin Potong Rumput', kib: null, masaManfaat: 5 },
  { kode: '3.05.01.04.001', uraian: 'Lemari Besi/Metal', kib: null, masaManfaat: 5 },
  { kode: '3.05.01.05.010', uraian: 'Meja Kerja Pegawai', kib: null, masaManfaat: 5 },
  { kode: '3.05.02.01.002', uraian: 'Kursi Rapat', kib: null, masaManfaat: 5 },
  { kode: '3.05.02.06.002', uraian: 'AC Split', kib: null, masaManfaat: 5 },
  { kode: '3.06.01.02.005', uraian: 'LCD Projector', kib: null, masaManfaat: 5 },
  { kode: '3.10.01.02.001', uraian: 'P.C Unit', kib: null, masaManfaat: 4 },
  { kode: '3.10.01.02.002', uraian: 'Laptop', kib: null, masaManfaat: 4 },
  { kode: '3.10.02.03.003', uraian: 'Printer', kib: null, masaManfaat: 4 },
  { kode: '3.11.01.01.001', uraian: 'Genset', kib: 'alat_besar', masaManfaat: 10 },
  { kode: '4.01.01.01.001', uraian: 'Bangunan Gedung Kantor Permanen', kib: 'gedung', masaManfaat: 50 },
  { kode: '4.01.01.07.001', uraian: 'Bangunan Gedung Pendidikan Permanen', kib: 'gedung', masaManfaat: 50 },
  { kode: '4.01.02.01.002', uraian: 'Rumah Negara Golongan II', kib: 'gedung', masaManfaat: 50 },
  { kode: '4.02.01.01.001', uraian: 'Tugu/Pagar Kantor', kib: null, masaManfaat: 10 },
  { kode: '5.01.01.07.001', uraian: 'Jalan Lingkungan', kib: null, masaManfaat: 10 },
  { kode: '5.02.01.01.001', uraian: 'Bangunan Air Bersih/Saluran Drainase', kib: 'bangunan_air', masaManfaat: 30 },
  { kode: '5.03.01.01.001', uraian: 'Jaringan Listrik', kib: null, masaManfaat: 40 },
  { kode: '6.01.01.01.001', uraian: 'Buku Umum (Koleksi Perpustakaan)', kib: null, masaManfaat: 0 },
  { kode: '6.02.01.01.001', uraian: 'Barang Bercorak Kesenian/Kebudayaan', kib: null, masaManfaat: 0 },
  { kode: '7.01.01.01.001', uraian: 'Konstruksi Dalam Pengerjaan Gedung', kib: null, masaManfaat: 0 },
  { kode: '8.01.01.01.001', uraian: 'Software Aplikasi', kib: null, masaManfaat: 4 },
]

export function cariKode(kode) {
  return KODE_BARANG.find((k) => k.kode === kode) || null
}

export function golonganDari(kode) {
  return String(kode || '').split('.')[0]
}
