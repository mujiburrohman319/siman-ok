// Lapisan data Firestore. Semua penulisan aset + transaksi dilakukan atomik (runTransaction)
// sehingga Daftar Barang dan Buku Barang selalu konsisten.
import {
  addDoc, collection, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, arrayUnion,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { terapkanTransaksi, aksiPersetujuan, REFERENSI_DEFAULT, TransaksiError } from './bmn.js'

const col = (...p) => collection(db, ...p)

/**
 * Mencatat transaksi BMN. asetId = null untuk perolehan (aset baru dibuat).
 * @returns {Promise<string>} id aset
 */
export async function catatTransaksi({ satkerId, asetId, input, uid, ref = REFERENSI_DEFAULT, sumber = null }) {
  return runTransaction(db, async (tx) => {
    let aset = null
    let asetRef
    if (asetId) {
      asetRef = doc(db, 'satker', satkerId, 'aset', asetId)
      const snap = await tx.get(asetRef)
      if (!snap.exists()) throw new TransaksiError('Aset tidak ditemukan')
      aset = snap.data()
    } else {
      asetRef = doc(col('satker', satkerId, 'aset'))
    }
    const hasil = terapkanTransaksi(aset, input, ref)
    const now = serverTimestamp()
    if (asetId) tx.update(asetRef, { ...hasil.aset, updatedAt: now })
    else tx.set(asetRef, { ...hasil.aset, createdAt: now, updatedAt: now })
    const trxRef = doc(col('satker', satkerId, 'transaksi'))
    tx.set(trxRef, { ...hasil.transaksi, asetId: asetRef.id, dibuatOleh: uid, sumber, createdAt: now })
    return asetRef.id
  })
}

export async function ubahAtributAset(satkerId, asetId, patch) {
  // Atribut non-nilai (lokasi, merk, KIB, status penggunaan). Nilai/kondisi wajib lewat transaksi.
  const terlarang = ['nilai', 'kondisi', 'status', 'intrakomptabel', 'kodeBarang', 'nup']
  for (const k of terlarang) if (k in patch) throw new Error(`Field ${k} hanya dapat diubah melalui transaksi`)
  await updateDoc(doc(db, 'satker', satkerId, 'aset', asetId), { ...patch, updatedAt: serverTimestamp() })
}

// ---------------------------------------------------------------- akun & kelas
export async function buatProfil(uid, { nama, nim, email }) {
  await setDoc(doc(db, 'users', uid), { nama, nim: nim || '', email, role: 'kpb', createdAt: serverTimestamp() })
}

export async function buatKelas(data, uid) {
  return addDoc(col('kelas'), { ...data, dosenUid: uid, aktif: true, createdAt: serverTimestamp() })
}

export async function buatSatker({ kelasId, kode, nama }) {
  return addDoc(col('satker'), { kelasId, kode, nama, anggota: [], apipUids: [], createdAt: serverTimestamp() })
}

export async function cariUserByEmail(email) {
  const s = await getDocs(query(col('users'), where('email', '==', email.trim().toLowerCase())))
  return s.docs.map((d) => ({ id: d.id, ...d.data() }))[0] || null
}

export async function tambahAnggota(satker, user, { apip = false } = {}) {
  const b = writeBatch(db)
  b.update(doc(db, 'satker', satker.id), {
    anggota: arrayUnion(user.id),
    ...(apip ? { apipUids: arrayUnion(user.id) } : {}),
  })
  b.update(doc(db, 'users', user.id), { satkerId: satker.id, kelasId: satker.kelasId })
  await b.commit()
}

export async function simpanReferensi(data) {
  await setDoc(doc(db, 'referensi', 'config'), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

// ---------------------------------------------------------------- RKBMN
export const rkbmnId = (tahun, jenis) => `${tahun}-${jenis}`

export async function simpanRKBMN(satkerId, id, data) {
  await setDoc(doc(db, 'satker', satkerId, 'rkbmn', id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

// ---------------------------------------------------------------- Usulan
export async function ajukanUsulan(satkerId, data, uid) {
  return addDoc(col('satker', satkerId, 'usulan'), { ...data, status: 'diajukan', diajukanOleh: uid, createdAt: serverTimestamp() })
}

/** Dosen (Pengelola Barang) menyetujui usulan: terbitkan SK dan jalankan konsekuensinya pada aset. */
export async function setujuiUsulan({ satkerId, usulan, nomorSK, catatan, uid, ref }) {
  const u = { ...usulan, nomorSK }
  const tanggal = new Date().toISOString().slice(0, 10)
  for (const asetId of usulan.asetIds || []) {
    const aksi = aksiPersetujuan(u)
    if (aksi.tipe === 'transaksi') {
      await catatTransaksi({
        satkerId, asetId, uid, ref,
        input: { jenis: aksi.jenis, tanggal, dokumen: { jenis: 'SK Penghapusan', nomor: nomorSK }, keterangan: `Persetujuan usulan ${usulan.jenis}` },
        sumber: { usulanId: usulan.id },
      })
    } else if (aksi.tipe === 'patch') {
      await updateDoc(doc(db, 'satker', satkerId, 'aset', asetId), { ...aksi.patch, updatedAt: serverTimestamp() })
    }
  }
  if (usulan.jenis === 'sewa' && usulan.nilaiSewa) {
    await addDoc(col('satker', satkerId, 'pnbp'), {
      sumber: 'Sewa BMN', nilai: Number(usulan.nilaiSewa), mitra: usulan.mitra || '', nomorSK, tanggal, createdAt: serverTimestamp(),
    })
  }
  await updateDoc(doc(db, 'satker', satkerId, 'usulan', usulan.id), {
    status: 'disetujui', nomorSK, catatanPengelola: catatan || '', diputusOleh: uid, diputusPada: serverTimestamp(),
  })
}

export async function tolakUsulan({ satkerId, usulanId, catatan, uid }) {
  await updateDoc(doc(db, 'satker', satkerId, 'usulan', usulanId), {
    status: 'ditolak', catatanPengelola: catatan || '', diputusOleh: uid, diputusPada: serverTimestamp(),
  })
}

// ---------------------------------------------------------------- Inventarisasi
export async function buatInventarisasi(satkerId, data) {
  return addDoc(col('satker', satkerId, 'inventarisasi'), { ...data, status: 'berjalan', createdAt: serverTimestamp() })
}

export async function simpanInventarisasi(satkerId, id, patch) {
  await updateDoc(doc(db, 'satker', satkerId, 'inventarisasi', id), { ...patch, updatedAt: serverTimestamp() })
}

// ---------------------------------------------------------------- Data contoh
/** Mengisi satker dengan saldo awal contoh agar mahasiswa langsung punya data latihan. */
export async function isiDataContoh(satkerId, uid, ref) {
  const tahun = new Date().getFullYear() - 1
  const tgl = `${tahun}-12-31`
  const dokumen = { jenis: 'Dokumen Lainnya', nomor: `LBKP-${tahun}` }
  const contoh = [
    { kodeBarang: '2.01.01.01.001', nilai: 1_850_000_000, tglPerolehan: '2012-03-15', lokasiRuang: 'Kampus Utama', kib: { luas: 12000, alamat: 'Jl. Raya Sejangkung, Sambas', sertifikat: 'SHP 00012' } },
    { kodeBarang: '4.01.01.01.001', nilai: 6_200_000_000, tglPerolehan: '2014-08-20', lokasiRuang: 'Gedung A', kib: { luasBangunan: 1800, jumlahLantai: 3, alamat: 'Kampus Utama', imb: 'IMB/045/2013' } },
    { kodeBarang: '4.01.01.07.001', nilai: 4_750_000_000, tglPerolehan: '2018-11-05', lokasiRuang: 'Gedung B', kib: { luasBangunan: 1500, jumlahLantai: 2, alamat: 'Kampus Utama' } },
    { kodeBarang: '3.02.01.01.003', nilai: 385_000_000, tglPerolehan: '2019-04-10', lokasiRuang: 'Garasi', merk: 'Toyota Hiace', kib: { nopol: 'KB 1234 XA', noRangka: 'RNG-778812', noMesin: 'MSN-551200', bpkb: 'BPKB-99123' } },
    { kodeBarang: '3.02.01.04.001', nilai: 24_500_000, tglPerolehan: '2021-02-01', lokasiRuang: 'Garasi', merk: 'Honda Supra X', kib: { nopol: 'KB 3456 XB', noRangka: 'RNG-001233', noMesin: 'MSN-009871', bpkb: 'BPKB-11873' } },
    { kodeBarang: '3.10.01.02.002', nilai: 14_500_000, tglPerolehan: '2023-02-14', lokasiRuang: 'R. Prodi ASP', merk: 'Lenovo ThinkPad' },
    { kodeBarang: '3.10.01.02.002', nilai: 14_500_000, tglPerolehan: '2023-02-14', lokasiRuang: 'R. Prodi ASP', merk: 'Lenovo ThinkPad', kondisi: 'RR' },
    { kodeBarang: '3.10.02.03.003', nilai: 3_200_000, tglPerolehan: '2022-07-01', lokasiRuang: 'R. Prodi ASP', merk: 'Epson L3210' },
    { kodeBarang: '3.05.02.06.002', nilai: 6_800_000, tglPerolehan: '2020-09-12', lokasiRuang: 'R. Kelas 2.5', merk: 'Daikin 1.5 PK', kondisi: 'RB' },
    { kodeBarang: '3.05.01.05.010', nilai: 850_000, tglPerolehan: '2021-01-20', lokasiRuang: 'R. Prodi ASP', merk: 'Meja kayu' },
    { kodeBarang: '3.11.01.01.001', nilai: 165_000_000, tglPerolehan: '2017-06-30', lokasiRuang: 'Rumah Genset', merk: 'Perkins 100 kVA' },
    { kodeBarang: '8.01.01.01.001', nilai: 48_000_000, tglPerolehan: '2024-01-10', lokasiRuang: 'Server', merk: 'Sistem Informasi Akademik' },
  ]
  const nupMap = {}
  for (const c of contoh) {
    nupMap[c.kodeBarang] = (nupMap[c.kodeBarang] || 0) + 1
    await catatTransaksi({
      satkerId, asetId: null, uid, ref,
      input: { jenis: 'saldo_awal', tanggal: tgl, nup: nupMap[c.kodeBarang], dokumen, keterangan: 'Data contoh', ...c },
    })
  }
}
