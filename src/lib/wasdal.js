// Pengawasan dan pengendalian (wasdal) BMN tingkat Kuasa Pengguna + ringkasan Neraca BMN.
// Fungsi murni: menerima data satker, mengembalikan temuan beserta rekomendasi tindak lanjut.
// Tujuan pembelajaran: mahasiswa melihat dampak kesalahan pembukuan pada laporan dan neraca.
import { cariKode, golonganDari } from '../data/kodeBarang.js'
import {
  AKUN, REFERENSI_DEFAULT, hitungLBKP, hitungPenyusutanPerAkun, isIntrakomptabel, kelompokNeraca, rupiah, saldoDariAset,
} from './bmn.js'

export const TINGKAT = { tinggi: 'Tinggi', sedang: 'Sedang', rendah: 'Rendah' }
const URUT = { tinggi: 0, sedang: 1, rendah: 2 }
const PENGHAPUSAN = ['penghapusan', 'pemusnahan', 'penjualan', 'hibah', 'tukar_menukar', 'pmpp']
const iso = (d) => new Date(d).toISOString().slice(0, 10)

/**
 * @param {{aset:object[], transaksi:object[], usulan?:object[], inventarisasi?:object[], pnbp?:object[], ref?:object, tanggal?:Date|string}} d
 * @returns {{kode, tingkat, judul, uraian, rekomendasi, dasar, asetIds:string[], tautan}[]} urut dari tingkat tertinggi
 */
