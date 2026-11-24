// Lapisan data Firestore. Semua penulisan aset + transaksi dilakukan atomik (runTransaction)
// sehingga Daftar Barang dan Buku Barang selalu konsisten.
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, arrayRemove, arrayUnion,
} from 'firebase/firestore'
import { db } from './firebase.js'
import { terapkanTransaksi, aksiPersetujuan, REFERENSI_DEFAULT, TransaksiError } from './bmn.js'
import { PersediaanError, terapkanMutasi } from './persediaan.js'
import { potong } from './lampiran.js'
import { bagiKodefikasi } from './kodefikasi.js'

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
    // trxTerakhir memasangkan aset dengan transaksi ini; firestore.rules menolak perubahan nilai tanpa pasangan.
    const trxRef = doc(col('satker', satkerId, 'transaksi'))
    if (asetId) tx.update(asetRef, { ...hasil.aset, trxTerakhir: trxRef.id, updatedAt: now })
    else tx.set(asetRef, { ...hasil.aset, trxTerakhir: trxRef.id, createdAt: now, updatedAt: now })
    tx.set(trxRef, { ...hasil.transaksi, asetId: asetRef.id, dibuatOleh: uid, sumber, createdAt: now })
    return asetRef.id
  })
}

export async function ubahAtributAset(satkerId, asetId, patch) {
  // Atribut non-nilai (lokasi, merk, KIB, status penggunaan). Nilai/kondisi wajib lewat transaksi.
  const terlarang = ['nilai', 'nilaiAwal', 'kondisi', 'status', 'intrakomptabel', 'bersejarah', 'kodeBarang', 'nup', 'trxTerakhir']
  for (const k of terlarang) if (k in patch) throw new Error(`Field ${k} hanya dapat diubah melalui transaksi`)
  await updateDoc(doc(db, 'satker', satkerId, 'aset', asetId), { ...patch, updatedAt: serverTimestamp() })
}

// ---------------------------------------------------------------- akun & kelas
/** role: 'kpb', atau 'pengelola' hanya untuk dosen awal yang emailnya terverifikasi (ditegakkan rules). */
export async function buatProfil(uid, { nama, nim, email, role = 'kpb', emailTerverifikasi = false }) {
  await setDoc(doc(db, 'users', uid), { nama, nim: nim || '', email, role, ...(emailTerverifikasi ? { emailTerverifikasi: true } : {}), createdAt: serverTimestamp() })
}

/** Simpan hasil sinkronProfil() (src/lib/akses.js) untuk pengguna yang sedang masuk. */
export async function simpanSinkronProfil(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch)
}

// ---------------------------------------------------------------- panel Pengguna (dosen)
export async function ubahPeran(uid, role) {
  await updateDoc(doc(db, 'users', uid), { role, peranDiubah: serverTimestamp() })
}

/**
 * Pindahkan pengguna ke satker lain (satkerBaru = null → keluarkan dari satker dan kelas).
 * Satu batch: anggota satker lama dihapus (termasuk peran APIP), satker baru ditambah.
 */
