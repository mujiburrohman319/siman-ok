// Logika domain BMN — fungsi murni, tanpa Firebase, agar mudah diuji (lihat tests/).
// Acuan: PP 27/2014 jo. PP 28/2020, PMK 150/2014 (perencanaan), PMK 181/2016 (penatausahaan).
import { GOLONGAN, cariKode, golonganDari } from '../data/kodeBarang.js'

// ---------------------------------------------------------------- referensi default
// Batas kapitalisasi dapat diubah dosen di menu Referensi (disimpan di referensi/config).
export const REFERENSI_DEFAULT = {
  batasKapitalisasi: { peralatan: 1_000_000, gedung: 25_000_000 },
  batasPemeliharaan: 100_000_000, // PMK 150/2014: BMN lain dengan nilai perolehan per unit >= Rp100 juta
  // SBSK: ANGKA CONTOH untuk latihan, bukan angka regulasi. Dosen menyesuaikan di menu Referensi.
  sbsk: [
    { id: 'aadb-jabatan', jenis: 'Kendaraan dinas jabatan', satuan: 'unit', dasar: 'per pejabat eselon II', standar: 1 },
    { id: 'aadb-operasional', jenis: 'Kendaraan dinas operasional', satuan: 'unit', dasar: 'per satker', standar: 2 },
    { id: 'ruang-pegawai', jenis: 'Ruang kerja staf', satuan: 'm²', dasar: 'per pegawai', standar: 4.5 },
    { id: 'laptop-pegawai', jenis: 'Laptop / PC', satuan: 'unit', dasar: 'per pegawai', standar: 1 },
  ],
}

export const KONDISI = { B: 'Baik', RR: 'Rusak Ringan', RB: 'Rusak Berat' }

export const STATUS_PENGGUNAAN = {
  digunakan_sendiri: 'Digunakan sendiri (PSP)',
  penggunaan_sementara: 'Penggunaan sementara',
  dioperasikan_pihak_lain: 'Dioperasikan pihak lain',
  dimanfaatkan: 'Sedang dimanfaatkan',
  idle: 'Tidak digunakan (idle)',
}

export const STATUS_ASET = {
  aktif: 'Aktif',
  rusak_berat: 'Daftar Barang Rusak Berat',
  hilang: 'Daftar Barang Hilang',
  dihentikan: 'Dihentikan dari penggunaan',
  dihapus: 'Dihapuskan',
}

// ---------------------------------------------------------------- akun / klasifikasi
export const AKUN = [
  'Tanah',
  'Peralatan dan Mesin',
  'Gedung dan Bangunan',
  'Jalan, Irigasi dan Jaringan',
  'Aset Tetap Lainnya',
  'Konstruksi Dalam Pengerjaan',
  'Aset Tak Berwujud',
  'Aset Lain-lain',
]

export function akunAset(aset) {
  if (aset.status === 'dihentikan') return 'Aset Lain-lain'
  return GOLONGAN[golonganDari(aset.kodeBarang)] || 'Aset Tetap Lainnya'
}

export function kelompokNeraca(akun) {
  if (akun === 'Aset Tak Berwujud' || akun === 'Aset Lain-lain') return 'Aset Lainnya'
  return 'Aset Tetap'
}

/** Intrakomptabel jika memenuhi batas kapitalisasi (PMK 181/2016 — Buku Barang Intra/Ekstrakomptabel). */
export function isIntrakomptabel(kodeBarang, nilai, ref = REFERENSI_DEFAULT) {
  const g = golonganDari(kodeBarang)
  if (g === '3') return nilai >= ref.batasKapitalisasi.peralatan
  if (g === '4') return nilai >= ref.batasKapitalisasi.gedung
  return true
}

// ---------------------------------------------------------------- penyusutan
const semIndex = (d) => d.getFullYear() * 2 + (d.getMonth() < 6 ? 0 : 1)

/** Akhir semester terakhir yang sudah lewat (<= tanggal). */
export function akhirSemesterTerakhir(tanggal) {
  const d = new Date(tanggal)
  const y = d.getFullYear()
  const jun = new Date(y, 5, 30)
  const des = new Date(y, 11, 31)
  if (d >= des) return des
  if (d >= jun) return jun
  return new Date(y - 1, 11, 31)
}