export function temuanWasdal({ aset = [], transaksi = [], usulan = [], inventarisasi = [], pnbp = [], ref = REFERENSI_DEFAULT, tanggal = new Date() }) {
  const out = []
  const hariIni = iso(tanggal)
  const aktif = aset.filter((a) => a.status === 'aktif')
  const tercatat = aset.filter((a) => a.status !== 'dihapus')
  const tambah = (t) => { if (t.asetIds?.length !== 0) out.push({ asetIds: [], ...t }) }
  const ids = (list) => list.map((a) => a.id)

  // 1. Buku Barang (transaksi) vs Daftar Barang (aset)
  const lbkp = hitungLBKP(transaksi, '1900-01-01', '2999-12-31')
  const dariAset = saldoDariAset(aset)
  const selisih = AKUN.map((akun) => ({ akun, buku: lbkp.find((r) => r.akun === akun)?.saldoAkhir || 0, daftar: dariAset[akun] || 0 }))
    .filter((r) => r.buku !== r.daftar)
  if (selisih.length) {
    tambah({
      kode: 'SELISIH_BUKU', tingkat: 'tinggi', tautan: '/laporan',
      judul: 'Saldo Buku Barang tidak sama dengan Daftar Barang',
      uraian: selisih.map((r) => `${r.akun}: Buku Barang ${rupiah(r.buku)} vs Daftar Barang ${rupiah(r.daftar)}`).join('; '),
      rekomendasi: 'Telusuri transaksi pada akun tersebut dan bukukan transaksi koreksi. LBKP dan neraca tidak andal sampai selisih nol.',
      dasar: 'PMK 181/2016 — rekonsiliasi internal Buku Barang dan Daftar Barang',
    })
  }

  // 2. NUP ganda
  const kunci = new Map()
  for (const a of tercatat) { const k = `${a.kodeBarang}#${a.nup}`; kunci.set(k, [...(kunci.get(k) || []), a]) }
  const ganda = [...kunci.values()].filter((l) => l.length > 1).flat()
  tambah({
    kode: 'NUP_GANDA', tingkat: 'tinggi', tautan: '/aset', asetIds: ids(ganda),
    judul: 'Kode barang dan NUP ganda',
    uraian: `${ganda.length} NUP memakai kombinasi kode barang + NUP yang sama, sehingga identitas barang tidak unik.`,
    rekomendasi: 'Bukukan koreksi pencatatan atas NUP yang keliru, lalu catat ulang dengan NUP yang benar.',
    dasar: 'PMK 181/2016 — Nomor Urut Pendaftaran unik per kode barang',
  })

  // 3. Tanah tanpa sertifikat
  const tanahTanpa = aktif.filter((a) => golonganDari(a.kodeBarang) === '2' && !String(a.kib?.sertifikat || '').trim())
  tambah({
    kode: 'TANAH_SERTIFIKAT', tingkat: 'tinggi', tautan: '/aset', asetIds: ids(tanahTanpa),
    judul: 'Tanah belum bersertifikat atas nama Pemerintah RI',
    uraian: `${tanahTanpa.length} bidang tanah tidak memiliki nomor sertifikat di KIB.`,
    rekomendasi: 'Lengkapi KIB tanah; bila memang belum bersertifikat, ajukan pensertifikatan kepada BPN melalui Pengelola Barang.',
    dasar: 'PP 27/2014 jo. PP 28/2020 — BMN berupa tanah harus disertifikatkan',
  })

  // 4. Barang rusak berat masih tercatat aktif
  const rbAktif = aktif.filter((a) => a.kondisi === 'RB')
  tambah({
    kode: 'RB_AKTIF', tingkat: 'sedang', tautan: '/transaksi', asetIds: ids(rbAktif),
    judul: 'Barang rusak berat masih di neraca',
    uraian: `${rbAktif.length} NUP berkondisi Rusak Berat tetapi belum direklasifikasi; nilai aset tetap di neraca menjadi terlalu tinggi.`,
    rekomendasi: 'Bukukan Reklasifikasi ke Daftar Barang Rusak Berat, lalu ajukan usulan penghapusan.',
    dasar: 'PMK 181/2016 — Daftar Barang Rusak Berat',
  })

  // 5. RB/hilang belum diusulkan penghapusan
  const diusulkan = new Set(usulan.filter((u) => PENGHAPUSAN.includes(u.jenis) && u.status !== 'ditolak').flatMap((u) => u.asetIds || []))
  const belumUsul = aset.filter((a) => ['rusak_berat', 'hilang'].includes(a.status) && !diusulkan.has(a.id))
  tambah({
    kode: 'BELUM_USUL_HAPUS', tingkat: 'sedang', tautan: '/usulan', asetIds: ids(belumUsul),
    judul: 'Barang rusak berat/hilang belum diusulkan penghapusan',
    uraian: `${belumUsul.length} NUP berada di Daftar Barang Rusak Berat/Hilang tanpa usulan penghapusan.`,
    rekomendasi: 'Ajukan usulan pemindahtanganan, pemusnahan, atau penghapusan kepada Pengelola Barang.',
    dasar: 'PP 27/2014 jo. PP 28/2020 — penghapusan BMN',
  })

  // 6. BMN idle
  const idle = aktif.filter((a) => a.statusPenggunaan === 'idle')
  tambah({
    kode: 'BMN_IDLE', tingkat: 'sedang', tautan: '/usulan', asetIds: ids(idle),
    judul: 'BMN idle belum ditindaklanjuti',
    uraian: `${idle.length} NUP tidak digunakan untuk tugas dan fungsi satker.`,
    rekomendasi: 'Usulkan alih status penggunaan atau serahkan kepada Pengelola Barang; BMN idle tidak boleh menjadi dasar pengadaan baru.',
    dasar: 'Ketentuan penetapan dan penyerahan BMN idle',
  })

  // 7. Pemanfaatan sewa tanpa PNBP
  const skPnbp = new Set(pnbp.map((p) => p.nomorSK))
  const sewaTanpa = aktif.filter((a) => a.statusPenggunaan === 'dimanfaatkan' && a.pemanfaatan?.jenis === 'sewa' && !skPnbp.has(a.pemanfaatan?.nomorSK))
  tambah({
    kode: 'SEWA_PNBP', tingkat: 'sedang', tautan: '/laporan', asetIds: ids(sewaTanpa),
    judul: 'Sewa BMN tanpa PNBP tercatat',
    uraian: `${sewaTanpa.length} NUP disewakan tetapi tidak ada PNBP dengan nomor SK yang sama.`,
    rekomendasi: 'Pastikan uang sewa disetor ke kas negara dan dicatat di Buku PNBP.',
    dasar: 'PNBP dari pemanfaatan BMN wajib disetor ke kas negara',
  })

  // 8. Penggolongan intra/ekstrakomptabel tidak sesuai batas kapitalisasi aktif
  const salahBuku = aktif.filter((a) => !a.bersejarah && a.intrakomptabel !== isIntrakomptabel(a.kodeBarang, a.nilai, ref))
  tambah({
    kode: 'SALAH_BUKU', tingkat: 'sedang', tautan: '/aset', asetIds: ids(salahBuku),
    judul: 'Penggolongan intra/ekstrakomptabel tidak sesuai batas kapitalisasi',
    uraian: `${salahBuku.length} NUP tercatat di buku yang tidak sesuai dengan batas kapitalisasi yang berlaku.`,
    rekomendasi: 'Periksa nilai perolehan dan kebijakan kapitalisasi; bukukan koreksi nilai atau reklasifikasi bila perlu.',
    dasar: 'PMK 181/2016 — Buku Barang Intrakomptabel dan Ekstrakomptabel',
  })

  // 9. Nilai nol pada barang bukan bersejarah
  const nol = aktif.filter((a) => !a.bersejarah && !(Number(a.nilai) > 0))
  tambah({
    kode: 'NILAI_NOL', tingkat: 'sedang', tautan: '/transaksi', asetIds: ids(nol),
    judul: 'Barang tercatat tanpa nilai',
    uraian: `${nol.length} NUP bukan aset bersejarah bernilai Rp0.`,
    rekomendasi: 'Lakukan penilaian atau telusuri dokumen perolehan, lalu bukukan koreksi nilai.',
    dasar: 'BMN dicatat sebesar nilai perolehan atau nilai wajar',
  })

  // 10. Kelengkapan dokumen kendaraan
  const aabKurang = aktif.filter((a) => cariKode(a.kodeBarang)?.kib === 'aab' && (!a.kib?.nopol || !a.kib?.bpkb))
  tambah({
    kode: 'AAB_DOKUMEN', tingkat: 'sedang', tautan: '/aset', asetIds: ids(aabKurang),
    judul: 'Dokumen kepemilikan kendaraan belum lengkap',
    uraian: `${aabKurang.length} kendaraan tanpa nomor polisi atau BPKB di KIB.`,
    rekomendasi: 'Lengkapi KIB alat angkutan bermotor dan simpan BPKB sebagai dokumen kepemilikan.',
    dasar: 'PMK 181/2016 — Kartu Identitas Barang',
  })

  // 11. Penghapusan tanpa SK
  const tanpaSK = transaksi.filter((t) => t.kelompok === 'kurang' && !['koreksi_pencatatan', 'transfer_keluar', 'reklasifikasi_keluar'].includes(t.jenis) && t.dokumen?.jenis !== 'SK Penghapusan')
  tambah({
    kode: 'HAPUS_TANPA_SK', tingkat: 'sedang', tautan: '/transaksi', asetIds: [...new Set(tanpaSK.map((t) => t.asetId).filter(Boolean))],
    judul: 'Penghapusan dibukukan tanpa SK Penghapusan',
    uraian: `${tanpaSK.length} transaksi pengurangan memakai dokumen sumber selain SK Penghapusan.`,
    rekomendasi: 'Penghapusan hanya dibukukan berdasarkan keputusan penghapusan; lengkapi dokumen sumber.',
    dasar: 'PP 27/2014 jo. PP 28/2020 — penghapusan dengan keputusan',
  })

  // 12. Inventarisasi (sensus) minimal 5 tahun sekali
  const batas = new Date(tanggal); batas.setFullYear(batas.getFullYear() - 5)
  const sensusTerakhir = inventarisasi.filter((i) => i.jenis === 'sensus' && i.status === 'selesai').map((i) => i.tanggal).sort().at(-1)
  if (aktif.length && (!sensusTerakhir || sensusTerakhir < iso(batas))) {
    tambah({
      kode: 'SENSUS', tingkat: 'sedang', tautan: '/inventarisasi',
      judul: 'Inventarisasi (sensus) belum dilaksanakan dalam 5 tahun terakhir',
      uraian: sensusTerakhir ? `Sensus terakhir selesai ${sensusTerakhir}.` : 'Belum ada sensus yang diselesaikan.',
      rekomendasi: 'Laksanakan inventarisasi BMN dan bukukan hasilnya (koreksi kondisi, barang hilang).',
      dasar: 'PP 27/2014 jo. PP 28/2020 — inventarisasi paling sedikit sekali dalam 5 tahun',
    })
  }

  // 13. Lokasi ruangan kosong (DBR tidak lengkap)
  const tanpaLokasi = aktif.filter((a) => !a.lokasiRuang)
  tambah({
    kode: 'TANPA_LOKASI', tingkat: 'rendah', tautan: '/aset', asetIds: ids(tanpaLokasi),
    judul: 'Barang belum memiliki lokasi ruangan',
    uraian: `${tanpaLokasi.length} NUP tidak tercantum pada Daftar Barang Ruangan.`,
    rekomendasi: 'Isi lokasi ruangan pada detail aset agar DBR lengkap dan barang mudah ditelusuri.',
    dasar: 'PMK 181/2016 — Daftar Barang Ruangan',
  })

  // 14. Transaksi bertanggal di masa depan
  const depan = transaksi.filter((t) => t.tanggal > hariIni)
  tambah({
    kode: 'TANGGAL_DEPAN', tingkat: 'rendah', tautan: '/transaksi', asetIds: [...new Set(depan.map((t) => t.asetId).filter(Boolean))],
    judul: 'Transaksi bertanggal setelah hari ini',
    uraian: `${depan.length} transaksi dibukukan dengan tanggal yang belum terjadi.`,
    rekomendasi: 'Periksa tanggal dokumen sumber; tanggal pembukuan mengikuti tanggal dokumen.',
    dasar: 'Pembukuan berdasarkan dokumen sumber yang sah',
  })

  return out.sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat])
}

