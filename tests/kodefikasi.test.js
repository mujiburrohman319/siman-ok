import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bagiKodefikasi, keCSV, parseKodefikasi } from '../src/lib/kodefikasi.js'
import { KODE_BARANG, cariKode, daftarKode, setKodefikasi } from '../src/data/kodeBarang.js'

test('parse CSV titik koma dengan kutip, BOM, dan baris kosong', () => {
  const csv = '﻿Kode;Uraian;KIB;Masa Manfaat\n3.10.01.02.002;"Laptop; Notebook";;4\n\n3.02.01.01.003;Mini Bus;aab;8\n'
  const { data, galat } = parseKodefikasi(csv)
  assert.deepEqual(galat, [])
  assert.deepEqual(data[0], { kode: '3.10.01.02.002', uraian: 'Laptop; Notebook', kib: null, masaManfaat: 4, aab: false })
  assert.equal(data[1].aab, true)
})

test('galat dilaporkan per baris: format kode, golongan, KIB, masa manfaat, ganda', () => {
  const csv = 'kode,uraian,kib,masa_manfaat\n3.10.1.02.002,X,,4\n1.01.03.01.001,Persediaan,,0\n3.10.01.02.003,Y,gudang,4\n3.10.01.02.004,Z,,abc\n3.10.01.02.005,A,,4\n3.10.01.02.005,B,,4'
  const { data, galat } = parseKodefikasi(csv)
  assert.deepEqual(galat.map((g) => g.baris), [2, 3, 4, 5, 7])
  assert.equal(data.length, 1)
  assert.deepEqual(parseKodefikasi('a;b\n1;2').galat[0].baris, 1)
})

test('ekspor contoh → impor kembali menghasilkan daftar yang sama', () => {
  const { data, galat } = parseKodefikasi(keCSV(KODE_BARANG))
  assert.deepEqual(galat, [])
  assert.equal(data.length, KODE_BARANG.length)
  assert.equal(bagiKodefikasi(data, 10).length, Math.ceil(KODE_BARANG.length / 10))
})

test('registri aktif: kode impor dipakai, kode lama tetap terbaca dari daftar contoh', () => {
  setKodefikasi([{ kode: '3.10.01.02.002', uraian: 'Laptop (resmi)', kib: null, masaManfaat: 5 }])
  assert.equal(cariKode('3.10.01.02.002').masaManfaat, 5)
  assert.equal(cariKode('4.01.01.01.001').uraian, 'Bangunan Gedung Kantor Permanen')
  assert.equal(daftarKode().length, 1)
  setKodefikasi(null)
  assert.equal(daftarKode(), KODE_BARANG)
})
