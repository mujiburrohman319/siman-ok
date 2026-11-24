import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAKS_BYTE, potong, validasiBerkas } from '../src/lib/lampiran.js'

test('validasi berkas: format dan ukuran maksimum 2 MB', () => {
  assert.equal(validasiBerkas({ type: 'image/jpeg', size: 500_000 }), null)
  assert.equal(validasiBerkas({ type: 'application/pdf', size: MAKS_BYTE }), null)
  assert.match(validasiBerkas({ type: 'application/pdf', size: MAKS_BYTE + 1 }), /melebihi batas 2 MB/)
  assert.match(validasiBerkas({ type: 'application/zip', size: 10 }), /Format tidak didukung/)
})

test('potong base64: berkas 2 MB menjadi paling banyak 3 potongan dan dapat disatukan kembali', () => {
  const b64 = Buffer.alloc(MAKS_BYTE, 7).toString('base64')
  const p = potong(b64)
  assert.ok(p.length <= 3 && p.every((x) => x.length <= 950_000))
  assert.equal(p.join(''), b64)
  assert.deepEqual(potong(''), [''])
})