/** Skor kepatuhan sederhana 0–100: tiap temuan mengurangi skor sesuai tingkatnya. */
export function skorKepatuhan(temuan) {
  const bobot = { tinggi: 15, sedang: 7, rendah: 3 }
  return Math.max(0, 100 - temuan.reduce((s, t) => s + bobot[t.tingkat], 0))
}

/**
 * Ringkasan Neraca BMN per tanggal: menurut Buku Barang (transaksi) dan menurut Daftar Barang (aset).
 * Persediaan (aset lancar) diisi dari modul persediaan bila ada.
 */
export function neracaBMN({ aset = [], transaksi = [], persediaan = 0, tanggal = new Date() }) {
  const t = iso(tanggal)
  const buku = Object.fromEntries(hitungLBKP(transaksi, '1900-01-01', t).map((r) => [r.akun, r.saldoAkhir]))
  const daftar = saldoDariAset(aset)
  const susut = hitungPenyusutanPerAkun(aset, tanggal)
  const baris = (akun) => ({ akun, buku: buku[akun] || 0, daftar: daftar[akun] || 0 })

  const tetap = AKUN.filter((a) => kelompokNeraca(a) === 'Aset Tetap').map(baris)
  const susutTetap = AKUN.filter((a) => kelompokNeraca(a) === 'Aset Tetap').reduce((s, a) => s + (susut[a] || 0), 0)
  const atb = baris('Aset Tak Berwujud')
  const amortisasi = susut['Aset Tak Berwujud'] || 0
  const lain = baris('Aset Lain-lain')
  const jumlah = (l, k) => l.reduce((s, r) => s + r[k], 0)

  const kelompok = [
    { nama: 'Aset Lancar', baris: [{ akun: 'Persediaan', buku: persediaan, daftar: persediaan }], pengurang: [] },
    { nama: 'Aset Tetap', baris: tetap, pengurang: [{ akun: 'Akumulasi Penyusutan', nilai: -susutTetap }] },
    { nama: 'Aset Lainnya', baris: [atb, lain], pengurang: [{ akun: 'Akumulasi Amortisasi Aset Tak Berwujud', nilai: -amortisasi }] },
  ].map((k) => {
    const peng = k.pengurang.reduce((s, p) => s + p.nilai, 0)
    return { ...k, jumlahBuku: jumlah(k.baris, 'buku') + peng, jumlahDaftar: jumlah(k.baris, 'daftar') + peng }
  })
  return {
    kelompok,
    totalBuku: kelompok.reduce((s, k) => s + k.jumlahBuku, 0),
    totalDaftar: kelompok.reduce((s, k) => s + k.jumlahDaftar, 0),
  }
}

