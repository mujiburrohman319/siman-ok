import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strFromU8, unzipSync } from 'fflate'
import { buatXlsx, namaBerkas } from '../src/lib/ekspor.js'

const lap = {
  judul: 'Laporan <Uji> & "Kutip"',
  sheet: 'LBKP/2026: S1',
  subjudul: ['023.SIM.01 · Satker'],
  kolom: [{ label: 'Akun' }, { label: 'Nilai', tipe: 'uang' }],
  baris: [['Tanah', 1_850_000_000], ['Peralatan', '']],
  total: ['Jumlah', 1_850_000_000],
}

test('xlsx: struktur paket, sheet ganda, nama sheet disanitasi & unik', () => {
  const z = unzipSync(buatXlsx([lap, lap]))
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.ok(z[f], f)
  const wb = strFromU8(z['xl/workbook.xml'])
  assert.match(wb, /name="LBKP 2026  S1"/)
  assert.match(wb, /name="LBKP 2026  S1 2"/)
})

test('xlsx: angka tetap numerik, teks di-escape, sel kosong aman', () => {
  const sh = strFromU8(unzipSync(buatXlsx(lap))['xl/worksheets/sheet1.xml'])
  assert.match(sh, /<v>1850000000<\/v>/)
  assert.match(sh, /Laporan &lt;Uji&gt; &amp; &quot;Kutip&quot;/)
  assert.ok(!sh.includes('<Uji>'))
  assert.match(sh, /<mergeCell ref="A1:B1"\/>/)
})

test('nama berkas aman', () => assert.equal(namaBerkas('LBKP Semester I/2026: tes'), 'LBKP_Semester_I2026_tes'))
