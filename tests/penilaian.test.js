import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JENIS_TRANSAKSI, terapkanTransaksi } from '../src/lib/bmn.js'
import { huruf, nilaiLangkah, nilaiSkenario, templatSkenario } from '../src/lib/penilaian.js'

const T = templatSkenario(2026)

/** Satker berisi Laptop NUP 1-2 dan Gedung Kantor NUP 1 (seperti data contoh), lalu bukukan jawaban. */
function satkerDenganJawaban(ubah = () => {}) {
  const aset = []
  const trx = []
  const catat = (input, idx = null) => {
    const h = terapkanTransaksi(idx === null ? null : aset[idx], input)
    const id = idx === null ? `a${aset.length}` : aset[idx].id
    if (idx === null) aset.push({ id, ...h.aset }); else aset[idx] = { id, ...h.aset }
    trx.push({ id: `t${trx.length}`, ...h.transaksi, asetId: id })
  }
  const d = { jenis: 'Dokumen Lainnya', nomor: 'LBKP' }
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '3.10.01.02.002', nup: 1, nilai: 14_500_000, dokumen: d })
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '3.10.01.02.002', nup: 2, nilai: 14_500_000, dokumen: d })
  catat({ jenis: 'saldo_awal', tanggal: '2025-12-31', kodeBarang: '4.01.01.01.001', nup: 1, nilai: 6_200_000_000, dokumen: d })
  const cari = (target) => aset.findIndex((a) => a.kodeBarang === target.kodeBarang && a.nup === target.nup)
  const nup = {}
  for (const l of T.langkah) {
    const k = { ...T.kunci[l.id] }
    const input = { ...k, dokumen: { jenis: 'BAST', nomor: k.nomorDokumen } }
    if (ubah(l.id, input) === false) continue
    if (JENIS_TRANSAKSI[k.jenis].kelompok === 'tambah') {
      nup[k.kodeBarang] = (nup[k.kodeBarang] || aset.filter((a) => a.kodeBarang === k.kodeBarang).length) + 1
      catat({ ...input, nup: nup[k.kodeBarang] })
    } else catat(input, cari(k.target))
  }
  return { aset, trx }
}

test('templat: kunci lengkap, jenis valid, setiap langkah memetakan rubrik yang ada', () => {
  const ids = new Set(T.rubrik.map((r) => r.id))
  assert.equal(T.rubrik.reduce((s, r) => s + r.bobot, 0), 100)
  for (const l of T.langkah) {
    assert.ok(ids.has(l.rubrikId))
    assert.ok(JENIS_TRANSAKSI[T.kunci[l.id].jenis], l.id)
  }
})

test('jawaban benar semua → langkah 100%, nilai sesuai bobot rubrik', () => {
  const { trx } = satkerDenganJawaban()
  const n = nilaiSkenario(T, T.kunci, trx, { manual: { r4: 80 }, skorWasdal: 90 })
  assert.ok(n.langkah.every((l) => l.skor === 1), JSON.stringify(n.langkah.map((l) => l.kriteria.filter((k) => !k.ok))))
  assert.deepEqual(n.rubrik.map((r) => r.skor), [100, 100, 90, 80])
  assert.equal(n.total, 35 + 35 + 13.5 + 12)
  assert.equal(n.huruf, 'A')
  assert.ok(n.lengkap)
})

test('tanggal salah dan nilai salah → nilai parsial per kriteria', () => {
  const { trx } = satkerDenganJawaban((id, input) => {
    if (id === 'l1') input.tanggal = '2026-03-16'
    if (id === 'l2') input.nilai = 3_000_000
  })
  const [l1, l2] = nilaiLangkah(T.langkah, T.kunci, trx)
  assert.equal(l1.kriteria.find((k) => k.nama === 'Tanggal').ok, false)
  assert.equal(Math.round(l1.skor * 100), 85)
  assert.equal(l2.kriteria.find((k) => k.nama === 'Nilai').ok, false)
  assert.equal(Math.round(l2.skor * 100), 80)
})

test('salah jenis transaksi tetap dikenali lewat nomor dokumen; langkah terlewat bernilai 0', () => {
  const { trx } = satkerDenganJawaban((id, input) => {
    if (id === 'l1') input.jenis = 'pembelian'
    if (id === 'l6') return false
  })
  const h = nilaiLangkah(T.langkah, T.kunci, trx)
  assert.ok(h[0].transaksiId)
  assert.equal(h[0].kriteria.find((k) => k.nama === 'Jenis transaksi').ok, false)
  assert.equal(h[5].skor, 0)
  assert.equal(h[5].transaksiId, null)
})

test('nomor dokumen sama untuk dua langkah: tiap transaksi dipakai sekali, sesuai jenisnya', () => {
  const { trx } = satkerDenganJawaban()
  const h = nilaiLangkah(T.langkah, T.kunci, trx)
  assert.notEqual(h[3].transaksiId, h[4].transaksiId)
  assert.equal(h[3].skor, 1)
  assert.equal(h[4].skor, 1)
})

test('rubrik manual belum diisi → total dihitung dari rubrik yang sudah dinilai, ditandai belum lengkap', () => {
  const { trx } = satkerDenganJawaban()
  const n = nilaiSkenario(T, T.kunci, trx, { skorWasdal: 100 })
  assert.equal(n.rubrik[3].skor, null)
  assert.equal(n.lengkap, false)
  assert.equal(n.total, 100)
})

test('konversi huruf', () => {
  assert.deepEqual([100, 80, 79.9, 70, 64, 50, 49].map(huruf), ['A', 'A', 'AB', 'B', 'C', 'D', 'E'])
})
