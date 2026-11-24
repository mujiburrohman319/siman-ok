// Uji aturan keamanan Firestore (firestore.rules) terhadap Firebase Emulator.
// Jalankan: npm run test:emulator
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, describe, test } from 'node:test'
import { setLogLevel } from 'firebase/firestore'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'

setLogLevel('silent') // penolakan yang diharapkan tidak perlu dicetak
let env
const dosen = () => env.authenticatedContext('dosen').firestore()
const mhs1 = () => env.authenticatedContext('mhs1').firestore() // anggota s1
const apip1 = () => env.authenticatedContext('apip1').firestore() // anggota + APIP s1
const mhs2 = () => env.authenticatedContext('mhs2').firestore() // anggota s2
const tanpaProfil = () => env.authenticatedContext('baru').firestore()
const anonim = () => env.unauthenticatedContext().firestore()

/** Pembukuan sah: transaksi baru + perubahan aset dalam satu batch, aset.trxTerakhir = id transaksi. */
function bukukan(db, { uid, asetId = 'a1', patch = { nilai: 2000 }, satker = 's1', trxAsetId = asetId }) {
  const t = db.collection(`satker/${satker}/transaksi`).doc()
  const b = db.batch()
  b.set(t, { ...transaksi(uid), asetId: trxAsetId })
  b.set(db.doc(`satker/${satker}/aset/${asetId}`), { ...patch, trxTerakhir: t.id }, { merge: true })
  return b.commit()
}

const transaksi = (uid) => ({ jenis: 'pembelian', tanggal: '2026-01-10', asetId: 'a1', efek: [{ akun: 'Peralatan dan Mesin', nilai: 1 }], dokumen: { jenis: 'BAST', nomor: '1' }, dibuatOleh: uid })

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
  env = await initializeTestEnvironment({
    projectId: 'demo-simantap',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  })
})
after(() => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc('users/dosen').set({ nama: 'Dosen', email: 'dosen@x.test', role: 'pengelola' })
    await db.doc('users/mhs1').set({ nama: 'Mhs 1', email: 'm1@x.test', role: 'kpb', satkerId: 's1', kelasId: 'k1' })
    await db.doc('users/apip1').set({ nama: 'APIP 1', email: 'a1@x.test', role: 'kpb', satkerId: 's1', kelasId: 'k1' })
    await db.doc('users/mhs2').set({ nama: 'Mhs 2', email: 'm2@x.test', role: 'kpb', satkerId: 's2', kelasId: 'k1' })
    await db.doc('kelas/k1').set({ nama: 'ASP 2A' })
    await db.doc('referensi/config').set({ batasPemeliharaan: 100 })
    await db.doc('satker/s1').set({ kode: '01', nama: 'Satker 1', kelasId: 'k1', anggota: ['mhs1', 'apip1'], apipUids: ['apip1'] })
    await db.doc('satker/s2').set({ kode: '02', nama: 'Satker 2', kelasId: 'k1', anggota: ['mhs2'], apipUids: [] })
    await db.doc('satker/s1/aset/a1').set({ kodeBarang: '3.10.01.02.002', nilai: 1000, status: 'aktif' })
    await db.doc('satker/s1/transaksi/t1').set(transaksi('mhs1'))
    await db.doc('satker/s1/rkbmn/2027-pengadaan').set({ status: 'draft', baris: [] })
    await db.doc('satker/s1/usulan/u1').set({ jenis: 'penghapusan', status: 'diajukan', asetIds: ['a1'] })
    await db.doc('satker/s1/pnbp/p1').set({ nilai: 10 })
    await db.doc('satker/s1/persediaan/b1').set({ kode: '1.01.03.01.002', nama: 'Kertas', satuan: 'rim', saldoQty: 10, lapisan: [{ tanggal: '2026-01-01', qty: 10, harga: 50000 }] })
    await db.doc('satker/s1/mutasiPersediaan/m0').set({ barangId: 'b1', jenis: 'saldo_awal', qty: 10, dibuatOleh: 'mhs1' })
    await db.doc('skenario/sk1').set({ kelasId: 'k1', status: 'terbit', judul: 'Kasus 1' })
    await db.doc('skenario/sk2').set({ kelasId: 'k1', status: 'draft', judul: 'Kasus 2' })
    await db.doc('skenario/sk3').set({ kelasId: 'k2', status: 'terbit', judul: 'Kelas lain' })
    await db.doc('skenario/sk1/kunci/jawaban').set({ langkah: { l1: { jenis: 'pembelian' } } })
    await db.doc('skenario/sk1/nilai/s1').set({ total: 90, terbit: true })
    await db.doc('skenario/sk1/nilai/s2').set({ total: 60, terbit: false })
  })
})

