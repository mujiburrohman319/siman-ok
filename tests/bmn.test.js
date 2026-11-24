import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  terapkanTransaksi, hitungLBKP, saldoDariAset, hitungPenyusutan, cekObjekPemeliharaan,
  validasiBarisPengadaan, isIntrakomptabel, aksiPersetujuan, TransaksiError,
} from '../src/lib/bmn.js'

const dok = { jenis: 'BAST', nomor: '001/BAST/2025' }

function beli(kode, nilai, tanggal = '2025-03-10', extra = {}) {
  return terapkanTransaksi(null, { jenis: 'pembelian', tanggal, kodeBarang: kode, nilai, nup: 1, dokumen: dok, ...extra })
}

test('kapitalisasi: laptop murah masuk ekstrakomptabel, gedung di atas batas intrakomptabel', () => {
  assert.equal(isIntrakomptabel('3.10.01.02.002', 900_000), false)
  assert.equal(isIntrakomptabel('3.10.01.02.002', 12_000_000), true)
  assert.equal(isIntrakomptabel('4.01.01.01.001', 20_000_000), false)
  assert.equal(isIntrakomptabel('2.01.01.01.001', 1), true)
})

test('perolehan membuat aset dan efek neraca hanya untuk intrakomptabel', () => {
  const a = beli('3.10.01.02.002', 15_000_000)
  assert.equal(a.aset.status, 'aktif')
  assert.deepEqual(a.transaksi.efek, [{ akun: 'Peralatan dan Mesin', nilai: 15_000_000 }])
  const b = beli('3.10.01.02.002', 500_000)
  assert.equal(b.aset.intrakomptabel, false)
  assert.deepEqual(b.transaksi.efek, [])
})

test('dokumen sumber wajib', () => {
  assert.throws(() => terapkanTransaksi(null, { jenis: 'pembelian', tanggal: '2025-01-01', kodeBarang: '3.10.01.02.002', nilai: 1 }), TransaksiError)
})

test('pengembangan memindahkan aset ekstra ke intra ketika melewati batas', () => {
  const a = beli('3.10.01.02.002', 800_000).aset
  const r = terapkanTransaksi(a, { jenis: 'pengembangan_nilai', tanggal: '2025-05-01', nilai: 400_000, dokumen: dok })
  assert.equal(r.aset.intrakomptabel, true)
  assert.deepEqual(r.transaksi.efek, [{ akun: 'Peralatan dan Mesin', nilai: 1_200_000 }])
})

test('reklasifikasi rusak berat butuh kondisi RB dan mengeluarkan nilai dari neraca', () => {
  const a = beli('3.02.01.01.003', 300_000_000).aset
  assert.throws(() => terapkanTransaksi(a, { jenis: 'reklasifikasi_rusak_berat', tanggal: '2025-06-01', dokumen: dok }), TransaksiError)
  const rb = terapkanTransaksi(a, { jenis: 'koreksi_kondisi', tanggal: '2025-06-01', kondisiBaru: 'RB', dokumen: dok }).aset
  const r = terapkanTransaksi(rb, { jenis: 'reklasifikasi_rusak_berat', tanggal: '2025-06-02', dokumen: dok })
  assert.equal(r.aset.status, 'rusak_berat')
  assert.deepEqual(r.transaksi.efek, [{ akun: 'Peralatan dan Mesin', nilai: -300_000_000 }])
  // penghapusan dari daftar RB tidak mengubah neraca lagi
  const h = terapkanTransaksi(r.aset, { jenis: 'penghapusan', tanggal: '2025-09-01', dokumen: { jenis: 'SK Penghapusan', nomor: 'X' } })
  assert.equal(h.aset.status, 'dihapus')
  assert.deepEqual(h.transaksi.efek, [])
})

