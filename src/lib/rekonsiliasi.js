// Simulasi rekonsiliasi internal SIMAK-BMN (pembukuan barang) dengan SAKTI (realisasi belanja/akuntansi).
// Fungsi murni, diuji di tests/rekonsiliasi.test.js.
//
// Sisi SIMAK: perolehan BMN yang dibiayai belanja (pembelian, pengembangan nilai) + pembelian persediaan.
// Sisi SAKTI: realisasi belanja per SP2D yang diinput dosen (bertindak sebagai unit akuntansi).
import { AKUN } from './bmn.js'

export const AKUN_REKON = ['Persediaan', ...AKUN.filter((a) => a !== 'Aset Lain-lain')]

/** Akun belanja (Bagan Akun Standar) ILUSTRATIF untuk latihan → akun neraca. */
export const AKUN_BELANJA = [
  { kode: '521811', uraian: 'Belanja Barang Persediaan Barang Konsumsi', akun: 'Persediaan' },
  { kode: '531111', uraian: 'Belanja Modal Tanah', akun: 'Tanah' },
  { kode: '532111', uraian: 'Belanja Modal Peralatan dan Mesin', akun: 'Peralatan dan Mesin' },
  { kode: '533111', uraian: 'Belanja Modal Gedung dan Bangunan', akun: 'Gedung dan Bangunan' },
  { kode: '533121', uraian: 'Belanja Penambahan Nilai Gedung dan Bangunan', akun: 'Gedung dan Bangunan' },
  { kode: '534111', uraian: 'Belanja Modal Jalan, Irigasi dan Jaringan', akun: 'Jalan, Irigasi dan Jaringan' },
  { kode: '536111', uraian: 'Belanja Modal Lainnya', akun: 'Aset Tetap Lainnya' },
  { kode: '536112', uraian: 'Belanja Modal Aset Tak Berwujud', akun: 'Aset Tak Berwujud' },
]
export const akunDariBelanja = (kode) => AKUN_BELANJA.find((a) => a.kode === kode)?.akun || null

const JENIS_BELANJA = ['pembelian', 'pengembangan_nilai']
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const dalam = (t, mulai, akhir) => t >= mulai && t <= akhir

/** Baris SIMAK dari transaksi BMN dan mutasi persediaan dalam periode. */
export function itemSimak({ transaksi = [], mutasiPersediaan = [], mulai, akhir }) {
  const out = []
  for (const t of transaksi) {
    if (!JENIS_BELANJA.includes(t.jenis) || !dalam(t.tanggal, mulai, akhir)) continue
    const efek = (t.efek || []).reduce((s, e) => s + e.nilai, 0)
    out.push({
      id: t.id, sumber: 'BMN', tanggal: t.tanggal, akun: t.efek?.[0]?.akun || null, nilai: efek, nilaiBelanja: Number(t.nilai) || 0,
      intrakomptabel: efek > 0, uraian: `${t.namaJenis} ${t.kodeBarang} NUP ${t.nup} ${t.namaBarang || ''}`.trim(), nomor: t.dokumen?.nomor || '',
    })
  }
  for (const m of mutasiPersediaan) {
    if (m.jenis !== 'pembelian' || !dalam(m.tanggal, mulai, akhir)) continue
    out.push({ id: m.id, sumber: 'Persediaan', tanggal: m.tanggal, akun: 'Persediaan', nilai: m.nilai, nilaiBelanja: m.nilai, intrakomptabel: true, uraian: `Pembelian persediaan ${m.nama}`, nomor: m.dokumen?.nomor || '' })
  }
  return out
}

/**
 * Rekonsiliasi per akun + pencocokan per dokumen (nomor SP2D/dokumen sumber).
 * @returns {{perAkun:{akun,simak,sakti,selisih}[], cocok:[], hanyaSimak:[], hanyaSakti:[], beda:[], ekstrakomptabel:[], seimbang:boolean}}
 */
export function rekonsiliasi({ transaksi = [], mutasiPersediaan = [], sakti = [], mulai, akhir }) {
  const simak = itemSimak({ transaksi, mutasiPersediaan, mulai, akhir })
  const ekstrakomptabel = simak.filter((s) => !s.intrakomptabel && s.nilaiBelanja > 0)
  const sisiSimak = simak.filter((s) => s.intrakomptabel)
  const sisiSakti = sakti.filter((s) => dalam(s.tanggal, mulai, akhir)).map((s) => ({ ...s, akun: s.akun || akunDariBelanja(s.akunBelanja), nilai: Number(s.nilai) || 0 }))

  const perAkun = AKUN_REKON.map((akun) => {
    const a = sisiSimak.filter((s) => s.akun === akun).reduce((x, s) => x + s.nilai, 0)
    const b = sisiSakti.filter((s) => s.akun === akun).reduce((x, s) => x + s.nilai, 0)
    return { akun, simak: a, sakti: b, selisih: a - b }
  }).filter((r) => r.simak || r.sakti)

  // Pencocokan dokumen: nomor sama → cocok (nilai/akun sama) atau beda; sisanya hanya di satu sisi.
  const pakai = new Set()
  const cocok = []
  const beda = []
  const hanyaSimak = []
  for (const s of sisiSimak) {
    const k = sisiSakti.find((x) => !pakai.has(x.id) && norm(x.nomorSP2D) && norm(x.nomorSP2D) === norm(s.nomor))
    if (!k) { hanyaSimak.push(s); continue }
    pakai.add(k.id)
    if (k.nilai === s.nilai && k.akun === s.akun) cocok.push({ simak: s, sakti: k })
    else beda.push({ simak: s, sakti: k, catatan: [k.nilai !== s.nilai && 'nilai berbeda', k.akun !== s.akun && 'akun berbeda'].filter(Boolean).join(', ') })
  }
  // Belanja untuk barang di bawah batas kapitalisasi: SP2D-nya dikenali, tetapi tidak menambah neraca (perlu dijelaskan)
  const ekstra = ekstrakomptabel.map((s) => {
    const k = sisiSakti.find((x) => !pakai.has(x.id) && norm(x.nomorSP2D) && norm(x.nomorSP2D) === norm(s.nomor))
    if (k) pakai.add(k.id)
    return { ...s, sakti: k || null }
  })
  const hanyaSakti = sisiSakti.filter((k) => !pakai.has(k.id))
  return { perAkun, cocok, beda, hanyaSimak, hanyaSakti, ekstrakomptabel: ekstra, seimbang: perAkun.every((r) => r.selisih === 0) }
}

/** Data SAKTI awal yang sama persis dengan Buku Barang (dosen lalu menyisipkan perbedaan untuk latihan). */
export function saktiDariSimak(args) {
  return itemSimak(args).filter((s) => s.nilaiBelanja > 0).map((s) => ({
    tanggal: s.tanggal,
    akun: s.akun || 'Peralatan dan Mesin',
    akunBelanja: AKUN_BELANJA.find((a) => a.akun === (s.akun || 'Peralatan dan Mesin'))?.kode || '',
    uraian: s.uraian,
    nilai: s.nilaiBelanja,
    nomorSP2D: s.nomor,
  }))
}