export async function pindahkanAnggota(user, satkerBaru, { apip = false } = {}) {
  const b = writeBatch(db)
  if (user.satkerId && user.satkerId !== satkerBaru?.id) {
    b.update(doc(db, 'satker', user.satkerId), { anggota: arrayRemove(user.id), apipUids: arrayRemove(user.id) })
  }
  if (satkerBaru) {
    b.update(doc(db, 'satker', satkerBaru.id), { anggota: arrayUnion(user.id), apipUids: apip ? arrayUnion(user.id) : arrayRemove(user.id) })
    b.update(doc(db, 'users', user.id), { satkerId: satkerBaru.id, kelasId: satkerBaru.kelasId })
  } else {
    b.update(doc(db, 'users', user.id), { satkerId: deleteField(), kelasId: deleteField() })
  }
  await b.commit()
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

/** KPB menyimpan/mengajukan Usulan Perubahan Hasil Penelaahan (field perubahan diganti utuh). */
export async function simpanPerubahanRKBMN(satkerId, id, perubahan) {
  await updateDoc(doc(db, 'satker', satkerId, 'rkbmn', id), { perubahan, updatedAt: serverTimestamp() })
}

/** Pengelola Barang memutus usulan perubahan. Bila disetujui, baris diganti dan nomor revisi bertambah. */
export async function putusPerubahanRKBMN({ satkerId, dok, setuju, baris, catatan, oleh }) {
  const waktu = new Date().toISOString()
  const p = dok.perubahan || {}
  const telaah = { catatan: catatan || '', oleh, tanggal: waktu }
  const patch = setuju
    ? {
        baris,
        revisi: (dok.revisi || 0) + 1,
        riwayatRevisi: [...(dok.riwayatRevisi || []), { ke: (dok.revisi || 0) + 1, tanggal: waktu, alasan: p.alasan || '', barisSebelum: dok.baris || [] }],
        perubahan: { ...p, status: 'disetujui', telaah },
      }
    : { perubahan: { ...p, status: 'ditolak', telaah } }
  patch.riwayat = [...(dok.riwayat || []), { status: setuju ? 'perubahan_disetujui' : 'perubahan_ditolak', oleh, waktu, catatan: catatan || '' }]
  await updateDoc(doc(db, 'satker', satkerId, 'rkbmn', dok.id), { ...patch, updatedAt: serverTimestamp() })
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

// ---------------------------------------------------------------- Skenario kasus & penilaian
// skenario/{id} dibaca mahasiswa kelasnya setelah terbit; kunci jawaban di skenario/{id}/kunci/jawaban (dosen saja).
export async function simpanSkenario(id, data, kunci, uid) {
  const ref = id ? doc(db, 'skenario', id) : doc(col('skenario'))
  const b = writeBatch(db)
  b.set(ref, { ...data, ...(id ? {} : { dosenUid: uid, createdAt: serverTimestamp() }), updatedAt: serverTimestamp() }, { merge: true })
  b.set(doc(db, 'skenario', ref.id, 'kunci', 'jawaban'), { langkah: kunci, updatedAt: serverTimestamp() })
  await b.commit()
  return ref.id
}

/** Simpan nilai beberapa satker sekaligus. nilai: {satkerId: {...}} */
export async function simpanNilai(skenarioId, nilai, uid) {
  const b = writeBatch(db)
  for (const [satkerId, v] of Object.entries(nilai)) {
    b.set(doc(db, 'skenario', skenarioId, 'nilai', satkerId), { ...v, dinilaiOleh: uid, updatedAt: serverTimestamp() }, { merge: true })
  }
  await b.commit()
}

// ---------------------------------------------------------------- Persediaan
// Barang menyimpan saldo FIFO berjalan; setiap mutasi dibukukan atomik bersama perubahan saldo barang
// (barang.mutasiTerakhir = id mutasi; ditegakkan firestore.rules). Mutasi tidak dapat diubah/dihapus.
export async function buatBarangPersediaan(satkerId, { kode, nama, satuan }) {
  return addDoc(col('satker', satkerId, 'persediaan'), { kode, nama, satuan, saldoQty: 0, lapisan: [], tglTerakhir: null, createdAt: serverTimestamp() })
}

export async function catatMutasiPersediaan({ satkerId, barangId, input, uid, sumber = null }) {
  return runTransaction(db, async (tx) => {
    const bRef = doc(db, 'satker', satkerId, 'persediaan', barangId)
    const snap = await tx.get(bRef)
    if (!snap.exists()) throw new PersediaanError('Barang persediaan tidak ditemukan')
    const h = terapkanMutasi(snap.data(), input)
    const mRef = doc(col('satker', satkerId, 'mutasiPersediaan'))
    tx.update(bRef, { saldoQty: h.barang.saldoQty, lapisan: h.barang.lapisan, tglTerakhir: h.barang.tglTerakhir, mutasiTerakhir: mRef.id, updatedAt: serverTimestamp() })
    tx.set(mRef, { ...h.mutasi, barangId, dibuatOleh: uid, sumber, createdAt: serverTimestamp() })
    return mRef.id
  })
}

/** Barang persediaan contoh dengan saldo awal, agar latihan opname dan pemakaian langsung dapat dikerjakan. */
export async function isiPersediaanContoh(satkerId, uid) {
  const tahun = new Date().getFullYear() - 1
  const dokumen = { jenis: 'Dokumen Lainnya', nomor: `LBKP-PSD-${tahun}` }
  const contoh = [
    ['1.01.03.01.002', 'Kertas HVS A4 70 gram', 'rim', 40, 52_000],
    ['1.01.03.01.001', 'Pulpen gel hitam', 'buah', 120, 4_500],
    ['1.01.03.01.005', 'Tinta printer hitam', 'botol', 12, 95_000],
    ['1.01.03.01.008', 'Cairan pembersih lantai', 'liter', 20, 18_000],
  ]
  for (const [kode, nama, satuan, qty, harga] of contoh) {
    const r = await buatBarangPersediaan(satkerId, { kode, nama, satuan })
    await catatMutasiPersediaan({ satkerId, barangId: r.id, uid, input: { jenis: 'saldo_awal', tanggal: `${tahun}-12-31`, qty, hargaSatuan: harga, dokumen, keterangan: 'Data contoh' } })
  }
}

// ---------------------------------------------------------------- Rekonsiliasi SIMAK vs SAKTI
// satker/{s}/sakti: realisasi belanja (diisi dosen sebagai unit akuntansi); satker/{s}/rekonsiliasi/{periode}: penjelasan & BAR.
export async function tambahSakti(satkerId, entri) {
  return addDoc(col('satker', satkerId, 'sakti'), { ...entri, nilai: Number(entri.nilai) || 0, createdAt: serverTimestamp() })
}
export async function tambahSaktiBanyak(satkerId, list) {
  const b = writeBatch(db)
  for (const e of list) b.set(doc(col('satker', satkerId, 'sakti')), { ...e, nilai: Number(e.nilai) || 0, createdAt: serverTimestamp() })
  await b.commit()
}
export async function hapusSakti(satkerId, id) {
  await deleteDoc(doc(db, 'satker', satkerId, 'sakti', id))
}
export async function simpanRekonsiliasi(satkerId, periode, data) {
  await setDoc(doc(db, 'satker', satkerId, 'rekonsiliasi', periode), { ...data, periode, updatedAt: serverTimestamp() }, { merge: true })
}

// ---------------------------------------------------------------- Lampiran (lihat src/lib/lampiran.js)
export async function unggahLampiran({ satkerId, induk, nama, tipe, ukuran, base64, uid }) {
  const bagian = potong(base64)
  const ref = doc(col('satker', satkerId, 'lampiran'))
  const b = writeBatch(db)
  b.set(ref, { induk, nama, tipe, ukuran, jumlahPotong: bagian.length, dibuatOleh: uid, createdAt: serverTimestamp() })
  bagian.forEach((data, i) => b.set(doc(db, 'satker', satkerId, 'lampiran', ref.id, 'potong', String(i)), { data }))
  await b.commit()
  return ref.id
}

export async function ambilLampiran(satkerId, l) {
  const s = await getDocs(collection(db, 'satker', satkerId, 'lampiran', l.id, 'potong'))
  return s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((d) => d.data().data).join('')
}

export async function hapusLampiran(satkerId, l) {
  const b = writeBatch(db)
  for (let i = 0; i < l.jumlahPotong; i++) b.delete(doc(db, 'satker', satkerId, 'lampiran', l.id, 'potong', String(i)))
  b.delete(doc(db, 'satker', satkerId, 'lampiran', l.id))
  await b.commit()
}

// ---------------------------------------------------------------- Kodefikasi barang (impor CSV)
// referensi/kodefikasi = metadata; referensi/kodefikasi_{i} = {daftar:[...]} per ≤2.500 kode.
export async function simpanKodefikasi(list, { sumber, oleh, lamaBagian = 0 }) {
  const bagian = bagiKodefikasi(list)
  const b = writeBatch(db)
  bagian.forEach((daftar, i) => b.set(doc(db, 'referensi', `kodefikasi_${i}`), { daftar }))
  for (let i = bagian.length; i < lamaBagian; i++) b.delete(doc(db, 'referensi', `kodefikasi_${i}`))
  b.set(doc(db, 'referensi', 'kodefikasi'), { jumlah: list.length, jumlahBagian: bagian.length, sumber, oleh, tanggal: new Date().toISOString(), updatedAt: serverTimestamp() })
  await b.commit()
}

export async function hapusKodefikasi(lamaBagian = 0) {
  const b = writeBatch(db)
  for (let i = 0; i < lamaBagian; i++) b.delete(doc(db, 'referensi', `kodefikasi_${i}`))
  b.delete(doc(db, 'referensi', 'kodefikasi'))
  await b.commit()
}

export async function muatKodefikasi(meta) {
  const docs = await Promise.all(Array.from({ length: meta?.jumlahBagian || 0 }, (_, i) => getDoc(doc(db, 'referensi', `kodefikasi_${i}`))))
  return docs.flatMap((d) => (d.exists() ? d.data().daftar || [] : []))
}