/**
 * Penyusutan garis lurus semesteran. Semester perolehan dihitung penuh.
 * Penyederhanaan untuk pembelajaran: nilai pengembangan disusutkan sejak tanggal perolehan awal.
 * @returns {{perSemester:number, semester:number, akumulasi:number, nilaiBuku:number}}
 */
export function hitungPenyusutan(aset, tanggalLaporan = new Date()) {
  const ref = cariKode(aset.kodeBarang)
  const masa = aset.masaManfaat ?? ref?.masaManfaat ?? 0
  const nilai = Number(aset.nilai) || 0
  const nol = { perSemester: 0, semester: 0, akumulasi: 0, nilaiBuku: nilai }
  if (!masa || !aset.intrakomptabel || aset.status !== 'aktif') return nol
  const akhir = akhirSemesterTerakhir(tanggalLaporan)
  const perolehan = new Date(aset.tglPerolehan)
  if (perolehan > akhir) return nol
  const totalSem = masa * 2
  const semester = Math.min(totalSem, semIndex(akhir) - semIndex(perolehan) + 1)
  const perSemester = nilai / totalSem
  const akumulasi = semester >= totalSem ? nilai : Math.round(perSemester * semester)
  return { perSemester, semester, akumulasi, nilaiBuku: nilai - akumulasi }
}

// ---------------------------------------------------------------- jenis transaksi (PMK 181/2016)
// kelompok: tambah = membuat aset baru; ubah = mengubah aset; kurang = mengeluarkan aset
export const JENIS_TRANSAKSI = {
  saldo_awal: { nama: 'Saldo Awal', kelompok: 'tambah' },
  penambahan_saldo_awal: { nama: 'Penambahan Saldo Awal', kelompok: 'tambah' },
  pembelian: { nama: 'Pembelian', kelompok: 'tambah' },
  transfer_masuk: { nama: 'Transfer Masuk', kelompok: 'tambah' },
  hibah_masuk: { nama: 'Hibah Masuk', kelompok: 'tambah' },
  rampasan: { nama: 'Rampasan', kelompok: 'tambah' },
  penyelesaian_pembangunan: { nama: 'Penyelesaian Pembangunan', kelompok: 'tambah' },
  reklasifikasi_masuk: { nama: 'Reklasifikasi Masuk', kelompok: 'tambah' },
  perolehan_kemitraan: { nama: 'Perolehan dari BGS/BSG/KSP', kelompok: 'tambah' },
  tukar_menukar_masuk: { nama: 'Pertukaran (Tukar Menukar) Masuk', kelompok: 'tambah' },
  perolehan_lainnya: { nama: 'Perolehan Lainnya', kelompok: 'tambah' },

  pengembangan_nilai: { nama: 'Pengembangan Nilai Aset', kelompok: 'ubah' },
  koreksi_nilai: { nama: 'Koreksi Perubahan Nilai', kelompok: 'ubah' },
  koreksi_kondisi: { nama: 'Koreksi Perubahan Kondisi', kelompok: 'ubah' },
  reklasifikasi_rusak_berat: { nama: 'Reklasifikasi ke Daftar Barang Rusak Berat', kelompok: 'ubah' },
  reklasifikasi_hilang: { nama: 'Reklasifikasi ke Daftar Barang Hilang', kelompok: 'ubah' },
  ditemukan_kembali: { nama: 'Barang Hilang Ditemukan Kembali', kelompok: 'ubah' },
  penghentian_penggunaan: { nama: 'Penghentian Penggunaan', kelompok: 'ubah' },
  penggunaan_kembali: { nama: 'Penggunaan Kembali', kelompok: 'ubah' },

  penghapusan: { nama: 'Penghapusan', kelompok: 'kurang' },
  pemusnahan: { nama: 'Pemusnahan', kelompok: 'kurang' },
  penjualan: { nama: 'Penjualan', kelompok: 'kurang' },
  hibah_keluar: { nama: 'Hibah Keluar', kelompok: 'kurang' },
  transfer_keluar: { nama: 'Transfer Keluar', kelompok: 'kurang' },
  tukar_menukar_keluar: { nama: 'Tukar Menukar Keluar', kelompok: 'kurang' },
  pmpp: { nama: 'Penyertaan Modal Pemerintah Pusat', kelompok: 'kurang' },
  reklasifikasi_keluar: { nama: 'Reklasifikasi Keluar', kelompok: 'kurang' },
  koreksi_pencatatan: { nama: 'Koreksi Pencatatan (hapus)', kelompok: 'kurang' },
  penyerahan_ke_pengelola: { nama: 'Penyerahan kepada Pengelola', kelompok: 'kurang' },
}

