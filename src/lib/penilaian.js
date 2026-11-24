// Penilaian otomatis skenario kasus: jawaban mahasiswa (transaksi yang dibukukan) dibandingkan dengan kunci.
// Fungsi murni — diuji di tests/penilaian.test.js.
import { JENIS_TRANSAKSI } from './bmn.js'

/** Konversi angka ke huruf. Sesuaikan dengan pedoman akademik kampus bila berbeda. */
export const SKALA_HURUF = [[80, 'A'], [75, 'AB'], [70, 'B'], [65, 'BC'], [60, 'C'], [50, 'D'], [0, 'E']]
export const huruf = (n) => SKALA_HURUF.find(([b]) => n >= b)[1]

export const SUMBER_RUBRIK = {
  otomatis: 'Otomatis dari langkah skenario',
  wasdal: 'Skor kepatuhan wasdal',
  manual: 'Dinilai dosen',
}

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const kelompok = (jenis) => JENIS_TRANSAKSI[jenis]?.kelompok

/**
 * Kriteria yang dinilai untuk satu kunci. Bobot dinormalisasi ke kriteria yang berlaku.
 * kunci: { jenis, tanggal, nomorDokumen, kodeBarang?, target?: {kodeBarang, nup}, nilai?, kondisiBaru? }
 */
function kriteria(kunci, t) {
  const k = []
  const add = (nama, bobot, harap, dapat, ok) => k.push({ nama, bobot, harap, dapat, ok })
  add('Jenis transaksi', 35, JENIS_TRANSAKSI[kunci.jenis]?.nama || kunci.jenis, t ? t.namaJenis || t.jenis : '—', !!t && t.jenis === kunci.jenis)
  add('Tanggal', 15, kunci.tanggal, t?.tanggal || '—', !!t && t.tanggal === kunci.tanggal)
  if (kelompok(kunci.jenis) === 'tambah' || !kunci.target) {
    add('Kode barang', 20, kunci.kodeBarang || '—', t?.kodeBarang || '—', !!t && (!kunci.kodeBarang || t.kodeBarang === kunci.kodeBarang))
  } else {
    const h = `${kunci.target.kodeBarang} NUP ${kunci.target.nup}`
    add('Barang yang ditransaksikan', 20, h, t ? `${t.kodeBarang} NUP ${t.nup}` : '—', !!t && t.kodeBarang === kunci.target.kodeBarang && Number(t.nup) === Number(kunci.target.nup))
  }
  if (kunci.nilai !== undefined && kunci.nilai !== null && kunci.nilai !== '') {
    add('Nilai', 20, Number(kunci.nilai), t ? Number(t.nilai) : '—', !!t && Number(t.nilai) === Number(kunci.nilai))
  }
  if (kunci.kondisiBaru) add('Kondisi baru', 20, kunci.kondisiBaru, t?.kondisiBaru || '—', !!t && t.kondisiBaru === kunci.kondisiBaru)
  add('Nomor dokumen sumber', 10, kunci.nomorDokumen || '—', t?.dokumen?.nomor || '—', !!t && (!kunci.nomorDokumen || norm(t.dokumen?.nomor) === norm(kunci.nomorDokumen)))
  return k
}

const skorDari = (k) => {
  const total = k.reduce((s, x) => s + x.bobot, 0)
  return total ? k.reduce((s, x) => s + (x.ok ? x.bobot : 0), 0) / total : 0
}

/**
 * Cocokkan setiap langkah dengan satu transaksi (sekali pakai). Urutan pencarian kandidat:
 * nomor dokumen + jenis sama → nomor dokumen sama → jenis + tanggal sama. Dari kandidat dipilih skor tertinggi.
 * @returns {{id, skor:number, transaksiId:string|null, kriteria:object[]}[]}
 */
export function nilaiLangkah(langkah, kunciMap, transaksi) {
  const terpakai = new Set()
  return langkah.map((l) => {
    const kunci = kunciMap?.[l.id]
    if (!kunci?.jenis) return { id: l.id, skor: 0, transaksiId: null, kriteria: [], tanpaKunci: true }
    const bebas = transaksi.filter((t) => !terpakai.has(t.id))
    const nomor = norm(kunci.nomorDokumen)
    const kandidat = [
      bebas.filter((t) => nomor && norm(t.dokumen?.nomor) === nomor && t.jenis === kunci.jenis),
      bebas.filter((t) => nomor && norm(t.dokumen?.nomor) === nomor),
      bebas.filter((t) => t.jenis === kunci.jenis && t.tanggal === kunci.tanggal),
    ].find((l) => l.length) || []
    let terbaik = null
    for (const t of kandidat) {
      const k = kriteria(kunci, t)
      const s = skorDari(k)
      if (!terbaik || s > terbaik.skor) terbaik = { t, k, skor: s }
    }
    if (!terbaik) return { id: l.id, skor: 0, transaksiId: null, kriteria: kriteria(kunci, null) }
    terpakai.add(terbaik.t.id)
    return { id: l.id, skor: terbaik.skor, transaksiId: terbaik.t.id, kriteria: terbaik.k }
  })
}

/**
 * Nilai akhir satu satker untuk satu skenario.
 * rubrik: [{id, kode, uraian, bobot, sumber: 'otomatis'|'wasdal'|'manual'}]
 * langkah: [{id, narasi, rubrikId, bobot}]
 * manual: {rubrikId: 0..100}; skorWasdal: 0..100
 */