describe('users', () => {
  test('mahasiswa membaca profil sendiri, bukan profil orang lain', async () => {
    await assertSucceeds(mhs1().doc('users/mhs1').get())
    await assertFails(mhs1().doc('users/mhs2').get())
  })
  test('dosen membaca profil siapa pun', () => assertSucceeds(dosen().doc('users/mhs2').get()))
  test('anonim tidak dapat membaca profil', () => assertFails(anonim().doc('users/mhs1').get()))
  test('pendaftaran mandiri hanya sebagai kpb tanpa satker', async () => {
    await assertSucceeds(tanpaProfil().doc('users/baru').set({ nama: 'B', email: 'b@x.test', role: 'kpb' }))
    await env.clearFirestore()
    await assertFails(tanpaProfil().doc('users/baru').set({ nama: 'B', role: 'pengelola' }))
    await assertFails(tanpaProfil().doc('users/baru').set({ nama: 'B', role: 'kpb', satkerId: 's1' }))
    await assertFails(tanpaProfil().doc('users/mhs9').set({ nama: 'B', role: 'kpb' }))
  })
  test('mahasiswa hanya mengubah nama/NIM sendiri', async () => {
    await assertSucceeds(mhs1().doc('users/mhs1').update({ nama: 'Baru', nim: '123' }))
    await assertFails(mhs1().doc('users/mhs1').update({ role: 'pengelola' }))
    await assertFails(mhs1().doc('users/mhs1').update({ satkerId: 's2' }))
    await assertFails(mhs1().doc('users/mhs2').update({ nama: 'X' }))
  })
  test('dosen dapat mempromosikan pengguna', () => assertSucceeds(dosen().doc('users/mhs2').update({ role: 'pengelola' })))
})

describe('kelas & referensi', () => {
  test('mahasiswa membaca, tidak dapat menulis', async () => {
    await assertSucceeds(mhs1().doc('kelas/k1').get())
    await assertSucceeds(mhs1().doc('referensi/config').get())
    await assertFails(mhs1().doc('kelas/k1').update({ nama: 'X' }))
    await assertFails(mhs1().doc('referensi/config').set({ batasPemeliharaan: 1 }))
  })
  test('dosen menulis', async () => {
    await assertSucceeds(dosen().collection('kelas').add({ nama: 'ASP 2B' }))
    await assertSucceeds(dosen().doc('referensi/config').set({ batasPemeliharaan: 1 }, { merge: true }))
  })
})

describe('satker', () => {
  test('mahasiswa hanya membaca satkernya sendiri', async () => {
    await assertSucceeds(mhs1().doc('satker/s1').get())
    await assertFails(mhs1().doc('satker/s2').get())
  })
  test('mahasiswa tidak dapat membuat satker atau menambah anggota', async () => {
    await assertFails(mhs1().collection('satker').add({ kode: '9', anggota: ['mhs1'] }))
    await assertFails(mhs2().doc('satker/s1').update({ anggota: ['mhs1', 'apip1', 'mhs2'] }))
  })
  test('dosen membaca daftar satker dan membuat satker', async () => {
    await assertSucceeds(dosen().collection('satker').get())
    await assertSucceeds(dosen().collection('satker').add({ kode: '03', anggota: [], apipUids: [] }))
  })
})

describe('aset', () => {
  test('anggota membaca dan menulis aset satkernya', async () => {
    await assertSucceeds(mhs1().doc('satker/s1/aset/a1').get())
    await assertSucceeds(bukukan(mhs1(), { uid: 'mhs1', asetId: 'baru', patch: { kodeBarang: 'x', nilai: 1, status: 'aktif' } }))
    await assertSucceeds(mhs1().doc('satker/s1/aset/a1').update({ lokasiRuang: 'R. 1', merk: 'X', kib: { nopol: 'KB 1' } }))
  })
  test('mahasiswa satker lain tidak dapat membaca/menulis', async () => {
    await assertFails(mhs2().doc('satker/s1/aset/a1').get())
    await assertFails(mhs2().collection('satker/s1/aset').get())
    await assertFails(mhs2().doc('satker/s1/aset/a1').update({ lokasiRuang: 'X' }))
    await assertFails(bukukan(mhs2(), { uid: 'mhs2' }))
  })
  test('aset tidak dapat dihapus fisik, bahkan oleh dosen', async () => {
    await assertFails(mhs1().doc('satker/s1/aset/a1').delete())
    await assertFails(dosen().doc('satker/s1/aset/a1').delete())
  })
})