export const DOKUMEN_SUMBER = ['BAST', 'SP2D', 'SPM', 'Kuitansi', 'Faktur', 'Kontrak/SPK', 'Naskah Hibah', 'SK Penghapusan', 'Berita Acara Inventarisasi', 'Dokumen Lainnya']

export class TransaksiError extends Error {}

/**
 * Menerapkan satu transaksi pada aset. Fungsi murni.
 * @param {object|null} aset  kondisi aset saat ini (null untuk transaksi kelompok "tambah")
 * @param {object} input      {jenis, tanggal, nilai?, kondisiBaru?, dokumen, keterangan, data aset baru...}
 * @returns {{aset:object, transaksi:object}}  aset = keadaan baru (lengkap), transaksi = dokumen yang dicatat
 */
export function terapkanTransaksi(aset, input, ref = REFERENSI_DEFAULT) {
  const def = JENIS_TRANSAKSI[input.jenis]
  if (!def) throw new TransaksiError(`Jenis transaksi tidak dikenal: ${input.jenis}`)
  if (!input.tanggal) throw new TransaksiError('Tanggal transaksi wajib diisi')
  if (!input.dokumen?.jenis || !input.dokumen?.nomor) throw new TransaksiError('Dokumen sumber (jenis dan nomor) wajib diisi')

  const efek = [] // [{akun, nilai}] — pengaruh ke neraca (hanya intrakomptabel)
  let baru

  if (def.kelompok === 'tambah') {
    if (aset) throw new TransaksiError('Transaksi perolehan membuat aset baru')
    const kodeRef = cariKode(input.kodeBarang)
    if (!kodeRef) throw new TransaksiError('Kode barang tidak ada di referensi')
    const nilai = Number(input.nilai)
    if (!(nilai >= 0)) throw new TransaksiError('Nilai perolehan tidak valid')
    // Aset bersejarah (heritage) dicatat dalam kuantitas tanpa nilai
    baru = {
      kodeBarang: input.kodeBarang,
      namaBarang: kodeRef.uraian,
      merk: input.merk || '',
      nup: input.nup,
      tglPerolehan: input.tglPerolehan || input.tanggal,
      nilai: input.bersejarah ? 0 : nilai,
      nilaiAwal: input.bersejarah ? 0 : nilai,
      asalPerolehan: input.asalPerolehan || 'APBN',
      kondisi: input.kondisi || 'B',
      lokasiRuang: input.lokasiRuang || '',
      statusPenggunaan: input.statusPenggunaan || 'digunakan_sendiri',
      pemanfaatan: null,
      status: 'aktif',
      bersejarah: !!input.bersejarah,
      masaManfaat: kodeRef.masaManfaat,
      kib: input.kib || {},
    }
    baru.intrakomptabel = !baru.bersejarah && isIntrakomptabel(baru.kodeBarang, baru.nilai, ref)
    if (baru.intrakomptabel) efek.push({ akun: akunAset(baru), nilai: baru.nilai })
  } else {
    if (!aset) throw new TransaksiError('Pilih aset yang ditransaksikan')
    if (aset.status === 'dihapus') throw new TransaksiError('Aset sudah dihapuskan')
    baru = { ...aset }
    const akunLama = akunAset(aset)
    const diNeraca = aset.intrakomptabel && ['aktif', 'dihentikan'].includes(aset.status)

    switch (input.jenis) {
      case 'pengembangan_nilai': {
        if (aset.status !== 'aktif') throw new TransaksiError('Pengembangan hanya untuk aset aktif')
        const tambah = Number(input.nilai)
        if (!(tambah > 0)) throw new TransaksiError('Nilai pengembangan harus lebih dari 0')
        baru.nilai = aset.nilai + tambah
        const jadiIntra = isIntrakomptabel(aset.kodeBarang, baru.nilai, ref)
        if (aset.intrakomptabel) efek.push({ akun: akunLama, nilai: tambah })
        else if (jadiIntra) efek.push({ akun: akunLama, nilai: baru.nilai }) // pindah buku ekstra -> intra
        baru.intrakomptabel = aset.intrakomptabel || jadiIntra
        break
      }
      case 'koreksi_nilai': {
        const nilaiBaru = Number(input.nilai)
        if (!(nilaiBaru >= 0)) throw new TransaksiError('Nilai koreksi tidak valid')
        const selisih = nilaiBaru - aset.nilai
        if (diNeraca && selisih) efek.push({ akun: akunLama, nilai: selisih })
        baru.nilai = nilaiBaru
        break
      }
      case 'koreksi_kondisi': {
        if (!KONDISI[input.kondisiBaru]) throw new TransaksiError('Pilih kondisi baru')
        if (input.kondisiBaru === aset.kondisi) throw new TransaksiError('Kondisi baru sama dengan kondisi lama')
        baru.kondisi = input.kondisiBaru
        break
      }
      case 'reklasifikasi_rusak_berat': {
        if (aset.status !== 'aktif') throw new TransaksiError('Hanya aset aktif yang dapat direklasifikasi')
        if (aset.kondisi !== 'RB') throw new TransaksiError('Kondisi aset harus Rusak Berat (lakukan koreksi kondisi dahulu)')
        if (diNeraca) efek.push({ akun: akunLama, nilai: -aset.nilai })
        baru.status = 'rusak_berat'
        break
      }
      case 'reklasifikasi_hilang': {
        if (aset.status !== 'aktif') throw new TransaksiError('Hanya aset aktif yang dapat direklasifikasi')
        if (diNeraca) efek.push({ akun: akunLama, nilai: -aset.nilai })
        baru.status = 'hilang'
        break
      }
      case 'ditemukan_kembali': {
        if (aset.status !== 'hilang') throw new TransaksiError('Aset tidak berada di Daftar Barang Hilang')
        baru.status = 'aktif'
        if (aset.intrakomptabel) efek.push({ akun: akunAset(baru), nilai: aset.nilai })
        break
      }
      case 'penghentian_penggunaan': {
        if (aset.status !== 'aktif') throw new TransaksiError('Hanya aset aktif yang dapat dihentikan')
        baru.status = 'dihentikan'
        if (aset.intrakomptabel) {
          efek.push({ akun: akunLama, nilai: -aset.nilai })
          efek.push({ akun: 'Aset Lain-lain', nilai: aset.nilai })
        }
        break
      }
      case 'penggunaan_kembali': {
        if (aset.status !== 'dihentikan') throw new TransaksiError('Aset tidak berstatus dihentikan')
        baru.status = 'aktif'
        if (aset.intrakomptabel) {
          efek.push({ akun: 'Aset Lain-lain', nilai: -aset.nilai })
          efek.push({ akun: akunAset(baru), nilai: aset.nilai })
        }
        break
      }
      default: {
        // kelompok "kurang": aset keluar dari pembukuan
        if (diNeraca) efek.push({ akun: akunLama, nilai: -aset.nilai })
        baru.status = 'dihapus'
        baru.tglHapus = input.tanggal
      }
    }
  }

  const transaksi = {
    jenis: input.jenis,
    namaJenis: def.nama,
    kelompok: def.kelompok,
    tanggal: input.tanggal,
    kodeBarang: baru.kodeBarang,
    namaBarang: baru.namaBarang,
    nup: baru.nup ?? null,
    nilai: Number(input.nilai) || (def.kelompok === 'kurang' ? aset.nilai : 0),
    kondisiLama: aset?.kondisi ?? null,
    kondisiBaru: baru.kondisi,
    statusLama: aset?.status ?? null,
    statusBaru: baru.status,
    intrakomptabel: baru.intrakomptabel,
    efek,
    dokumen: input.dokumen,
    keterangan: input.keterangan || '',
  }
  return { aset: baru, transaksi }
}

