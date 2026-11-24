import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terapkanTransaksi } from '../src/lib/bmn.js'
import { neracaBMN, skorKepatuhan, temuanWasdal } from '../src/lib/wasdal.js'

const dok = { jenis: 'BAST', nomor: 'X' }
function satker() {
  const aset = []
  const transaksi = []
  const catat = (input, idx = null) => {
    const h = terapkanTransaksi(idx === null ? null : aset[idx], { dokumen: dok, ...input })
    const id = idx === null ? `a${aset.length}` : aset[idx].id
    if (idx === null) aset.push({ id, ...h.aset }); else aset[idx] = { id, ...h.aset }
    transaksi.push({ ...h.transaksi, asetId: id })
  }
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '2.01.01.01.001', nup: 1, nilai: 1_000_000_000, lokasiRuang: 'Kampus', kib: { sertifikat: 'SHP 1' } })
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '3.10.01.02.002', nup: 1, nilai: 15_000_000, tglPerolehan: '2024-01-10', lokasiRuang: 'R. 1' })
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '8.01.01.01.001', nup: 1, nilai: 40_000_000, tglPerolehan: '2024-01-10', lokasiRuang: 'Server' })
  const inventarisasi = [{ jenis: 'sensus', status: 'selesai', tanggal: '2025-06-30' }]
  return { aset, transaksi, inventarisasi, catat }
}
const kode = (t) => t.map((x) => x.kode)
const TGL = new Date('2026-07-01')

test('satker tertib: tidak ada temuan, skor 100', () => {
  const s = satker()
  const t = temuanWasdal({ ...s, tanggal: TGL })
  assert.deepEqual(kode(t), [])
  assert.equal(skorKepatuhan(t), 100)
})

test('mengubah nilai aset tanpa transaksi → selisih Buku Barang vs Daftar Barang (tinggi)', () => {
  const s = satker()
  s.aset[1].nilai = 20_000_000
  const t = temuanWasdal({ ...s, tanggal: TGL })
  assert.equal(t[0].kode, 'SELISIH_BUKU')
  assert.equal(t[0].tingkat, 'tinggi')
  assert.match(t[0].uraian, /Peralatan dan Mesin/)
})

test('RB belum direklasifikasi, lalu belum diusulkan penghapusan', () => {
  const s = satker()
  s.catat({ jenis: 'koreksi_kondisi', tanggal: '2026-02-01', kondisiBaru: 'RB' }, 1)
  assert.ok(kode(temuanWasdal({ ...s, tanggal: TGL })).includes('RB_AKTIF'))
  s.catat({ jenis: 'reklasifikasi_rusak_berat', tanggal: '2026-02-02' }, 1)
  let t = kode(temuanWasdal({ ...s, tanggal: TGL }))
  assert.ok(!t.includes('RB_AKTIF') && t.includes('BELUM_USUL_HAPUS') && !t.includes('SELISIH_BUKU'))
  t = kode(temuanWasdal({ ...s, tanggal: TGL, usulan: [{ jenis: 'penghapusan', status: 'diajukan', asetIds: ['a1'] }] }))
  assert.ok(!t.includes('BELUM_USUL_HAPUS'))
})

test('tanah tanpa sertifikat, NUP ganda, lokasi kosong, sensus kedaluwarsa', () => {
  const s = satker()
  s.aset[0].kib = {}
  s.aset.push({ ...s.aset[1], id: 'dup', lokasiRuang: '' })
  s.transaksi.push({ ...s.transaksi[1], asetId: 'dup' })
  const t = kode(temuanWasdal({ ...s, inventarisasi: [], tanggal: TGL }))
  for (const k of ['TANAH_SERTIFIKAT', 'NUP_GANDA', 'TANPA_LOKASI', 'SENSUS']) assert.ok(t.includes(k), k)
  assert.equal(t[0], 'NUP_GANDA') // tinggi diurutkan lebih dulu
})

test('penghapusan tanpa SK dan transaksi bertanggal masa depan', () => {
  const s = satker()
  s.catat({ jenis: 'penjualan', tanggal: '2026-08-01' }, 1)
  const t = kode(temuanWasdal({ ...s, tanggal: TGL }))
  assert.ok(t.includes('HAPUS_TANPA_SK') && t.includes('TANGGAL_DEPAN'))
})

test('neraca: Buku Barang = Daftar Barang saat tertib; berbeda saat nilai diubah langsung', () => {
  const s = satker()
  let n = neracaBMN({ ...s, persediaan: 5_000_000, tanggal: TGL })
  assert.equal(n.totalBuku, n.totalDaftar)
  const tetap = n.kelompok.find((k) => k.nama === 'Aset Tetap')
  assert.equal(tetap.baris.find((b) => b.akun === 'Tanah').buku, 1_000_000_000)
  assert.ok(tetap.pengurang[0].nilai < 0)
  assert.equal(n.kelompok[0].jumlahBuku, 5_000_000)
  s.aset[1].nilai = 20_000_000
  n = neracaBMN({ ...s, tanggal: TGL })
  assert.equal(n.totalDaftar - n.totalBuku, 5_000_000)
})
