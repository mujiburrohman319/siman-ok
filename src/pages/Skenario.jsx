import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, where } from 'firebase/firestore'
import { BookOpenCheck, Calculator, CheckCircle2, Eye, EyeOff, Plus, Save, Sparkles, Trash2, XCircle } from 'lucide-react'
import { db } from '../lib/firebase.js'
import { useAuth } from '../lib/auth.jsx'
import { useCollection, useDoc } from '../lib/hooks.js'
import { simpanNilai, simpanSkenario } from '../lib/db.js'
import { JENIS_TRANSAKSI, KONDISI, rupiah, tanggalID } from '../lib/bmn.js'
import { SUMBER_RUBRIK, nilaiSkenario, templatSkenario } from '../lib/penilaian.js'
import { skorKepatuhan, temuanWasdal } from '../lib/wasdal.js'
import { KODE_BARANG } from '../data/kodeBarang.js'
import { Alert, Badge, Button, Card, Field, Input, Kosong, Modal, PageHeader, Select, Table, Tabs, Td, Textarea, TombolEkspor } from '../components/ui.jsx'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'

const STATUS = { draft: ['slate', 'Draf'], terbit: ['teal', 'Terbit'], ditutup: ['amber', 'Ditutup'] }
const StatusSkenario = ({ s }) => <Badge tone={STATUS[s]?.[0] || 'slate'}>{STATUS[s]?.[1] || s}</Badge>
const opsiJenis = Object.entries(JENIS_TRANSAKSI).map(([value, v]) => ({ value, label: v.nama }))
const butuhNilai = (j) => JENIS_TRANSAKSI[j]?.kelompok === 'tambah' || ['pengembangan_nilai', 'koreksi_nilai'].includes(j)
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export default function Skenario() {
  const { isStaff } = useAuth()
  return (
    <>
      <PageHeader
        title={isStaff ? 'Skenario Kasus & Penilaian' : 'Skenario Kasus'}
        desc={isStaff
          ? 'Susun soal kasus beserta kunci jawaban dan rubrik per Sub-CPMK. Jawaban mahasiswa (transaksi yang dibukukan) dinilai otomatis.'
          : 'Kerjakan setiap peristiwa dengan membukukannya di menu Transaksi BMN. Nilai tampil setelah diterbitkan dosen.'}
      />
      {isStaff ? <Dosen /> : <Mahasiswa />}
    </>
  )
}

// ======================================================================== mahasiswa
function Mahasiswa() {
  const { profil } = useAuth()
  const list = useCollection(
    profil?.kelasId ? ['skenario'] : null,
    [where('kelasId', '==', profil?.kelasId || '-'), where('status', 'in', ['terbit', 'ditutup'])],
    [profil?.kelasId],
  )
  if (!profil?.kelasId) return <Alert tone="slate">Akun Anda belum ditempatkan pada kelas. Minta dosen menambahkan Anda ke satker.</Alert>
  if (!list.data.length) return <Card><Kosong icon={BookOpenCheck}>Belum ada skenario kasus yang diterbitkan untuk kelas Anda.</Kosong></Card>
  return <div className="space-y-5">{list.data.map((s) => <SoalMahasiswa key={s.id} s={s} satkerId={profil.satkerId} />)}</div>
}

function SoalMahasiswa({ s, satkerId }) {
  const { data: nilai } = useDoc(satkerId ? ['skenario', s.id, 'nilai', satkerId] : null)
  return (
    <Card icon={BookOpenCheck} title={s.judul} desc={s.batas ? `Batas pengerjaan ${tanggalID(s.batas)}` : undefined} actions={<StatusSkenario s={s.status} />}>
      {s.petunjuk && <Alert tone="slate">{s.petunjuk}</Alert>}
      <ol className="mt-4 space-y-3">
        {(s.langkah || []).map((l, i) => {
          const h = nilai?.langkah?.find((x) => x.id === l.id)
          return (
            <li key={l.id} className="flex gap-3 rounded-xl border border-slate-200 p-3.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="leading-relaxed text-slate-800">{l.narasi}</p>
                {h && <UmpanLangkah h={h} />}
              </div>
            </li>
          )
        })}
      </ol>
      {nilai && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-sm font-medium text-slate-600">Nilai akhir</p>
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{nilai.total}</p>
            <Badge tone="teal">{nilai.huruf}</Badge>
          </div>
          <TabelRubrik rubrik={nilai.rubrik || []} />
          {nilai.catatan && <p className="mt-3 text-sm text-slate-700"><b>Catatan dosen:</b> {nilai.catatan}</p>}
        </div>
      )}
    </Card>
  )
}