// ---------------------------------------------------------------- laporan
const tgl = (s) => new Date(s).getTime()

/**
 * Laporan Barang Kuasa Pengguna (intrakomptabel) per akun untuk satu periode.
 * saldoAwal + tambah + kurang = saldoAkhir (kurang bernilai negatif).
 */
export function hitungLBKP(transaksiList, mulai, akhir) {
  const rows = Object.fromEntries(AKUN.map((a) => [a, { akun: a, saldoAwal: 0, tambah: 0, kurang: 0, saldoAkhir: 0 }]))
  const tMulai = tgl(mulai)
  const tAkhir = tgl(akhir)
  for (const t of transaksiList) {
    const tt = tgl(t.tanggal)
    if (tt > tAkhir) continue
    for (const e of t.efek || []) {
      const r = rows[e.akun]
      if (!r) continue
      if (tt < tMulai) r.saldoAwal += e.nilai
      else if (e.nilai >= 0) r.tambah += e.nilai
      else r.kurang += e.nilai
    }
  }
  const list = Object.values(rows)
  for (const r of list) r.saldoAkhir = r.saldoAwal + r.tambah + r.kurang
  return list
}

export function hitungPenyusutanPerAkun(asetList, tanggal) {
  const out = {}
  for (const a of asetList) {
    const p = hitungPenyusutan(a, tanggal)
    if (!p.akumulasi) continue
    const akun = akunAset(a)
    out[akun] = (out[akun] || 0) + p.akumulasi
  }
  return out
}

