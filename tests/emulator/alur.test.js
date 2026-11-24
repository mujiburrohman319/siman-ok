// Uji alur end-to-end: fungsi asli src/lib/db.js + firestore.rules, terhadap Auth & Firestore Emulator
// pada named database yang sama dengan produksi. Jalankan: npm run test:emulator
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'

const PROJECT = 'demo-simantap'
const DB = 'siman-simulasi'
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_PROJECT_ID: PROJECT,
  VITE_FIRESTORE_DB: DB,
  VITE_USE_EMULATOR: 'true',
  VITE_FIRESTORE_EMULATOR_HOST: FS,
  VITE_AUTH_EMULATOR_HOST: AUTH,
})

const { app, auth, db } = await import('../../src/lib/firebase.js')
const { deleteApp } = await import('firebase/app')
const lib = await import('../../src/lib/db.js')
const { JENIS_TRANSAKSI, REFERENSI_DEFAULT, hitungLBKP, saldoDariAset } = await import('../../src/lib/bmn.js')
const { templatSkenario, nilaiSkenario } = await import('../../src/lib/penilaian.js')
const { lbkpPersediaan, nilaiPersediaan, selisihOpname } = await import('../../src/lib/persediaan.js')
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth')
const { collection, collectionGroup, doc, getDoc, getDocs, query, setLogLevel, where } = await import('firebase/firestore')
setLogLevel('silent')

const SANDI = 'rahasia123'
const uid = {}

/** Daftar seperti halaman masuk: akun Auth + profil users/{uid} (role kpb). */
async function daftar(kunci, nama) {
  const email = `${kunci}@contoh.test`
  const u = (await createUserWithEmailAndPassword(auth, email, SANDI)).user
  await lib.buatProfil(u.uid, { nama, nim: kunci, email })
  uid[kunci] = u.uid
}
const masuk = (kunci) => signInWithEmailAndPassword(auth, `${kunci}@contoh.test`, SANDI)

/** Setara "ubah role di Firebase Console" (melewati rules dengan token owner emulator). */
async function jadikanDosen(u) {
  const r = await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/${DB}/documents/users/${u}?updateMask.fieldPaths=role`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: 'pengelola' } } }),
  })
  assert.equal(r.status, 200, await r.text())
}

const ambil = async (...p) => (await getDocs(collection(db, ...p))).docs.map((d) => ({ id: d.id, ...d.data() }))
const ditolak = (p) => assert.rejects(p, (e) => e.code === 'permission-denied')

function cekLBKP(aset, transaksi) {
  const lbkp = hitungLBKP(transaksi, '2000-01-01', '2099-12-31')
  const dariAset = saldoDariAset(aset)
  for (const r of lbkp) assert.equal(r.saldoAkhir, dariAset[r.akun] || 0, `LBKP ${r.akun} ≠ saldo aset`)
}

let s1, s2, aset

before(async () => {
  await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/${DB}/documents`, { method: 'DELETE' })
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' })
})

after(() => deleteApp(app)) // tutup koneksi agar proses uji selesai