export function nilaiSkenario({ rubrik = [], langkah = [] }, kunciMap, transaksi, { manual = {}, skorWasdal = 0 } = {}) {
  const hasilLangkah = nilaiLangkah(langkah, kunciMap, transaksi)
  const perRubrik = rubrik.map((r) => {
    let skor = null
    if (r.sumber === 'manual') skor = manual[r.id] === undefined || manual[r.id] === '' ? null : Math.max(0, Math.min(100, Number(manual[r.id])))
    else if (r.sumber === 'wasdal') skor = skorWasdal
    else {
      const ls = langkah.map((l, i) => ({ l, h: hasilLangkah[i] })).filter(({ l }) => l.rubrikId === r.id)
      const b = ls.reduce((s, { l }) => s + (Number(l.bobot) || 1), 0)
      skor = b ? (ls.reduce((s, { l, h }) => s + (Number(l.bobot) || 1) * h.skor, 0) / b) * 100 : null
    }
    return { id: r.id, kode: r.kode, uraian: r.uraian, bobot: Number(r.bobot) || 0, sumber: r.sumber, skor: skor === null ? null : Math.round(skor * 100) / 100 }
  })
  const dinilai = perRubrik.filter((r) => r.skor !== null && r.bobot > 0)
  const totalBobot = dinilai.reduce((s, r) => s + r.bobot, 0)
  const total = totalBobot ? Math.round((dinilai.reduce((s, r) => s + r.bobot * r.skor, 0) / totalBobot) * 100) / 100 : 0
  const lengkap = perRubrik.every((r) => r.skor !== null || !r.bobot)
  return { langkah: hasilLangkah, rubrik: perRubrik, total, huruf: huruf(total), lengkap }
}

const id = (p, i) => `${p}${i + 1}`

/** Contoh skenario siap pakai, berbasis data contoh satker (Kelas & Satker → Isi data contoh). */
export function templatSkenario(tahun = new Date().getFullYear()) {
  const rubrik = [
    { id: 'r1', kode: 'Sub-CPMK 1', uraian: 'Membukukan perolehan BMN sesuai dokumen sumber', bobot: 35, sumber: 'otomatis' },
    { id: 'r2', kode: 'Sub-CPMK 2', uraian: 'Membukukan perubahan kondisi, nilai, dan reklasifikasi BMN', bobot: 35, sumber: 'otomatis' },
    { id: 'r3', kode: 'Sub-CPMK 3', uraian: 'Menjaga ketertiban penatausahaan (hasil wasdal)', bobot: 15, sumber: 'wasdal' },
    { id: 'r4', kode: 'Sub-CPMK 4', uraian: 'Menganalisis dampak transaksi pada LBKP dan neraca (dinilai dosen)', bobot: 15, sumber: 'manual' },
  ]
  const data = [
    ['r1', `Pada 15 Maret ${tahun} satker menerima hibah 1 unit laptop dari PT Sambas Digital senilai Rp15.000.000 berdasarkan Naskah Hibah nomor NH-01/${tahun}. Laptop ditempatkan di R. Prodi ASP.`,
      { jenis: 'hibah_masuk', tanggal: `${tahun}-03-15`, kodeBarang: '3.10.01.02.002', nilai: 15000000, nomorDokumen: `NH-01/${tahun}` }],
    ['r1', `Pada 2 April ${tahun} satker membeli 1 unit printer seharga Rp3.500.000. SP2D nomor 240401/${tahun} terbit pada tanggal yang sama.`,
      { jenis: 'pembelian', tanggal: `${tahun}-04-02`, kodeBarang: '3.10.02.03.003', nilai: 3500000, nomorDokumen: `240401/${tahun}` }],
    ['r1', `Pada 8 April ${tahun} satker membeli 1 meja kerja pegawai seharga Rp750.000 (kuitansi KW-08/${tahun}). Perhatikan batas kapitalisasi.`,
      { jenis: 'pembelian', tanggal: `${tahun}-04-08`, kodeBarang: '3.05.01.05.010', nilai: 750000, nomorDokumen: `KW-08/${tahun}` }],
    ['r2', `Pada 10 Mei ${tahun} pemeriksaan kondisi (BA-PK-01/${tahun}) menyatakan Laptop NUP 2 rusak berat. Catat perubahan kondisinya.`,
      { jenis: 'koreksi_kondisi', tanggal: `${tahun}-05-10`, target: { kodeBarang: '3.10.01.02.002', nup: 2 }, kondisiBaru: 'RB', nomorDokumen: `BA-PK-01/${tahun}` }],
    ['r2', `Berdasarkan berita acara yang sama, pada 11 Mei ${tahun} Laptop NUP 2 dikeluarkan dari neraca ke Daftar Barang Rusak Berat.`,
      { jenis: 'reklasifikasi_rusak_berat', tanggal: `${tahun}-05-11`, target: { kodeBarang: '3.10.01.02.002', nup: 2 }, nomorDokumen: `BA-PK-01/${tahun}` }],
    ['r2', `Pada 20 Juni ${tahun} renovasi Gedung Kantor (NUP 1) selesai dengan nilai Rp450.000.000 dan menambah masa manfaat. SP2D nomor 240620/${tahun}.`,
      { jenis: 'pengembangan_nilai', tanggal: `${tahun}-06-20`, target: { kodeBarang: '4.01.01.01.001', nup: 1 }, nilai: 450000000, nomorDokumen: `240620/${tahun}` }],
  ]
  const langkah = data.map(([rubrikId, narasi], i) => ({ id: id('l', i), narasi, rubrikId, bobot: 1 }))
  const kunci = Object.fromEntries(data.map(([, , k], i) => [id('l', i), k]))
  return {
    judul: `Kasus Semester I ${tahun}: Mutasi BMN Satker`,
    petunjuk: 'Bukukan setiap peristiwa di menu Transaksi BMN. Isi nomor dokumen persis seperti pada soal agar jawaban dapat dikenali. Setelah selesai, periksa LBKP Semester I dan menu Wasdal.',
    rubrik, langkah, kunci,
  }
}