/** Saldo neraca dari kondisi aset saat ini — untuk cek silang dengan LBKP. */
export function saldoDariAset(asetList) {
  const out = {}
  for (const a of asetList) {
    if (!a.intrakomptabel || !['aktif', 'dihentikan'].includes(a.status)) continue
    const akun = akunAset(a)
    out[akun] = (out[akun] || 0) + a.nilai
  }
  return out
}

// ---------------------------------------------------------------- RKBMN (PMK 150/2014)
/** Apakah aset dapat diusulkan dalam RKBMN pemeliharaan, beserta alasannya. */
export function cekObjekPemeliharaan(aset, ref = REFERENSI_DEFAULT) {
  const alasan = []
  const g = golonganDari(aset.kodeBarang)
  const kode = cariKode(aset.kodeBarang)
  const objek = g === '2' || g === '4' || kode?.aab || aset.nilai >= ref.batasPemeliharaan
  if (!objek) alasan.push('Bukan objek: hanya tanah/bangunan, alat angkutan bermotor, atau BMN bernilai ≥ Rp100 juta per unit')
  if (aset.status !== 'aktif') alasan.push(`Status aset: ${STATUS_ASET[aset.status]}`)
  if (aset.kondisi === 'RB') alasan.push('Kondisi rusak berat')
  if (aset.statusPenggunaan === 'penggunaan_sementara') alasan.push('Dalam status penggunaan sementara (diusulkan oleh K/L pengguna sementara)')
  if (aset.statusPenggunaan === 'dioperasikan_pihak_lain') alasan.push('Dalam status dioperasikan pihak lain')
  if (aset.statusPenggunaan === 'dimanfaatkan') {
    const p = aset.pemanfaatan || {}
    const pengecualian = p.jenis === 'pinjam_pakai' && Number(p.durasiBulan) < 6
    if (!pengecualian) alasan.push('Sedang dimanfaatkan (kecuali pinjam pakai < 6 bulan)')
  }
  return { boleh: alasan.length === 0, alasan }
}