describe('alur SIMANTAP end-to-end', () => {
  test('pendaftaran: dosen, dua mahasiswa satker 1 (satu APIP), satu mahasiswa satker 2', async () => {
    await daftar('dosen', 'Dr. Dosen')
    await jadikanDosen(uid.dosen)
    await daftar('mhs1', 'Mahasiswa Satu')
    await daftar('apip1', 'Mahasiswa APIP')
    await daftar('mhs2', 'Mahasiswa Dua')
    await masuk('mhs1')
    const p = (await getDoc(doc(db, 'users', uid.mhs1))).data()
    assert.equal(p.role, 'kpb')
  })

  test('dosen membuat kelas, satker, dan menempatkan mahasiswa', async () => {
    await masuk('dosen')
    const k = await lib.buatKelas({ nama: 'ASP 2A', mk: 'Manajemen BMN', tahunAkademik: '2025/2026', semester: 'Genap' }, uid.dosen)
    s1 = { id: (await lib.buatSatker({ kelasId: k.id, kode: '023.SIM.01', nama: 'Satker 1' })).id, kelasId: k.id }
    s2 = { id: (await lib.buatSatker({ kelasId: k.id, kode: '023.SIM.02', nama: 'Satker 2' })).id, kelasId: k.id }
    const m1 = await lib.cariUserByEmail('MHS1@contoh.test ')
    assert.equal(m1?.id, uid.mhs1)
    await lib.tambahAnggota(s1, m1)
    await lib.tambahAnggota(s1, await lib.cariUserByEmail('apip1@contoh.test'), { apip: true })
    await lib.tambahAnggota(s2, await lib.cariUserByEmail('mhs2@contoh.test'))
    const sat = (await getDoc(doc(db, 'satker', s1.id))).data()
    assert.deepEqual(sat.anggota, [uid.mhs1, uid.apip1])
    assert.deepEqual(sat.apipUids, [uid.apip1])
  })

  test('mahasiswa mengisi data contoh; LBKP cocok dengan Daftar Barang', async () => {
    await masuk('mhs1')
    assert.equal((await getDoc(doc(db, 'users', uid.mhs1))).data().satkerId, s1.id)
    await lib.isiDataContoh(s1.id, uid.mhs1, REFERENSI_DEFAULT)
    aset = await ambil('satker', s1.id, 'aset')
    const trx = await ambil('satker', s1.id, 'transaksi')
    assert.equal(aset.length, 12)
    assert.equal(trx.length, 12)
    assert.ok(trx.every((t) => t.dibuatOleh === uid.mhs1 && t.asetId))
    cekLBKP(aset, trx)
  })

  test('mahasiswa membukukan pembelian dan reklasifikasi rusak berat', async () => {
    await lib.catatTransaksi({
      satkerId: s1.id, asetId: null, uid: uid.mhs1,
      input: { jenis: 'pembelian', tanggal: '2026-03-01', kodeBarang: '3.10.01.02.002', nup: 3, nilai: 15_000_000, merk: 'Laptop baru', lokasiRuang: 'R. Prodi', dokumen: { jenis: 'BAST', nomor: 'BAST-01' } },
    })
    const ac = aset.find((a) => a.kodeBarang === '3.05.02.06.002')
    await lib.catatTransaksi({ satkerId: s1.id, asetId: ac.id, uid: uid.mhs1, input: { jenis: 'reklasifikasi_rusak_berat', tanggal: '2026-03-02', dokumen: { jenis: 'Berita Acara Inventarisasi', nomor: 'BA-01' } } })
    aset = await ambil('satker', s1.id, 'aset')
    assert.equal(aset.length, 13)
    assert.equal(aset.find((a) => a.id === ac.id).status, 'rusak_berat')
    cekLBKP(aset, await ambil('satker', s1.id, 'transaksi'))
  })

  test('atribut non-nilai dapat diubah; nilai hanya lewat transaksi', async () => {
    const a = aset[0]
    await lib.ubahAtributAset(s1.id, a.id, { lokasiRuang: 'Gedung C' })
    assert.equal((await getDoc(doc(db, 'satker', s1.id, 'aset', a.id))).data().lokasiRuang, 'Gedung C')
    await assert.rejects(lib.ubahAtributAset(s1.id, a.id, { nilai: 1 }), /hanya dapat diubah melalui transaksi/)
    // Melewati pengecekan klien (mis. lewat konsol browser) tetap ditolak server
    const { updateDoc } = await import('firebase/firestore')
    await ditolak(updateDoc(doc(db, 'satker', s1.id, 'aset', a.id), { nilai: 1 }))
    await ditolak(updateDoc(doc(db, 'satker', s1.id, 'aset', a.id), { status: 'dihapus' }))
  })

  test('mahasiswa satker lain tidak dapat melihat atau menulis data satker 1', async () => {
    await masuk('mhs2')
    await ditolak(getDocs(collection(db, 'satker', s1.id, 'aset')))
    await ditolak(getDoc(doc(db, 'satker', s1.id)))
    await ditolak(lib.ubahAtributAset(s1.id, aset[0].id, { lokasiRuang: 'X' }))
    await ditolak(lib.catatTransaksi({ satkerId: s1.id, asetId: aset[0].id, uid: uid.mhs2, input: { jenis: 'koreksi_kondisi', tanggal: '2026-03-03', kondisiBaru: 'RR', dokumen: { jenis: 'BAST', nomor: 'X' } } }))
  })

  test('RKBMN: KPB → reviu APIP → Pengelola Barang menetapkan hasil penelaahan', async () => {
    const id = lib.rkbmnId(2027, 'pengadaan')
    await masuk('mhs1')
    await lib.simpanRKBMN(s1.id, id, { tahun: 2027, jenis: 'pengadaan', baris: [{ uraian: 'Laptop', usulan: 2 }], status: 'draft' })
    await lib.simpanRKBMN(s1.id, id, { status: 'reviu_apip' })
    await ditolak(lib.simpanRKBMN(s1.id, id, { status: 'diajukan' }))

    await masuk('apip1')
    await lib.simpanRKBMN(s1.id, id, { status: 'diajukan', reviuApip: { oleh: uid.apip1, catatan: 'Sesuai' } })

    await masuk('dosen')
    const antre = await getDocs(query(collectionGroup(db, 'rkbmn'), where('status', '==', 'diajukan')))
    assert.deepEqual(antre.docs.map((d) => [d.ref.parent.parent.id, d.id]), [[s1.id, id]])
    await lib.simpanRKBMN(s1.id, id, { status: 'disetujui', telaah: { oleh: uid.dosen } })

    await masuk('mhs1')
    assert.equal((await getDoc(doc(db, 'satker', s1.id, 'rkbmn', id))).data().status, 'disetujui')
    await ditolak(lib.simpanRKBMN(s1.id, id, { status: 'draft' }))
  })

  test('usulan penghapusan disetujui → transaksi penghapusan dibukukan otomatis', async () => {
    await masuk('mhs1')
    const ac = aset.find((a) => a.kodeBarang === '3.05.02.06.002')
    const data = { jenis: 'penghapusan', namaJenis: 'Penghapusan', asetIds: [ac.id], alasan: 'Rusak berat' }
    const ref = await lib.ajukanUsulan(s1.id, data, uid.mhs1)
    await ditolak(lib.tolakUsulan({ satkerId: s1.id, usulanId: ref.id, uid: uid.mhs1 }))

    await masuk('dosen')
    const antre = await getDocs(query(collectionGroup(db, 'usulan'), where('status', '==', 'diajukan')))
    assert.equal(antre.size, 1)
    const u = { id: antre.docs[0].id, ...antre.docs[0].data() }
    await lib.setujuiUsulan({ satkerId: s1.id, usulan: u, nomorSK: 'S-01/PB/2026', uid: uid.dosen, ref: REFERENSI_DEFAULT })

    await masuk('mhs1')
    const asetBaru = (await getDoc(doc(db, 'satker', s1.id, 'aset', ac.id))).data()
    assert.equal(asetBaru.status, 'dihapus')
    const trx = await ambil('satker', s1.id, 'transaksi')
    const hapus = trx.find((t) => t.jenis === 'penghapusan')
    assert.equal(hapus?.dibuatOleh, uid.dosen)
    assert.equal(hapus?.dokumen.nomor, 'S-01/PB/2026')
    assert.equal((await getDoc(doc(db, 'satker', s1.id, 'usulan', u.id))).data().status, 'disetujui')
    cekLBKP(await ambil('satker', s1.id, 'aset'), trx)
  })

  test('usulan sewa disetujui → aset dimanfaatkan dan PNBP tercatat', async () => {
    const gedung = aset.find((a) => a.kodeBarang === '4.01.01.01.001')
    const data = { jenis: 'sewa', namaJenis: 'Sewa', asetIds: [gedung.id], mitra: 'Koperasi', durasiBulan: 12, nilaiSewa: 35_000_000 }
    const ref = await lib.ajukanUsulan(s1.id, data, uid.mhs1)
    await masuk('dosen')
    await lib.setujuiUsulan({ satkerId: s1.id, usulan: { id: ref.id, ...data }, nomorSK: 'S-02/PB/2026', uid: uid.dosen, ref: REFERENSI_DEFAULT })
    await masuk('mhs1')
    const g = (await getDoc(doc(db, 'satker', s1.id, 'aset', gedung.id))).data()
    assert.equal(g.statusPenggunaan, 'dimanfaatkan')
    assert.equal(g.pemanfaatan.mitra, 'Koperasi')
    const pnbp = await ambil('satker', s1.id, 'pnbp')
    assert.equal(pnbp.length, 1)
    assert.equal(pnbp[0].nilai, 35_000_000)
  })

  test('inventarisasi: anggota membuat dan menyimpan sesi', async () => {
    const r = await lib.buatInventarisasi(s1.id, { jenis: 'sensus', tanggal: '2026-06-30', hasil: {} })
    await lib.simpanInventarisasi(s1.id, r.id, { hasil: { [aset[0].id]: { ditemukan: true, kondisi: 'B' } }, status: 'selesai' })
    assert.equal((await getDoc(doc(db, 'satker', s1.id, 'inventarisasi', r.id))).data().status, 'selesai')
  })

  test('jejak audit: transaksi tidak dapat diubah, bahkan oleh dosen', async () => {
    await masuk('dosen')
    const { updateDoc, deleteDoc } = await import('firebase/firestore')
    const t = (await ambil('satker', s1.id, 'transaksi'))[0]
    await ditolak(updateDoc(doc(db, 'satker', s1.id, 'transaksi', t.id), { efek: [] }))
    await ditolak(deleteDoc(doc(db, 'satker', s1.id, 'transaksi', t.id)))
  })
})