describe('transaksi (jejak audit)', () => {
  test('anggota membukukan transaksi beserta perubahan aset', () => assertSucceeds(bukukan(mhs1(), { uid: 'mhs1', patch: { nilai: 2000, kondisi: 'RR' } })))
  test('dosen membukukan transaksi (persetujuan usulan)', () => assertSucceeds(bukukan(dosen(), { uid: 'dosen', patch: { status: 'dihapus' } })))
  test('tidak dapat mencatat atas nama orang lain', () => assertFails(bukukan(mhs1(), { uid: 'apip1' })))
  test('transaksi harus merujuk aset yang diubah', () => assertFails(bukukan(mhs1(), { uid: 'mhs1', trxAsetId: 'aset-lain' })))
  test('tidak dapat menunjuk transaksi lama sebagai dasar perubahan nilai', () =>
    assertFails(mhs1().doc('satker/s1/aset/a1').update({ nilai: 5, trxTerakhir: 't1' })))
  test('bukan anggota tidak dapat mencatat atau membaca', async () => {
    await assertFails(mhs2().collection('satker/s1/transaksi').add(transaksi('mhs2')))
    await assertFails(mhs2().doc('satker/s1/transaksi/t1').get())
  })
  test('transaksi tidak dapat diubah atau dihapus siapa pun', async () => {
    for (const db of [mhs1(), dosen()]) {
      await assertFails(db.doc('satker/s1/transaksi/t1').update({ efek: [] }))
      await assertFails(db.doc('satker/s1/transaksi/t1').delete())
    }
  })
})

describe('RKBMN', () => {
  const r = (db) => db.doc('satker/s1/rkbmn/2027-pengadaan')
  test('dokumen baru wajib berstatus draft', async () => {
    await assertSucceeds(mhs1().doc('satker/s1/rkbmn/2028-pengadaan').set({ status: 'draft', baris: [] }))
    await assertFails(mhs1().doc('satker/s1/rkbmn/2028-pemeliharaan').set({ status: 'diajukan', baris: [] }))
  })
  test('alur draft → reviu APIP → diajukan', async () => {
    await assertSucceeds(r(mhs1()).update({ status: 'reviu_apip' }))
    await assertFails(r(mhs1()).update({ status: 'diajukan' })) // KPB tidak melompati APIP
    await assertSucceeds(r(apip1()).update({ status: 'diajukan', reviuApip: { catatan: 'ok' } }))
    await assertFails(r(mhs1()).update({ status: 'draft' })) // sudah di tangan Pengelola
  })
  test('APIP dapat mengembalikan ke draft', async () => {
    await r(mhs1()).update({ status: 'reviu_apip' })
    await assertSucceeds(r(apip1()).update({ status: 'draft' }))
  })
  test('mahasiswa tidak dapat menyetujui sendiri', async () => {
    await assertFails(r(mhs1()).update({ status: 'disetujui' }))
    await r(mhs1()).update({ status: 'reviu_apip' })
    await assertFails(r(apip1()).update({ status: 'disetujui' }))
  })
  test('dosen menetapkan hasil penelaahan', async () => {
    await assertSucceeds(r(dosen()).update({ status: 'disetujui' }))
  })
  test('dokumen yang sudah diajukan tidak dapat dihapus mahasiswa', async () => {
    await r(dosen()).update({ status: 'diajukan' })
    await assertFails(r(mhs1()).delete())
  })
  test('draft dapat dihapus anggota; satker lain tidak', async () => {
    await assertFails(r(mhs2()).delete())
    await assertSucceeds(r(mhs1()).delete())
  })
})

describe('usulan', () => {
  test('anggota mengajukan usulan berstatus diajukan', async () => {
    await assertSucceeds(mhs1().collection('satker/s1/usulan').add({ jenis: 'sewa', status: 'diajukan' }))
    await assertFails(mhs1().collection('satker/s1/usulan').add({ jenis: 'sewa', status: 'disetujui' }))
  })
  test('mahasiswa tidak dapat memutus usulannya sendiri', async () => {
    await assertFails(mhs1().doc('satker/s1/usulan/u1').update({ status: 'disetujui', nomorSK: 'X' }))
    await assertFails(apip1().doc('satker/s1/usulan/u1').update({ status: 'disetujui' }))
  })
  test('dosen memutus usulan', () => assertSucceeds(dosen().doc('satker/s1/usulan/u1').update({ status: 'disetujui', nomorSK: 'S-1' })))
})

