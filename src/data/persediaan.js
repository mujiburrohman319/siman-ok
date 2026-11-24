// CONTOH kodefikasi persediaan untuk latihan (ilustratif, bukan tabel resmi).
// Pola: 1.01.03 (Persediaan) . kelompok . sub kelompok
export const KODE_PERSEDIAAN = [
  { kode: '1.01.03.01.001', uraian: 'Alat Tulis Kantor', satuan: 'buah' },
  { kode: '1.01.03.01.002', uraian: 'Kertas dan Cover', satuan: 'rim' },
  { kode: '1.01.03.01.003', uraian: 'Bahan Cetak', satuan: 'eksemplar' },
  { kode: '1.01.03.01.004', uraian: 'Benda Pos', satuan: 'buah' },
  { kode: '1.01.03.01.005', uraian: 'Bahan Komputer', satuan: 'buah' },
  { kode: '1.01.03.01.006', uraian: 'Perabot Kantor (habis pakai)', satuan: 'buah' },
  { kode: '1.01.03.01.007', uraian: 'Alat Listrik', satuan: 'buah' },
  { kode: '1.01.03.01.008', uraian: 'Perlengkapan Kebersihan', satuan: 'buah' },
  { kode: '1.01.03.02.001', uraian: 'Suku Cadang Alat Angkutan', satuan: 'buah' },
  { kode: '1.01.03.02.002', uraian: 'Bahan Bakar Minyak', satuan: 'liter' },
  { kode: '1.01.03.05.001', uraian: 'Obat-obatan', satuan: 'paket' },
]
export const cariKodePersediaan = (kode) => KODE_PERSEDIAAN.find((k) => k.kode === kode) || null
