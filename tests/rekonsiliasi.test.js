import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terapkanTransaksi } from '../src/lib/bmn.js'
import { rekonsiliasi, saktiDariSimak } from '../src/lib/rekonsiliasi.js'

function data() {
  const trx = []
  const aset = {}
  const catat = (input, id = null) => {
    const h = terapkanTransaksi(id ? aset[id] : null, input)
    const aid = id || `a${Object.keys(aset).length}`
    aset[aid] = h.aset
    trx.push({ id: `t${trx.length}`, ...h.transaksi, asetId: aid })
    return aid
  }
  const g = catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '4.01.01.01.001', nup: 1, nilai: 6_000_000_000, dokumen: { jenis: 'X', nomor: 'LBKP' } })
  catat({ jenis: 'pembelian', tanggal: '2026-02-10', kodeBarang: '3.10.01.02.002', nup: 1, nilai: 15_000_000, dokumen: { jenis: 'SP2D', nomor: 'SP2D-001' } })
  catat({ jenis: 'pembelian', tanggal: '2026-03-01', kodeBarang: '3.05.01.05.010', nup: 1, nilai: 750_000, dokumen: { jenis: 'SP2D', nomor: 'SP2D-002' } }) // ekstrakomptabel
  catat({ jenis: 'pengembangan_nilai', tanggal: '2026-04-01', nilai: 450_000_000, dokumen: { jenis: 'SP2D', nomor: 'SP2D-003' } }, g)
  catat({ jenis: 'hibah_masuk', tanggal: '2026-04-05', kodeBarang: '3.10.02.03.003', nup: 1, nilai: 3_000_000, dokumen: { jenis: 'Naskah Hibah', nomor: 'NH-1' } }) // bukan belanja
  const mutasiPersediaan = [{ id: 'm1', jenis: 'pembelian', tanggal: '2026-05-01', nama: 'Kertas', nilai: 550_000, dokumen: { nomor: 'SP2D-004' } }]
  return { transaksi: trx, mutasiPersediaan, mulai: '2026-01-01', akhir: '2026-06-30' }
}

test('SAKTI disalin dari SIMAK → seimbang, semua dokumen cocok', () => {
  const d = data()
  const sakti = saktiDariSimak(d).map((s, i) => ({ id: `k${i}`, ...s }))
  const r = rekonsiliasi({ ...d, sakti: sakti.filter((s) => s.nomorSP2D !== 'SP2D-002') })
  assert.equal(r.seimbang, true)
  assert.equal(r.cocok.length, 3)
  assert.deepEqual(r.perAkun.map((x) => x.akun), ['Persediaan', 'Peralatan dan Mesin', 'Gedung dan Bangunan'])
  assert.equal(r.ekstrakomptabel.length, 1) // meja di bawah kapitalisasi: belanja tidak menambah neraca
  assert.equal(r.hanyaSimak.length + r.hanyaSakti.length + r.beda.length, 0)
})

test('selisih: belanja modal tanpa pencatatan BMN, nilai beda, dan ekstrakomptabel dibayar belanja modal', () => {
  const d = data()
  const sakti = saktiDariSimak(d).map((s, i) => ({ id: `k${i}`, ...s }))
  sakti.find((s) => s.nomorSP2D === 'SP2D-003').nilai = 400_000_000 // nilai beda
  sakti.push({ id: 'kx', tanggal: '2026-06-01', akunBelanja: '532111', uraian: 'Pembelian proyektor', nilai: 8_000_000, nomorSP2D: 'SP2D-009' }) // belum dicatat SIMAK
  const r = rekonsiliasi({ ...d, sakti })
  const pm = r.perAkun.find((x) => x.akun === 'Peralatan dan Mesin')
  assert.equal(pm.selisih, 15_000_000 - (15_000_000 + 750_000 + 8_000_000))
  assert.equal(r.perAkun.find((x) => x.akun === 'Gedung dan Bangunan').selisih, 50_000_000)
  assert.deepEqual(r.beda.map((b) => b.catatan), ['nilai berbeda'])
  assert.deepEqual(r.hanyaSakti.map((s) => s.nomorSP2D), ['SP2D-009'])
  assert.equal(r.ekstrakomptabel[0].sakti.nomorSP2D, 'SP2D-002') // dikenali sebagai belanja untuk barang ekstrakomptabel
  assert.equal(r.seimbang, false)
})

test('periode membatasi kedua sisi', () => {
  const d = data()
  const sakti = saktiDariSimak(d).map((s, i) => ({ id: `k${i}`, ...s }))
  const r = rekonsiliasi({ ...d, sakti, mulai: '2026-01-01', akhir: '2026-02-28' })
  assert.deepEqual(r.perAkun.map((x) => [x.akun, x.simak, x.sakti]), [['Peralatan dan Mesin', 15_000_000, 15_000_000]])
})