describe('antrean lintas satker (collection group)', () => {
  test('dosen melihat antrean usulan dan RKBMN semua satker', async () => {
    await assertSucceeds(dosen().collectionGroup('usulan').where('status', '==', 'diajukan').get())
    await assertSucceeds(dosen().collectionGroup('rkbmn').where('status', '==', 'diajukan').get())
  })
  test('mahasiswa tidak dapat melihat antrean lintas satker', async () => {
    await assertFails(mhs1().collectionGroup('usulan').where('status', '==', 'diajukan').get())
    await assertFails(mhs1().collectionGroup('rkbmn').get())
  })
})

describe('inventarisasi & PNBP', () => {
  test('anggota mengelola inventarisasi; satker lain tidak', async () => {
    await assertSucceeds(mhs1().collection('satker/s1/inventarisasi').add({ jenis: 'sensus', status: 'berjalan' }))
    await assertFails(mhs2().collection('satker/s1/inventarisasi').add({ jenis: 'sensus' }))
  })
  test('PNBP: anggota mencatat, hanya dosen mengubah', async () => {
    await assertSucceeds(mhs1().collection('satker/s1/pnbp').add({ nilai: 5 }))
    await assertFails(mhs1().doc('satker/s1/pnbp/p1').update({ nilai: 999 }))
    await assertSucceeds(dosen().doc('satker/s1/pnbp/p1').update({ nilai: 11 }))
  })
})

describe('pengguna tanpa profil / anonim', () => {
  test('tidak dapat mengakses data satker', async () => {
    await assertFails(tanpaProfil().doc('satker/s1').get())
    await assertFails(tanpaProfil().doc('satker/s1/aset/a1').get())
    await assertFails(anonim().doc('kelas/k1').get())
  })
})

describe('celah yang ditutup: pembukuan & RKBMN tidak dapat dipalsukan', () => {
  test('A: mengubah nilai aset langsung tanpa transaksi', () => assertFails(mhs1().doc('satker/s1/aset/a1').update({ nilai: 999_999_999 })))
  test('B: mengubah status aset langsung', () => assertFails(mhs1().doc('satker/s1/aset/a1').update({ status: 'dihapus' })))
  test('C: membuat aset tanpa transaksi', () => assertFails(mhs1().collection('satker/s1/aset').add({ kodeBarang: 'x', nilai: 5 })))
  test('D: transaksi palsu tanpa aset', () => assertFails(mhs1().collection('satker/s1/transaksi').add(transaksi('mhs1'))))
  test('E: memalsukan tanda tangan/telaah saat draft', () => assertFails(mhs1().doc('satker/s1/rkbmn/2027-pengadaan').update({ tandaTangan: [{ peran: 'Pengelola Barang' }], telaah: { catatan: 'ok' } })))
  test('F: memalsukan CHR APIP saat mengirim reviu', () => assertFails(mhs1().doc('satker/s1/rkbmn/2027-pengadaan').update({ status: 'reviu_apip', reviuApip: { catatan: 'lulus' } })))
  test('G: dokumen RKBMN baru tidak boleh membawa telaah/tanda tangan', () =>
    assertFails(mhs1().doc('satker/s1/rkbmn/2029-pengadaan').set({ status: 'draft', baris: [], tandaTangan: [{ peran: 'Pengelola Barang' }] })))
  test('H: APIP hanya mengisi CHR dan status, bukan mengubah isi', async () => {
    await mhs1().doc('satker/s1/rkbmn/2027-pengadaan').update({ status: 'reviu_apip' })
    await assertFails(apip1().doc('satker/s1/rkbmn/2027-pengadaan').update({ status: 'diajukan', baris: [{ uraian: 'tambahan' }] }))
    await assertFails(apip1().doc('satker/s1/rkbmn/2027-pengadaan').update({ status: 'diajukan', telaah: { catatan: 'ok' } }))
  })
  test('penyusun tetap dapat menyimpan draf dengan riwayat', () =>
    assertSucceeds(mhs1().doc('satker/s1/rkbmn/2027-pengadaan').set({ tahun: 2027, jenis: 'pengadaan', baris: [{ uraian: 'Laptop' }], status: 'reviu_apip', riwayat: [{ status: 'reviu_apip' }] }, { merge: true })))
})

