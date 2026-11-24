import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PersediaanError, lbkpPersediaan, nilaiBarang, selisihOpname, terapkanMutasi } from '../src/lib/persediaan.js'

const dok = { jenis: 'BAST', nomor: '1' }
const kosong = { id: 'b1', kode: '1.01.03.01.001', nama: 'Kertas HVS', satuan: 'rim', saldoQty: 0, lapisan: [] }

function jalankan(barang, inputs) {
  const mutasi = []
  for (const i of inputs) {
    const h = terapkanMutasi(barang, { dokumen: dok, ...i })
    barang = { id: 'b1', ...h.barang }
    mutasi.push({ ...h.mutasi, barangId: 'b1' })
  }
  return { barang, mutasi }
}

test('FIFO: pengeluaran memakai harga penerimaan paling awal', () => {
  const { barang, mutasi } = jalankan(kosong, [
    { jenis: 'saldo_awal', tanggal: '2026-01-01', qty: 10, hargaSatuan: 50_000 },
    { jenis: 'pembelian', tanggal: '2026-02-01', qty: 10, hargaSatuan: 60_000 },
    { jenis: 'pemakaian', tanggal: '2026-03-01', qty: 15 },
  ])
  assert.equal(mutasi[2].nilai, 10 * 50_000 + 5 * 60_000)
  assert.deepEqual(mutasi[2].rincian, [{ qty: 10, harga: 50_000 }, { qty: 5, harga: 60_000 }])
  assert.equal(barang.saldoQty, 5)
  assert.equal(nilaiBarang(barang), 300_000)
  assert.deepEqual(barang.lapisan, [{ tanggal: '2026-02-01', qty: 5, harga: 60_000 }])
})

test('validasi: saldo tidak cukup, kuantitas pecahan, mutasi mundur tanggal, dokumen wajib', () => {
  const { barang } = jalankan(kosong, [{ jenis: 'pembelian', tanggal: '2026-02-01', qty: 3, hargaSatuan: 1000 }])
  assert.throws(() => terapkanMutasi(barang, { jenis: 'pemakaian', tanggal: '2026-02-02', qty: 4, dokumen: dok }), /Saldo tidak cukup: tersedia 3 rim/)
  assert.throws(() => terapkanMutasi(barang, { jenis: 'pemakaian', tanggal: '2026-02-02', qty: 1.5, dokumen: dok }), PersediaanError)
  assert.throws(() => terapkanMutasi(barang, { jenis: 'pemakaian', tanggal: '2026-01-31', qty: 1, dokumen: dok }), /kronologis/)
  assert.throws(() => terapkanMutasi(barang, { jenis: 'pemakaian', tanggal: '2026-02-02', qty: 1, dokumen: {} }), /Dokumen/)
})

test('opname: selisih fisik menjadi mutasi selisih lebih/kurang; selisih lebih memakai harga terakhir', () => {
  const { barang } = jalankan(kosong, [
    { jenis: 'pembelian', tanggal: '2026-01-05', qty: 10, hargaSatuan: 1000 },
    { jenis: 'pembelian', tanggal: '2026-01-06', qty: 10, hargaSatuan: 1200 },
  ])
  const b2 = { ...barang, id: 'b2', saldoQty: 20 }
  const sel = selisihOpname([barang, b2, { ...barang, id: 'b3' }], { b1: 18, b2: 22 }, { tanggal: '2026-06-30', dokumen: dok })
  assert.deepEqual(sel.map((s) => [s.barangId, s.input.jenis, s.input.qty]), [['b1', 'selisih_kurang', 2], ['b2', 'selisih_lebih', 2]])
  const lebih = terapkanMutasi(b2, sel[1].input)
  assert.equal(lebih.mutasi.nilai, 2 * 1200)
})

test('LBKP persediaan: saldo awal + masuk − keluar = saldo akhir, sama dengan nilai barang', () => {
  const { barang, mutasi } = jalankan(kosong, [
    { jenis: 'saldo_awal', tanggal: '2025-12-31', qty: 10, hargaSatuan: 50_000 },
    { jenis: 'pembelian', tanggal: '2026-02-01', qty: 10, hargaSatuan: 60_000 },
    { jenis: 'pemakaian', tanggal: '2026-03-01', qty: 15 },
    { jenis: 'pembelian', tanggal: '2026-08-01', qty: 4, hargaSatuan: 70_000 },
  ])
  const [r] = lbkpPersediaan([barang], mutasi, '2026-01-01', '2026-06-30')
  assert.deepEqual([r.awalQty, r.awal, r.masukQty, r.masuk, r.keluarQty, r.keluar, r.akhirQty, r.akhir], [10, 500_000, 10, 600_000, 15, 800_000, 5, 300_000])
  const [th] = lbkpPersediaan([barang], mutasi, '2026-01-01', '2026-12-31')
  assert.equal(th.akhir, nilaiBarang(barang))
})
