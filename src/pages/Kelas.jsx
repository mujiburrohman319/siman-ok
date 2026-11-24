import { useState } from 'react'
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { buatKelas, buatSatker, cariUserByEmail, isiDataContoh, tambahAnggota } from '../lib/db.js'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td } from '../components/ui.jsx'

export default function Kelas() {
  const { user } = useAuth()
  const kelas = useCollection(['kelas']).data
  const [pilih, setPilih] = useState('')
  const [f, setF] = useState({ nama: 'ASP 2A', mk: 'Manajemen Barang Milik Negara', tahunAkademik: '2025/2026', semester: 'Genap' })
  const kelasId = pilih || kelas[0]?.id || ''

  return (
    <>
      <PageHeader title="Kelas & Satker" desc="Buat kelas, bentuk satker simulasi (perorangan atau kelompok), dan tempatkan mahasiswa. Mahasiswa mendaftar sendiri lewat halaman masuk." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Kelas">
          <div className="space-y-2">
            {kelas.map((k) => (
              <button key={k.id} onClick={() => setPilih(k.id)} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${k.id === kelasId ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="font-medium">{k.nama}</span>
                <span className="block text-xs text-slate-500">{k.mk} · {k.semester} {k.tahunAkademik}</span>
              </button>
            ))}
          </div>
          <form className="mt-5 space-y-2 border-t border-slate-100 pt-4" onSubmit={async (e) => { e.preventDefault(); const r = await buatKelas(f, user.uid); setPilih(r.id) }}>
            <p className="text-sm font-medium text-slate-700">Kelas baru</p>
            <Input placeholder="Nama kelas" required value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} />
            <Input placeholder="Mata kuliah" required value={f.mk} onChange={(e) => setF({ ...f, mk: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Tahun akademik" value={f.tahunAkademik} onChange={(e) => setF({ ...f, tahunAkademik: e.target.value })} />
              <Select value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })} options={['Ganjil', 'Genap'].map((v) => ({ value: v, label: v }))} />
            </div>
            <Button type="submit">Buat kelas</Button>
          </form>
          <PromosiDosen />
        </Card>
        <div className="lg:col-span-2">{kelasId ? <DaftarSatker kelasId={kelasId} /> : <Alert tone="slate">Buat kelas terlebih dahulu.</Alert>}</div>
      </div>
    </>
  )
}

function DaftarSatker({ kelasId }) {
  const satker = useCollection(['satker'], [where('kelasId', '==', kelasId)], [kelasId]).data
  const users = useCollection(['users'], [where('kelasId', '==', kelasId)], [kelasId]).data
  const [f, setF] = useState({ kode: '', nama: '' })
  return (
    <Card title={`Satker simulasi (${satker.length})`}>
      <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); await buatSatker({ kelasId, ...f }); setF({ kode: '', nama: '' }) }}>
        <Field label="Kode satker"><Input required placeholder="mis. 023.SIM.01" value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value })} className="w-40" /></Field>
        <Field label="Nama satker"><Input required placeholder="mis. Satker Simulasi Kelompok 1" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} className="w-72" /></Field>
        <Button type="submit">Tambah satker</Button>
      </form>
      <div className="space-y-3">
        {[...satker].sort((a, b) => a.kode.localeCompare(b.kode)).map((s) => <BarisSatker key={s.id} s={s} anggota={users.filter((u) => s.anggota?.includes(u.id))} />)}
      </div>
    </Card>
  )
}

function BarisSatker({ s, anggota }) {
  const { user, ref } = useAuth()
  const { setPilihan } = useSatker()
  const [email, setEmail] = useState('')
  const [apip, setApip] = useState(false)
  const [pesan, setPesan] = useState(null)
  const [proses, setProses] = useState(false)

  async function tambah(e) {
    e.preventDefault()
    setPesan(null)
    const u = await cariUserByEmail(email)
    if (!u) return setPesan({ tone: 'rose', teks: 'Email belum terdaftar. Minta mahasiswa mendaftar terlebih dahulu.' })
    if (u.satkerId && u.satkerId !== s.id) return setPesan({ tone: 'rose', teks: `${u.nama} sudah berada di satker lain.` })
    await tambahAnggota(s, u, { apip })
    setEmail('')
    setPesan({ tone: 'teal', teks: `${u.nama} ditambahkan.` })
  }

  async function contoh() {
    const ada = await getDocs(query(collection(db, 'satker', s.id, 'aset'), limit(1)))
    if (!ada.empty) return setPesan({ tone: 'rose', teks: 'Satker sudah memiliki aset; data contoh hanya untuk satker kosong.' })
    setProses(true)
    try {
      await isiDataContoh(s.id, user.uid, ref)
      setPesan({ tone: 'teal', teks: 'Saldo awal contoh (12 NUP) telah dibukukan.' })
    } catch (e) {
      setPesan({ tone: 'rose', teks: e.message })
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-slate-800">{s.kode} · {s.nama}</p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => setPilihan(s.id)}>Jadikan satker aktif</Button>
          <Button variant="secondary" onClick={contoh} disabled={proses}>{proses ? 'Mengisi…' : 'Isi data contoh'}</Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {anggota.length ? anggota.map((u) => (
          <Badge key={u.id} tone={s.apipUids?.includes(u.id) ? 'amber' : 'slate'}>{u.nama} ({u.nim}){s.apipUids?.includes(u.id) ? ' · APIP' : ''}</Badge>
        )) : <span className="text-xs text-slate-500">Belum ada anggota.</span>}
      </div>
      <form onSubmit={tambah} className="mt-3 flex flex-wrap items-center gap-2">
        <Input type="email" required placeholder="email mahasiswa" value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" />
        <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={apip} onChange={(e) => setApip(e.target.checked)} /> Peran APIP</label>
        <Button type="submit" variant="secondary">Tambah anggota</Button>
      </form>
      {pesan && <div className="mt-2"><Alert tone={pesan.tone}>{pesan.teks}</Alert></div>}
    </div>
  )
}

function PromosiDosen() {
  const [email, setEmail] = useState('')
  const [pesan, setPesan] = useState('')
  return (
    <form className="mt-5 space-y-2 border-t border-slate-100 pt-4" onSubmit={async (e) => {
      e.preventDefault()
      const u = await cariUserByEmail(email)
      if (!u) return setPesan('Email belum terdaftar.')
      await updateDoc(doc(db, 'users', u.id), { role: 'pengelola' })
      setPesan(`${u.nama} sekarang berperan sebagai Pengelola Barang (dosen).`)
      setEmail('')
    }}>
      <p className="text-sm font-medium text-slate-700">Tambah dosen / asisten</p>
      <Input type="email" required placeholder="email yang sudah terdaftar" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" variant="secondary">Jadikan Pengelola Barang</Button>
      {pesan && <p className="text-xs text-slate-600">{pesan}</p>}
    </form>
  )
}