describe('skenario kasus: soal → jawaban mahasiswa → nilai otomatis → terbit', () => {
  const T = templatSkenario(2026)
  let skId

  test('dosen menerbitkan skenario dari templat', async () => {
    await masuk('dosen')
    const { kunci, ...data } = T
    skId = await lib.simpanSkenario(null, { ...data, kelasId: s1.kelasId, status: 'terbit' }, kunci, uid.dosen)
    assert.ok(skId)
  })

  test('mahasiswa melihat soal, tidak dapat membaca kunci, lalu membukukan jawaban', async () => {
    await masuk('mhs1')
    const q = await getDocs(query(collection(db, 'skenario'), where('kelasId', '==', s1.kelasId), where('status', 'in', ['terbit', 'ditutup'])))
    assert.deepEqual(q.docs.map((d) => d.id), [skId])
    assert.equal(q.docs[0].data().kunci, undefined)
    await ditolak(getDoc(doc(db, 'skenario', skId, 'kunci', 'jawaban')))

    for (const l of T.langkah) {
      const k = T.kunci[l.id]
      const asetNow = await ambil('satker', s1.id, 'aset')
      const input = { ...k, dokumen: { jenis: 'BAST', nomor: k.nomorDokumen } }
      if (JENIS_TRANSAKSI[k.jenis].kelompok === 'tambah') {
        input.nup = asetNow.filter((a) => a.kodeBarang === k.kodeBarang).length + 1
        await lib.catatTransaksi({ satkerId: s1.id, asetId: null, uid: uid.mhs1, input })
      } else {
        const a = asetNow.find((x) => x.kodeBarang === k.target.kodeBarang && x.nup === k.target.nup)
        await lib.catatTransaksi({ satkerId: s1.id, asetId: a.id, uid: uid.mhs1, input })
      }
    }
  })

  test('dosen menghitung nilai (semua langkah benar), menyimpan, dan menerbitkan', async () => {
    await masuk('dosen')
    const kunci = (await getDoc(doc(db, 'skenario', skId, 'kunci', 'jawaban'))).data().langkah
    const trx = await ambil('satker', s1.id, 'transaksi')
    const n = nilaiSkenario(T, kunci, trx, { manual: { r4: 75 }, skorWasdal: 80 })
    assert.ok(n.langkah.every((l) => l.skor === 1), JSON.stringify(n.langkah.map((l) => l.kriteria.filter((k) => !k.ok))))
    await lib.simpanNilai(skId, { [s1.id]: { ...n, manual: { r4: 75 }, terbit: false } }, uid.dosen)
    await masuk('mhs1')
    await ditolak(getDoc(doc(db, 'skenario', skId, 'nilai', s1.id))) // belum terbit
    await masuk('dosen')
    await lib.simpanNilai(skId, { [s1.id]: { terbit: true } }, uid.dosen)
  })

  test('mahasiswa membaca nilainya; satker lain tidak', async () => {
    await masuk('mhs1')
    const n = (await getDoc(doc(db, 'skenario', skId, 'nilai', s1.id))).data()
    assert.equal(n.total, 35 + 35 + 12 + 11.25)
    assert.equal(n.huruf, 'A')
    await masuk('mhs2')
    await ditolak(getDoc(doc(db, 'skenario', skId, 'nilai', s1.id)))
  })
})