const fmtKriteria = (k, v) => {
  if (v === '—' || v === undefined || v === null) return '—'
  if (k.nama === 'Nilai') return rupiah(v)
  if (k.nama === 'Tanggal') return tanggalID(v)
  if (k.nama === 'Kondisi baru') return KONDISI[v] || v
  return String(v)
}

function UmpanLangkah({ h }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-slate-500">Skor langkah: {Math.round(h.skor * 100)}%{!h.transaksiId && ' — transaksi tidak ditemukan'}</p>
      <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
        {(h.kriteria || []).map((k) => (
          <li key={k.nama} className={`flex items-start gap-1 ${k.ok ? 'text-brand-700' : 'text-rose-700'}`}>
            {k.ok ? <CheckCircle2 size={13} className="mt-px shrink-0" /> : <XCircle size={13} className="mt-px shrink-0" />}
            <span>{k.nama}{!k.ok && <span className="text-slate-500"> — seharusnya {fmtKriteria(k, k.harap)}, tercatat {fmtKriteria(k, k.dapat)}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TabelRubrik({ rubrik }) {
  return (
    <div className="mt-3">
      <Table head={['Sub-CPMK', 'Uraian', 'Sumber', { label: 'Bobot', right: true }, { label: 'Skor', right: true }]}>
        {rubrik.map((r) => (
          <tr key={r.id}><Td className="font-medium">{r.kode}</Td><Td>{r.uraian}</Td><Td className="text-xs text-slate-500">{SUMBER_RUBRIK[r.sumber]}</Td><Td right>{r.bobot}</Td><Td right>{r.skor ?? '—'}</Td></tr>
        ))}
      </Table>
    </div>
  )
}

// ======================================================================== dosen
function Dosen() {
  const kelas = useCollection(['kelas']).data
  const [kelasId, setKelasId] = useState('')
  const kid = kelasId || kelas[0]?.id || ''
  const daftar = useCollection(kid ? ['skenario'] : null, [where('kelasId', '==', kid)], [kid]).data
  const [pilih, setPilih] = useState(null) // id | 'baru'
  const [templat, setTemplat] = useState(null)
  const [tab, setTab] = useState('soal')
  const aktif = daftar.find((d) => d.id === pilih)

  useEffect(() => { setPilih(null) }, [kid])

  if (!kelas.length) return <Alert tone="slate">Buat kelas terlebih dahulu di menu Kelas & Satker.</Alert>
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="self-start" title="Skenario" actions={<Select value={kid} onChange={(e) => setKelasId(e.target.value)} options={kelas.map((k) => ({ value: k.id, label: k.nama }))} className="w-32" />}>
        <div className="space-y-2">
          {daftar.map((d) => (
            <button key={d.id} onClick={() => { setPilih(d.id); setTemplat(null) }} className={`block w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${pilih === d.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="flex items-start justify-between gap-2"><span className="font-medium text-slate-800">{d.judul}</span><StatusSkenario s={d.status} /></span>
              <span className="mt-0.5 block text-xs text-slate-500">{d.langkah?.length || 0} langkah · {d.rubrik?.length || 0} rubrik</span>
            </button>
          ))}
          {!daftar.length && <p className="text-sm text-slate-500">Belum ada skenario untuk kelas ini.</p>}
        </div>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={() => { setPilih('baru'); setTemplat(null); setTab('soal') }}><Plus size={15} /> Skenario kosong</Button>
          <Button variant="secondary" onClick={() => { setPilih('baru'); setTemplat(templatSkenario()); setTab('soal') }}><Sparkles size={15} /> Dari templat contoh</Button>
        </div>
      </Card>

      <div className="min-w-0">
        {pilih === 'baru' && <Editor key={templat ? 'templat' : 'kosong'} kelasId={kid} awal={templat} onSimpan={(id) => setPilih(id)} />}
        {aktif && (
          <>
            <Tabs items={[['soal', 'Soal & kunci'], ['nilai', 'Penilaian']]} value={tab} onChange={setTab} />
            {tab === 'soal' ? <EditorAda key={aktif.id} s={aktif} /> : <Penilaian key={aktif.id} s={aktif} />}
          </>
        )}
        {!pilih && <Card><Kosong icon={BookOpenCheck}>Pilih skenario atau buat yang baru. Templat contoh memakai data contoh satker (12 NUP) sehingga langsung dapat dikerjakan.</Kosong></Card>}
      </div>
    </div>
  )
}

function EditorAda({ s }) {
  const { data: kunci, loading } = useDoc(['skenario', s.id, 'kunci', 'jawaban'])
  if (loading) return null
  return <Editor id={s.id} kelasId={s.kelasId} awal={{ ...s, kunci: kunci?.langkah || {} }} />
}

function Editor({ id, kelasId, awal, onSimpan }) {
  const { user } = useAuth()
  const toast = useToast()
  const kosong = { judul: '', petunjuk: 'Bukukan setiap peristiwa di menu Transaksi BMN. Isi nomor dokumen persis seperti pada soal.', batas: '', status: 'draft', rubrik: [{ id: 'r1', kode: 'Sub-CPMK 1', uraian: '', bobot: 100, sumber: 'otomatis' }], langkah: [], kunci: {} }
  const [f, setF] = useState(() => ({ ...kosong, ...(awal || {}) }))
  const [proses, setProses] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const ubahRubrik = (i, p) => set('rubrik', f.rubrik.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const ubahLangkah = (i, p) => set('langkah', f.langkah.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const ubahKunci = (lid, p) => set('kunci', { ...f.kunci, [lid]: { ...(f.kunci[lid] || {}), ...p } })
  const totalBobot = f.rubrik.reduce((s, r) => s + (Number(r.bobot) || 0), 0)

  async function simpan() {
    if (!f.judul.trim()) return toast.galat('Judul skenario wajib diisi.')
    if (f.status !== 'draft' && f.langkah.some((l) => !f.kunci[l.id]?.jenis)) return toast.galat('Lengkapi kunci setiap langkah sebelum menerbitkan.')
    setProses(true)
    try {
      const { kunci, id: _i, createdAt: _c, updatedAt: _u, dosenUid: _d, ...data } = f
      const rubrik = f.rubrik.map((r) => ({ ...r, bobot: Number(r.bobot) || 0 }))
      const langkah = f.langkah.map((l) => ({ ...l, bobot: Number(l.bobot) || 1 }))
      const k = Object.fromEntries(langkah.map((l) => [l.id, kunci[l.id] || {}]))
      const baru = await simpanSkenario(id, { ...data, rubrik, langkah, kelasId }, k, user.uid)
      toast.sukses(f.status === 'terbit' ? 'Skenario tersimpan dan terbit untuk mahasiswa.' : 'Skenario tersimpan.')
      onSimpan?.(baru)
    } catch (e) {
      toast.galat(e)
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card title={id ? 'Ubah skenario' : 'Skenario baru'} actions={<Button onClick={simpan} disabled={proses}><Save size={15} /> {proses ? 'Menyimpan…' : 'Simpan'}</Button>}>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
          <Field label="Judul"><Input value={f.judul} onChange={(e) => set('judul', e.target.value)} /></Field>
          <Field label="Batas pengerjaan"><Input type="date" value={f.batas} onChange={(e) => set('batas', e.target.value)} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => set('status', e.target.value)} options={Object.entries(STATUS).map(([value, [, label]]) => ({ value, label }))} /></Field>
        </div>
        <Field label="Petunjuk untuk mahasiswa" className="mt-4"><Textarea value={f.petunjuk} onChange={(e) => set('petunjuk', e.target.value)} /></Field>
      </Card>

      <Card title="Rubrik per Sub-CPMK" desc={`Total bobot ${totalBobot}${totalBobot !== 100 ? ' (disarankan 100)' : ''}`} actions={<Button size="sm" variant="secondary" onClick={() => set('rubrik', [...f.rubrik, { id: uid('r'), kode: `Sub-CPMK ${f.rubrik.length + 1}`, uraian: '', bobot: 0, sumber: 'manual' }])}><Plus size={14} /> Rubrik</Button>}>
        <div className="space-y-2">
          {f.rubrik.map((r, i) => (
            <div key={r.id} className="grid items-start gap-2 sm:grid-cols-[120px_1fr_200px_80px_32px]">
              <Input value={r.kode} onChange={(e) => ubahRubrik(i, { kode: e.target.value })} aria-label="Kode Sub-CPMK" />
              <Input value={r.uraian} placeholder="Uraian kemampuan" onChange={(e) => ubahRubrik(i, { uraian: e.target.value })} />
              <Select value={r.sumber} onChange={(e) => ubahRubrik(i, { sumber: e.target.value })} options={Object.entries(SUMBER_RUBRIK).map(([value, label]) => ({ value, label }))} />
              <Input type="number" min="0" value={r.bobot} onChange={(e) => ubahRubrik(i, { bobot: e.target.value })} aria-label="Bobot" className="text-right" />
              <Button size="sm" variant="ghost" onClick={() => set('rubrik', f.rubrik.filter((_, j) => j !== i))} aria-label="Hapus rubrik"><Trash2 size={15} /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Langkah & kunci jawaban (${f.langkah.length})`} desc="Kunci hanya dapat dibaca dosen" actions={<Button size="sm" variant="secondary" onClick={() => set('langkah', [...f.langkah, { id: uid('l'), narasi: '', rubrikId: f.rubrik.find((r) => r.sumber === 'otomatis')?.id || '', bobot: 1 }])}><Plus size={14} /> Langkah</Button>}>
        {!f.langkah.length && <Kosong>Tambahkan peristiwa yang harus dibukukan mahasiswa.</Kosong>}
        <ol className="space-y-4">
          {f.langkah.map((l, i) => {
            const k = f.kunci[l.id] || {}
            const tambah = JENIS_TRANSAKSI[k.jenis]?.kelompok === 'tambah'
            return (
              <li key={l.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Langkah {i + 1}</p>
                  <Button size="sm" variant="ghost" onClick={() => set('langkah', f.langkah.filter((_, j) => j !== i))}><Trash2 size={14} /> Hapus</Button>
                </div>
                <Field label="Narasi peristiwa (dibaca mahasiswa)"><Textarea value={l.narasi} onChange={(e) => ubahLangkah(i, { narasi: e.target.value })} /></Field>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_90px]">
                  <Field label="Rubrik"><Select value={l.rubrikId} onChange={(e) => ubahLangkah(i, { rubrikId: e.target.value })} placeholder="— pilih —" options={f.rubrik.filter((r) => r.sumber === 'otomatis').map((r) => ({ value: r.id, label: `${r.kode} ${r.uraian}` }))} /></Field>
                  <Field label="Bobot"><Input type="number" min="1" value={l.bobot} onChange={(e) => ubahLangkah(i, { bobot: e.target.value })} /></Field>
                </div>
                <div className="mt-3 rounded-lg bg-amber-50/60 p-3 ring-1 ring-inset ring-amber-200/70">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Kunci jawaban</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Jenis transaksi"><Select value={k.jenis || ''} onChange={(e) => ubahKunci(l.id, { jenis: e.target.value })} placeholder="— pilih —" options={opsiJenis} /></Field>
                    <Field label="Tanggal"><Input type="date" value={k.tanggal || ''} onChange={(e) => ubahKunci(l.id, { tanggal: e.target.value })} /></Field>
                    <Field label="Nomor dokumen"><Input value={k.nomorDokumen || ''} onChange={(e) => ubahKunci(l.id, { nomorDokumen: e.target.value })} /></Field>
                    {k.jenis && (tambah ? (
                      <Field label="Kode barang" className="sm:col-span-2"><Select value={k.kodeBarang || ''} onChange={(e) => ubahKunci(l.id, { kodeBarang: e.target.value })} placeholder="— pilih —" options={KODE_BARANG.map((x) => ({ value: x.kode, label: `${x.kode} ${x.uraian}` }))} /></Field>
                    ) : (
                      <>
                        <Field label="Kode barang sasaran"><Select value={k.target?.kodeBarang || ''} onChange={(e) => ubahKunci(l.id, { target: { ...k.target, kodeBarang: e.target.value } })} placeholder="— pilih —" options={KODE_BARANG.map((x) => ({ value: x.kode, label: `${x.kode} ${x.uraian}` }))} /></Field>
                        <Field label="NUP sasaran"><Input type="number" min="1" value={k.target?.nup || ''} onChange={(e) => ubahKunci(l.id, { target: { ...k.target, nup: Number(e.target.value) } })} /></Field>
                      </>
                    ))}
                    {butuhNilai(k.jenis) && <Field label="Nilai (Rp)"><Input type="number" min="0" value={k.nilai ?? ''} onChange={(e) => ubahKunci(l.id, { nilai: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>}
                    {k.jenis === 'koreksi_kondisi' && <Field label="Kondisi baru"><Select value={k.kondisiBaru || ''} onChange={(e) => ubahKunci(l.id, { kondisiBaru: e.target.value })} placeholder="— pilih —" options={Object.entries(KONDISI).map(([value, label]) => ({ value, label }))} /></Field>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

function Penilaian({ s }) {
  const { user, ref } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const { data: kunci } = useDoc(['skenario', s.id, 'kunci', 'jawaban'])
  const satker = useCollection(['satker'], [where('kelasId', '==', s.kelasId)], [s.kelasId]).data
  const users = useCollection(['users'], [where('kelasId', '==', s.kelasId)], [s.kelasId]).data
  const tersimpan = useCollection(['skenario', s.id, 'nilai']).data
  const [hasil, setHasil] = useState({}) // satkerId -> hasil nilaiSkenario (belum disimpan)
  const [manual, setManual] = useState({}) // satkerId -> {rubrikId: skor}
  const [catatan, setCatatan] = useState({})
  const [wasdal, setWasdal] = useState({})
  const [proses, setProses] = useState(false)
  const [detail, setDetail] = useState(null)

  const simpanan = useMemo(() => Object.fromEntries(tersimpan.map((n) => [n.id, n])), [tersimpan])
  useEffect(() => {
    setManual((m) => ({ ...Object.fromEntries(tersimpan.map((n) => [n.id, n.manual || {}])), ...m }))
    setCatatan((c) => ({ ...Object.fromEntries(tersimpan.map((n) => [n.id, n.catatan || ''])), ...c }))
  }, [tersimpan])

  const rubrikManual = (s.rubrik || []).filter((r) => r.sumber === 'manual')
  const urut = [...satker].sort((a, b) => a.kode.localeCompare(b.kode))

  async function hitung() {
    if (!kunci) return toast.galat('Kunci jawaban belum tersedia.')
    setProses(true)
    try {
      const out = {}
      const ws = {}
      for (const st of satker) {
        const [a, t] = await Promise.all([
          getDocs(collection(db, 'satker', st.id, 'aset')),
          getDocs(collection(db, 'satker', st.id, 'transaksi')),
        ])
        const aset = a.docs.map((d) => ({ id: d.id, ...d.data() }))
        const trx = t.docs.map((d) => ({ id: d.id, ...d.data() }))
        ws[st.id] = { aset, trx, skor: skorKepatuhan(temuanWasdal({ aset, transaksi: trx, ref })) }
        out[st.id] = nilaiSkenario(s, kunci.langkah, trx, { manual: manual[st.id] || {}, skorWasdal: ws[st.id].skor })
      }
      setWasdal(ws)
      setHasil(out)
      toast.info(`Nilai ${satker.length} satker dihitung. Periksa, lalu simpan.`)
    } catch (e) {
      toast.galat(e)
    } finally {
      setProses(false)
    }
  }

  // Hitung ulang cepat saat nilai manual diubah (tanpa membaca ulang Firestore)
  function ubahManual(satkerId, rubrikId, v) {
    const m = { ...(manual[satkerId] || {}), [rubrikId]: v }
    setManual({ ...manual, [satkerId]: m })
    if (wasdal[satkerId] && kunci) {
      setHasil((h) => ({ ...h, [satkerId]: nilaiSkenario(s, kunci.langkah, wasdal[satkerId].trx, { manual: m, skorWasdal: wasdal[satkerId].skor }) }))
    }
  }

  const tampil = (id) => hasil[id] || simpanan[id]

  async function simpan(terbit) {
    const ids = Object.keys(hasil)
    if (!ids.length && terbit === undefined) return toast.galat('Hitung nilai terlebih dahulu.')
    if (terbit && !(await konfirmasi({ judul: 'Terbitkan nilai ke mahasiswa?', pesan: 'Mahasiswa dapat melihat nilai, skor per rubrik, dan umpan balik tiap langkah (termasuk jawaban yang seharusnya).', ya: 'Terbitkan' }))) return
    const target = ids.length ? ids : Object.keys(simpanan)
    const data = Object.fromEntries(target.map((id) => [id, {
      ...(hasil[id] ? { total: hasil[id].total, huruf: hasil[id].huruf, lengkap: hasil[id].lengkap, rubrik: hasil[id].rubrik, langkah: hasil[id].langkah } : {}),
      manual: manual[id] || {},
      catatan: catatan[id] || '',
      ...(terbit !== undefined ? { terbit } : {}),
    }]))
    await simpanNilai(s.id, data, user.uid)
    setHasil({})
    toast.sukses(terbit === true ? 'Nilai diterbitkan.' : terbit === false ? 'Nilai ditarik dari mahasiswa.' : 'Nilai tersimpan.')
  }

  const ekspor = () => {
    const rb = s.rubrik || []
    const perMhs = [...users].filter((u) => u.role === 'kpb').sort((a, b) => String(a.nim).localeCompare(String(b.nim)))
    const satkerOf = Object.fromEntries(satker.map((x) => [x.id, x]))
    return [
      {
        judul: `Rekap Nilai — ${s.judul}`, sheet: 'Rekap per mahasiswa', subjudul: [`Per ${tanggalID(new Date())}`],
        kolom: [{ label: 'No', tipe: 'angka' }, { label: 'NIM' }, { label: 'Nama' }, { label: 'Satker' }, ...rb.map((r) => ({ label: `${r.kode} (${r.bobot}%)`, tipe: 'angka' })), { label: 'Nilai akhir', tipe: 'angka' }, { label: 'Huruf' }],
        baris: perMhs.map((u, i) => {
          const n = tampil(u.satkerId)
          return [i + 1, u.nim, u.nama, satkerOf[u.satkerId]?.kode || '—', ...rb.map((r) => n?.rubrik?.find((x) => x.id === r.id)?.skor ?? ''), n?.total ?? '', n?.huruf ?? '']
        }),
      },
      {
        judul: `Rincian per langkah — ${s.judul}`, sheet: 'Rincian langkah',
        kolom: [{ label: 'Satker' }, ...(s.langkah || []).map((l, i) => ({ label: `Langkah ${i + 1} (%)`, tipe: 'angka' })), { label: 'Skor wasdal', tipe: 'angka' }],
        baris: urut.map((st) => {
          const n = tampil(st.id)
          return [`${st.kode} ${st.nama}`, ...(s.langkah || []).map((l) => { const h = n?.langkah?.find((x) => x.id === l.id); return h ? Math.round(h.skor * 100) : '' }), n?.rubrik?.find((r) => r.sumber === 'wasdal')?.skor ?? '']
        }),
      },
    ]
  }

  const adaBelum = Object.keys(hasil).length > 0
  return (
    <Card
      icon={Calculator}
      title="Penilaian"
      desc={adaBelum ? 'Ada hasil hitung yang belum disimpan' : `${tersimpan.length} satker sudah dinilai`}
      actions={
        <>
          <Button variant="secondary" onClick={hitung} disabled={proses}><Calculator size={15} /> {proses ? 'Menghitung…' : 'Hitung nilai otomatis'}</Button>
          <Button onClick={() => simpan()} disabled={!adaBelum}><Save size={15} /> Simpan</Button>
          <Button variant="secondary" onClick={() => simpan(true)} disabled={!adaBelum && !tersimpan.length}><Eye size={15} /> Terbitkan</Button>
          <Button variant="ghost" onClick={() => simpan(false)} disabled={!tersimpan.some((n) => n.terbit)}><EyeOff size={15} /> Tarik</Button>
          <TombolEkspor nama={`Rekap nilai ${s.judul}`} laporan={ekspor} />
        </>
      }
    >
      {s.status === 'draft' && <div className="mb-4"><Alert>Skenario masih draf: mahasiswa belum dapat melihat soal.</Alert></div>}
      <Table head={['Satker', ...(s.rubrik || []).map((r) => ({ label: `${r.kode} (${r.bobot})`, right: true })), { label: 'Nilai', right: true }, 'Huruf', 'Status', '']} empty={urut.length ? null : 'Belum ada satker di kelas ini.'}>
        {urut.map((st) => {
          const n = tampil(st.id)
          return (
            <tr key={st.id}>
              <Td><span className="font-medium text-slate-800">{st.kode}</span><span className="block text-xs text-slate-500">{st.nama}</span></Td>
              {(s.rubrik || []).map((r) => (
                <Td key={r.id} right>
                  {r.sumber === 'manual'
                    ? <Input type="number" min="0" max="100" value={manual[st.id]?.[r.id] ?? ''} onChange={(e) => ubahManual(st.id, r.id, e.target.value)} className="w-20 text-right" aria-label={`${r.kode} ${st.kode}`} />
                    : (n?.rubrik?.find((x) => x.id === r.id)?.skor ?? '—')}
                </Td>
              ))}
              <Td right className="font-semibold text-slate-900">{n ? n.total : '—'}</Td>
              <Td>{n ? <Badge tone="teal">{n.huruf}</Badge> : '—'}</Td>
              <Td>{hasil[st.id] ? <Badge tone="amber">Belum disimpan</Badge> : simpanan[st.id]?.terbit ? <Badge tone="teal">Terbit</Badge> : simpanan[st.id] ? <Badge>Tersimpan</Badge> : '—'}</Td>
              <Td>{n?.langkah && <Button size="sm" variant="ghost" onClick={() => setDetail(st)}>Rincian</Button>}</Td>
            </tr>
          )
        })}
      </Table>
      {rubrikManual.length > 0 && <p className="mt-3 text-xs text-slate-500">Kolom {rubrikManual.map((r) => r.kode).join(', ')} diisi dosen (0–100). Rubrik yang belum diisi tidak ikut dihitung.</p>}

      <Modal open={!!detail} onClose={() => setDetail(null)} wide title={detail ? `Rincian penilaian — ${detail.kode} ${detail.nama}` : ''}>
        {detail && (() => {
          const n = tampil(detail.id)
          return (
            <div className="space-y-4">
              <ol className="space-y-3">
                {(s.langkah || []).map((l, i) => {
                  const h = n?.langkah?.find((x) => x.id === l.id)
                  return (
                    <li key={l.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-800">Langkah {i + 1}: <span className="font-normal text-slate-600">{l.narasi}</span></p>
                      {h && <UmpanLangkah h={h} />}
                    </li>
                  )
                })}
              </ol>
              <Field label="Catatan untuk satker (tampil bersama nilai)"><Textarea value={catatan[detail.id] || ''} onChange={(e) => setCatatan({ ...catatan, [detail.id]: e.target.value })} /></Field>
              <p className="text-xs text-slate-500">Catatan tersimpan saat Anda menekan Simpan atau Terbitkan.</p>
              {wasdal[detail.id] && <p className="text-xs text-slate-500">Skor wasdal saat dihitung: {wasdal[detail.id].skor} · {wasdal[detail.id].trx.length} transaksi · nilai aset {rupiah(wasdal[detail.id].aset.reduce((x, a) => x + (a.status !== 'dihapus' ? a.nilai : 0), 0))}</p>}
            </div>
          )
        })()}
      </Modal>
    </Card>
  )
}