test('LBKP: saldo awal + tambah + kurang = saldo akhir dan sama dengan saldo dari aset', () => {
  const trx = []
  const aset = {}
  const catat = (id, r) => { aset[id] = r.aset; trx.push(r.transaksi) }
  catat('t', terapkanTransaksi(null, { jenis: 'saldo_awal', tanggal: '2024-12-31', kodeBarang: '2.01.01.01.001', nilai: 2_000_000_000, nup: 1, dokumen: dok }))
  catat('g', terapkanTransaksi(null, { jenis: 'saldo_awal', tanggal: '2024-12-31', kodeBarang: '4.01.01.01.001', nilai: 5_000_000_000, nup: 1, dokumen: dok }))
  catat('l', beli('3.10.01.02.002', 15_000_000, '2025-02-01'))
  catat('m', beli('3.02.01.01.003', 400_000_000, '2025-03-01'))
  catat('m', terapkanTransaksi(aset.m, { jenis: 'hibah_keluar', tanggal: '2025-05-20', dokumen: dok }))
  catat('g', terapkanTransaksi(aset.g, { jenis: 'pengembangan_nilai', tanggal: '2025-04-01', nilai: 250_000_000, dokumen: dok }))
  catat('l', terapkanTransaksi(aset.l, { jenis: 'penghentian_penggunaan', tanggal: '2025-06-10', dokumen: dok }))

  const lbkp = hitungLBKP(trx, '2025-01-01', '2025-06-30')
  const row = (a) => lbkp.find((r) => r.akun === a)
  assert.equal(row('Tanah').saldoAwal, 2_000_000_000)
  assert.equal(row('Gedung dan Bangunan').tambah, 250_000_000)
  assert.equal(row('Peralatan dan Mesin').tambah, 415_000_000)
  assert.equal(row('Peralatan dan Mesin').kurang, -415_000_000)
  assert.equal(row('Aset Lain-lain').saldoAkhir, 15_000_000)
  for (const r of lbkp) assert.equal(r.saldoAkhir, r.saldoAwal + r.tambah + r.kurang)
  const dariAset = saldoDariAset(Object.values(aset))
  for (const r of lbkp) assert.equal(r.saldoAkhir, dariAset[r.akun] || 0, r.akun)
})

test('penyusutan semesteran: laptop 4 tahun, semester perolehan dihitung penuh', () => {
  const a = beli('3.10.01.02.002', 16_000_000, '2025-03-10').aset
  const p = hitungPenyusutan(a, '2025-12-31')
  assert.equal(p.semester, 2)
  assert.equal(p.akumulasi, 4_000_000)
  assert.equal(p.nilaiBuku, 12_000_000)
  assert.equal(hitungPenyusutan(a, '2035-12-31').nilaiBuku, 0)
  const tanah = beli('2.01.01.01.001', 1_000_000_000).aset
  assert.equal(hitungPenyusutan(tanah, '2030-12-31').akumulasi, 0)
})

test('objek RKBMN pemeliharaan sesuai PMK 150/2014', () => {
  const laptop = beli('3.10.01.02.002', 15_000_000).aset
  assert.equal(cekObjekPemeliharaan(laptop).boleh, false)
  const mobil = beli('3.02.01.01.003', 300_000_000).aset
  assert.equal(cekObjekPemeliharaan(mobil).boleh, true)
  assert.equal(cekObjekPemeliharaan({ ...mobil, kondisi: 'RB' }).boleh, false)
  assert.equal(cekObjekPemeliharaan({ ...mobil, statusPenggunaan: 'dimanfaatkan', pemanfaatan: { jenis: 'pinjam_pakai', durasiBulan: 3 } }).boleh, true)
  assert.equal(cekObjekPemeliharaan({ ...mobil, statusPenggunaan: 'dimanfaatkan', pemanfaatan: { jenis: 'sewa', durasiBulan: 3 } }).boleh, false)
  const genset = beli('3.11.01.01.001', 150_000_000).aset
  assert.equal(cekObjekPemeliharaan(genset).boleh, true)
})

test('validasi pengadaan terhadap SBSK', () => {
  assert.equal(validasiBarisPengadaan({ kebutuhanSBSK: 10, tersedia: 7, idle: 0, usulan: 3, kodeProgram: 'X' }).sesuai, true)
  const v = validasiBarisPengadaan({ kebutuhanSBSK: 10, tersedia: 7, idle: 0, usulan: 5, kodeProgram: 'X' })
  assert.equal(v.sesuai, false)
  assert.equal(v.maksimal, 3)
})

test('persetujuan usulan hibah menghasilkan transaksi hibah keluar', () => {
  assert.deepEqual(aksiPersetujuan({ jenis: 'hibah' }), { tipe: 'transaksi', jenis: 'hibah_keluar' })
  assert.equal(aksiPersetujuan({ jenis: 'sewa', durasiBulan: 12, nomorSK: 'S-1' }).patch.statusPenggunaan, 'dimanfaatkan')
})