describe('persediaan: saldo awal → pemakaian FIFO → opname → LBKP persediaan', () => {
  test('alur persediaan', async () => {
    await masuk('mhs1')
    await lib.isiPersediaanContoh(s1.id, uid.mhs1)
    let barang = await ambil('satker', s1.id, 'persediaan')
    assert.equal(barang.length, 4)
    const kertas = barang.find((b) => b.nama.startsWith('Kertas'))
    const tahun = new Date().getFullYear()
    await lib.catatMutasiPersediaan({ satkerId: s1.id, barangId: kertas.id, uid: uid.mhs1, input: { jenis: 'pembelian', tanggal: `${tahun}-02-01`, qty: 10, hargaSatuan: 55_000, dokumen: { jenis: 'Kuitansi', nomor: 'KW-1' } } })
    await lib.catatMutasiPersediaan({ satkerId: s1.id, barangId: kertas.id, uid: uid.mhs1, input: { jenis: 'pemakaian', tanggal: `${tahun}-03-01`, qty: 45, dokumen: { jenis: 'Dokumen Lainnya', nomor: 'BPP-1' } } })
    await assert.rejects(lib.catatMutasiPersediaan({ satkerId: s1.id, barangId: kertas.id, uid: uid.mhs1, input: { jenis: 'pemakaian', tanggal: `${tahun}-03-02`, qty: 999, dokumen: { jenis: 'X', nomor: '1' } } }), /Saldo tidak cukup/)
    barang = await ambil('satker', s1.id, 'persediaan')
    const k2 = barang.find((b) => b.id === kertas.id)
    assert.equal(k2.saldoQty, 5)
    assert.deepEqual(k2.lapisan.map((l) => [l.qty, l.harga]), [[5, 55_000]]) // FIFO: 40 lama habis dulu

    const sel = selisihOpname(barang, { [kertas.id]: 4 }, { tanggal: `${tahun}-06-30`, dokumen: { jenis: 'Berita Acara Inventarisasi', nomor: 'BA-OP-1' } })
    for (const x of sel) await lib.catatMutasiPersediaan({ satkerId: s1.id, barangId: x.barangId, uid: uid.mhs1, input: x.input })
    barang = await ambil('satker', s1.id, 'persediaan')
    const mutasi = await ambil('satker', s1.id, 'mutasiPersediaan')
    const lbkp = lbkpPersediaan(barang, mutasi, `${tahun}-01-01`, `${tahun}-12-31`)
    assert.equal(lbkp.reduce((x, r) => x + r.akhir, 0), nilaiPersediaan(barang))
    assert.equal(lbkp.find((r) => r.id === kertas.id).akhirQty, 4)

    const { updateDoc } = await import('firebase/firestore')
    await ditolak(updateDoc(doc(db, 'satker', s1.id, 'persediaan', kertas.id), { saldoQty: 1000 }))
  })
})