/** Validasi satu baris RKBMN pengadaan terhadap SBSK dan ketersediaan BMN. */
export function validasiBarisPengadaan(baris) {
  const kebutuhan = Number(baris.kebutuhanSBSK) || 0
  const tersedia = Number(baris.tersedia) || 0
  const idle = Number(baris.idle) || 0
  const usulan = Number(baris.usulan) || 0
  const maksimal = Math.max(0, kebutuhan - tersedia)
  const catatan = []
  if (usulan > maksimal) catatan.push(`Usulan melebihi selisih SBSK dan BMN tersedia (maksimal ${maksimal})`)
  if (idle > 0) catatan.push(`Ada ${idle} BMN idle sejenis — optimalkan sebelum pengadaan`)
  if (!baris.kodeProgram) catatan.push('Belum dikaitkan dengan program/kegiatan/output Renstra')
  return { maksimal, catatan, sesuai: usulan <= maksimal && idle === 0 }
}

// ---------------------------------------------------------------- usulan pengelolaan
export const JENIS_USULAN = {
  psp: { nama: 'Penetapan Status Penggunaan', grup: 'Penggunaan' },
  penggunaan_sementara: { nama: 'Penggunaan Sementara', grup: 'Penggunaan' },
  alih_status: { nama: 'Alih Status Penggunaan', grup: 'Penggunaan' },
  sewa: { nama: 'Sewa', grup: 'Pemanfaatan' },
  pinjam_pakai: { nama: 'Pinjam Pakai', grup: 'Pemanfaatan' },
  ksp: { nama: 'Kerja Sama Pemanfaatan', grup: 'Pemanfaatan' },
  bgs_bsg: { nama: 'Bangun Guna Serah / Bangun Serah Guna', grup: 'Pemanfaatan' },
  penjualan: { nama: 'Penjualan', grup: 'Pemindahtanganan' },
  tukar_menukar: { nama: 'Tukar Menukar', grup: 'Pemindahtanganan' },
  hibah: { nama: 'Hibah', grup: 'Pemindahtanganan' },
  pmpp: { nama: 'Penyertaan Modal Pemerintah Pusat', grup: 'Pemindahtanganan' },
  pemusnahan: { nama: 'Pemusnahan', grup: 'Penghapusan' },
  penghapusan: { nama: 'Penghapusan', grup: 'Penghapusan' },
}

/**
 * Konsekuensi persetujuan usulan terhadap aset: transaksi yang dibuat otomatis
 * atau perubahan status penggunaan. Mengembalikan daftar aksi per aset.
 */
export function aksiPersetujuan(usulan, aset) {
  const j = usulan.jenis
  const hapusMap = { penjualan: 'penjualan', tukar_menukar: 'tukar_menukar_keluar', hibah: 'hibah_keluar', pmpp: 'pmpp', pemusnahan: 'pemusnahan', penghapusan: 'penghapusan' }
  if (hapusMap[j]) return { tipe: 'transaksi', jenis: hapusMap[j] }
  if (j === 'alih_status') return { tipe: 'transaksi', jenis: 'transfer_keluar' }
  if (j === 'psp') return { tipe: 'patch', patch: { statusPenggunaan: 'digunakan_sendiri', psp: { nomor: usulan.nomorSK } } }
  if (j === 'penggunaan_sementara') return { tipe: 'patch', patch: { statusPenggunaan: 'penggunaan_sementara' } }
  if (['sewa', 'pinjam_pakai', 'ksp', 'bgs_bsg'].includes(j)) {
    return {
      tipe: 'patch',
      patch: {
        statusPenggunaan: 'dimanfaatkan',
        pemanfaatan: { jenis: j, mitra: usulan.mitra || '', durasiBulan: Number(usulan.durasiBulan) || 0, nomorSK: usulan.nomorSK },
      },
    }
  }
  return { tipe: 'none' }
}

/** Tarif sewa sederhana untuk latihan: nilai buku × faktor % × (bulan/12). */
export function tarifSewaSederhana(nilaiBuku, durasiBulan, faktorPersen = 3.33) {
  return Math.round((nilaiBuku * faktorPersen) / 100 * (Number(durasiBulan) / 12))
}

// ---------------------------------------------------------------- format
export const rupiah = (n) => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-Rp' : 'Rp') + Math.abs(v).toLocaleString('id-ID')
}

export const tanggalID = (s) =>
  s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function nupBerikutnya(asetList, kodeBarang) {
  const max = asetList.filter((a) => a.kodeBarang === kodeBarang).reduce((m, a) => Math.max(m, Number(a.nup) || 0), 0)
  return max + 1
}