describe('skenario kasus & nilai', () => {
  test('mahasiswa membaca skenario terbit di kelasnya saja', async () => {
    await assertSucceeds(mhs1().doc('skenario/sk1').get())
    await assertFails(mhs1().doc('skenario/sk2').get()) // masih draf
    await assertFails(mhs1().doc('skenario/sk3').get()) // kelas lain
    await assertSucceeds(mhs1().collection('skenario').where('kelasId', '==', 'k1').where('status', 'in', ['terbit', 'ditutup']).get())
    await assertFails(mhs1().collection('skenario').get())
  })
  test('kunci jawaban tidak dapat dibaca mahasiswa', async () => {
    await assertFails(mhs1().doc('skenario/sk1/kunci/jawaban').get())
    await assertFails(apip1().collection('skenario/sk1/kunci').get())
    await assertSucceeds(dosen().doc('skenario/sk1/kunci/jawaban').get())
  })
  test('nilai dibaca anggota satker setelah diterbitkan', async () => {
    await assertSucceeds(mhs1().doc('skenario/sk1/nilai/s1').get())
    await assertFails(mhs2().doc('skenario/sk1/nilai/s2').get()) // belum terbit
    await assertFails(mhs2().doc('skenario/sk1/nilai/s1').get()) // satker lain
  })
  test('hanya dosen menulis skenario, kunci, dan nilai', async () => {
    await assertFails(mhs1().doc('skenario/sk1').update({ status: 'ditutup' }))
    await assertFails(mhs1().doc('skenario/sk1/nilai/s1').update({ total: 100 }))
    await assertFails(mhs1().collection('skenario').add({ kelasId: 'k1', status: 'terbit' }))
    await assertSucceeds(dosen().doc('skenario/sk1/nilai/s2').set({ terbit: true }, { merge: true }))
    await assertSucceeds(dosen().doc('skenario/sk1/kunci/jawaban').set({ langkah: {} }))
  })
})

describe('persediaan', () => {
  function mutasi(db, { uid = 'mhs1', barangId = 'b1', patch = { saldoQty: 8, lapisan: [{ tanggal: '2026-01-01', qty: 8, harga: 50000 }] } } = {}) {
    const m = db.collection('satker/s1/mutasiPersediaan').doc()
    const b = db.batch()
    b.set(m, { barangId, jenis: 'pemakaian', qty: 2, dibuatOleh: uid })
    b.update(db.doc(`satker/s1/persediaan/${barangId}`), { ...patch, mutasiTerakhir: m.id })
    return b.commit()
  }
  test('barang baru harus bersaldo nol', async () => {
    await assertSucceeds(mhs1().collection('satker/s1/persediaan').add({ kode: 'x', nama: 'Map', satuan: 'buah', saldoQty: 0, lapisan: [] }))
    await assertFails(mhs1().collection('satker/s1/persediaan').add({ kode: 'x', nama: 'Map', satuan: 'buah', saldoQty: 5, lapisan: [{ qty: 5, harga: 1 }] }))
  })
  test('saldo tidak dapat diubah langsung; nama boleh', async () => {
    await assertFails(mhs1().doc('satker/s1/persediaan/b1').update({ saldoQty: 100 }))
    await assertSucceeds(mhs1().doc('satker/s1/persediaan/b1').update({ nama: 'Kertas HVS A4' }))
  })
  test('mutasi berpasangan dengan perubahan saldo', () => assertSucceeds(mutasi(mhs1())))
  test('mutasi lepas, atas nama orang lain, atau satker lain ditolak', async () => {
    await assertFails(mhs1().collection('satker/s1/mutasiPersediaan').add({ barangId: 'b1', jenis: 'pemakaian', qty: 1, dibuatOleh: 'mhs1' }))
    await assertFails(mutasi(mhs1(), { uid: 'apip1' }))
    await assertFails(mutasi(mhs2(), { uid: 'mhs2' }))
    await assertFails(mhs2().doc('satker/s1/persediaan/b1').get())
  })
  test('mutasi tidak dapat diubah/dihapus', async () => {
    await assertFails(mhs1().doc('satker/s1/mutasiPersediaan/m0').update({ qty: 1 }))
    await assertFails(dosen().doc('satker/s1/mutasiPersediaan/m0').delete())
    await assertFails(dosen().doc('satker/s1/persediaan/b1').delete())
  })
})