describe('usulan perubahan hasil penelaahan RKBMN', () => {
  test('KPB mengajukan perubahan, dosen menyetujui → revisi ke-1', async () => {
    const id = lib.rkbmnId(2027, 'pengadaan')
    await masuk('mhs1')
    const dok = { id, ...(await getDoc(doc(db, 'satker', s1.id, 'rkbmn', id))).data() }
    await lib.simpanPerubahanRKBMN(s1.id, id, { status: 'diajukan', alasan: 'Tambahan pegawai', baris: [{ uraian: 'Laptop', usulan: 4 }] })
    await ditolak(lib.simpanPerubahanRKBMN(s1.id, id, { status: 'draft', baris: [] }))
    await masuk('dosen')
    const terbaru = { id, ...(await getDoc(doc(db, 'satker', s1.id, 'rkbmn', id))).data() }
    await lib.putusPerubahanRKBMN({ satkerId: s1.id, dok: terbaru, setuju: true, baris: terbaru.perubahan.baris, catatan: 'Sesuai', oleh: 'Dr. Dosen' })
    await masuk('mhs1')
    const akhir = (await getDoc(doc(db, 'satker', s1.id, 'rkbmn', id))).data()
    assert.equal(akhir.revisi, 1)
    assert.equal(akhir.baris[0].usulan, 4)
    assert.deepEqual(akhir.riwayatRevisi[0].barisSebelum, dok.baris)
    assert.equal(akhir.perubahan.status, 'disetujui')
  })
})

describe('lampiran dokumen sumber', () => {
  test('unggah PDF 2 MB (3 potongan), unduh utuh, hapus foto aset', async () => {
    await masuk('mhs1')
    const asli = Buffer.alloc(2 * 1024 * 1024, 3).toString('base64')
    const trx = (await ambil('satker', s1.id, 'transaksi'))[0]
    const id = await lib.unggahLampiran({ satkerId: s1.id, induk: { tipe: 'transaksi', id: trx.id }, nama: 'bast.pdf', tipe: 'application/pdf', ukuran: 2 * 1024 * 1024, base64: asli, uid: uid.mhs1 })
    const list = await getDocs(query(collection(db, 'satker', s1.id, 'lampiran'), where('induk.id', '==', trx.id)))
    assert.equal(list.size, 1)
    const l = { id, ...list.docs[0].data() }
    assert.equal(l.jumlahPotong, 3)
    assert.equal(await lib.ambilLampiran(s1.id, l), asli)
    await ditolak(lib.hapusLampiran(s1.id, l)) // lampiran transaksi = jejak audit

    const foto = await lib.unggahLampiran({ satkerId: s1.id, induk: { tipe: 'aset', id: aset[0].id }, nama: 'foto.jpg', tipe: 'image/jpeg', ukuran: 10, base64: 'QUJD', uid: uid.mhs1 })
    await lib.hapusLampiran(s1.id, { id: foto, jumlahPotong: 1 })
    await masuk('mhs2')
    await ditolak(lib.ambilLampiran(s1.id, l))
  })
})
