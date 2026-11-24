import { useEffect, useMemo, useState } from 'react'
import { CopyPlus, GitCompareArrows, Lock, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection, useDoc } from '../lib/hooks.js'
import { hapusSakti, simpanRekonsiliasi, tambahSakti, tambahSaktiBanyak } from '../lib/db.js'
import { AKUN_BELANJA, AKUN_REKON, akunDariBelanja, rekonsiliasi, saktiDariSimak } from '../lib/rekonsiliasi.js'
import { rupiah, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Stat, Table, Td, Textarea, TombolEkspor } from '../components/ui.jsx'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'
import { usePersediaan } from './Persediaan.jsx'

function opsiPeriode() {
  const y = new Date().getFullYear()
  const out = []
  for (let t = y; t >= y - 2; t--) out.push([`${t}-S2`, `Semester II ${t}`, `${t}-07-01`, `${t}-12-31`], [`${t}-S1`, `Semester I ${t}`, `${t}-01-01`, `${t}-06-30`], [`${t}-TH`, `Tahunan ${t}`, `${t}-01-01`, `${t}-12-31`])
  return out
}

export default function Rekonsiliasi() {
  return (
    <>
      <PageHeader
        title="Rekonsiliasi SIMAK–SAKTI"
        desc="Simulasi rekonsiliasi internal: perolehan BMN dan persediaan yang dibiayai belanja (SIMAK-BMN) dibandingkan dengan realisasi belanja per SP2D (SAKTI). Setiap selisih wajib dijelaskan sebelum Berita Acara Rekonsiliasi difinalkan."
      />
      <PerluSatker><Isi /></PerluSatker>
    </>
  )
}

function Isi() {
  const { isStaff } = useAuth()
  const { satkerId, satker, transaksi } = useSatker()
  const { mutasi } = usePersediaan()
  const sakti = useCollection(['satker', satkerId, 'sakti']).data
  const periode = opsiPeriode()
  const [p, setP] = useState(`${new Date().getFullYear()}-S1`)
  const [, label, mulai, akhir] = periode.find((x) => x[0] === p)
  const { data: dok } = useDoc(['satker', satkerId, 'rekonsiliasi', p])
  const r = useMemo(() => rekonsiliasi({ transaksi, mutasiPersediaan: mutasi, sakti, mulai, akhir }), [transaksi, mutasi, sakti, mulai, akhir])
  const total = (k) => r.perAkun.reduce((s, x) => s + x[k], 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={p} onChange={(e) => setP(e.target.value)} options={periode.map(([value, l]) => ({ value, label: l }))} className="w-52" />
        {dok?.status === 'final' ? <Badge tone="teal">BAR final</Badge> : <Badge>Draf</Badge>}
        {r.seimbang && r.perAkun.length > 0 && <Badge tone="teal">Seimbang</Badge>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={GitCompareArrows} label="Menurut SIMAK-BMN" value={rupiah(total('simak'))} sub="Perolehan yang menambah neraca" />
        <Stat icon={GitCompareArrows} tone="blue" label="Menurut SAKTI" value={rupiah(total('sakti'))} sub={`${sakti.filter((s) => s.tanggal >= mulai && s.tanggal <= akhir).length} SP2D pada periode ini`} />
        <Stat icon={GitCompareArrows} tone={r.seimbang ? 'teal' : 'amber'} label="Selisih" value={rupiah(total('selisih'))} sub={r.seimbang ? 'Tidak ada selisih per akun' : `${r.perAkun.filter((x) => x.selisih).length} akun berselisih`} />
      </div>
      <PerAkun r={r} dok={dok} periode={p} label={label} satker={satker} />
      <Pencocokan r={r} />
      <DataSakti sakti={sakti} mulai={mulai} akhir={akhir} transaksi={transaksi} mutasi={mutasi} edit={isStaff} />
    </div>
  )
}

function PerAkun({ r, dok, periode, label, satker }) {
  const { satkerId } = useSatker()
  const { isStaff, profil } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const [penjelasan, setPenjelasan] = useState({})
  useEffect(() => { setPenjelasan(dok?.penjelasan || {}) }, [dok?.updatedAt?.seconds, periode]) // eslint-disable-line react-hooks/exhaustive-deps
  const final = dok?.status === 'final'
  const terkunci = final && !isStaff
  const berselisih = r.perAkun.filter((x) => x.selisih)
  const kurang = berselisih.filter((x) => !String(penjelasan[x.akun] || '').trim())

  async function simpan(status) {
    if (status === 'final') {
      if (kurang.length) return toast.galat(`Jelaskan selisih akun: ${kurang.map((x) => x.akun).join(', ')}.`)
      if (!(await konfirmasi({ judul: 'Finalkan Berita Acara Rekonsiliasi?', pesan: 'Penjelasan selisih dikunci dan BAR siap diunduh. Hanya dosen yang dapat membuka kembali.', ya: 'Finalkan' }))) return
    }
    await simpanRekonsiliasi(satkerId, periode, {
      penjelasan, status, ringkasan: r.perAkun,
      ...(status === 'final' ? { difinalkanOleh: profil.nama, tanggalFinal: new Date().toISOString() } : {}),
    })
    toast.sukses(status === 'final' ? 'Berita Acara Rekonsiliasi difinalkan.' : status === 'draft' && final ? 'BAR dibuka kembali.' : 'Penjelasan tersimpan.')
  }

  const ekspor = () => [
    {
      judul: 'Berita Acara Rekonsiliasi Internal SIMAK-BMN dan SAKTI', sheet: 'BAR',
      subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, label, final ? `Difinalkan ${tanggalID(dok?.tanggalFinal)} oleh ${dok?.difinalkanOleh}` : 'DRAF'],
      kolom: [{ label: 'Akun' }, { label: 'SIMAK-BMN', tipe: 'uang' }, { label: 'SAKTI', tipe: 'uang' }, { label: 'Selisih', tipe: 'uang' }, { label: 'Penjelasan' }],
      baris: r.perAkun.map((x) => [x.akun, x.simak, x.sakti, x.selisih, penjelasan[x.akun] || '']),
      total: ['Jumlah', r.perAkun.reduce((s, x) => s + x.simak, 0), r.perAkun.reduce((s, x) => s + x.sakti, 0), r.perAkun.reduce((s, x) => s + x.selisih, 0), ''],
    },
    {
      judul: 'Rincian dokumen yang tidak cocok', sheet: 'Rincian',
      kolom: [{ label: 'Kategori' }, { label: 'Tanggal' }, { label: 'Nomor' }, { label: 'Uraian' }, { label: 'Akun' }, { label: 'Nilai', tipe: 'uang' }],
      baris: [
        ...r.beda.map((b) => ['Beda (' + b.catatan + ')', tanggalID(b.simak.tanggal), b.simak.nomor, b.simak.uraian, b.simak.akun, b.simak.nilai - b.sakti.nilai]),
        ...r.hanyaSimak.map((s) => ['Hanya di SIMAK', tanggalID(s.tanggal), s.nomor, s.uraian, s.akun, s.nilai]),
        ...r.hanyaSakti.map((s) => ['Hanya di SAKTI', tanggalID(s.tanggal), s.nomorSP2D, s.uraian, s.akun, s.nilai]),
      ],
    },
  ]

  return (
    <Card icon={GitCompareArrows} title="Rekonsiliasi per akun" desc={label}
      actions={<>
        {!terkunci && <Button variant="secondary" onClick={() => simpan(final ? 'final' : 'draft')}>Simpan penjelasan</Button>}
        {!final && <Button onClick={() => simpan('final')} disabled={!r.perAkun.length}><Lock size={15} /> Finalkan BAR</Button>}
        {final && isStaff && <Button variant="secondary" onClick={() => simpan('draft')}>Buka kembali</Button>}
        <TombolEkspor nama={`BAR Rekonsiliasi ${label}`} laporan={ekspor} tandaTangan={['Petugas SIMAK-BMN', 'Petugas Akuntansi (SAKTI)', 'Kuasa Pengguna Barang']} />
      </>}>
      <Table head={['Akun', { label: 'SIMAK-BMN', right: true }, { label: 'SAKTI', right: true }, { label: 'Selisih', right: true }, 'Penjelasan selisih']} empty={r.perAkun.length ? null : 'Tidak ada perolehan atau realisasi belanja pada periode ini.'}>
        {r.perAkun.map((x) => (
          <tr key={x.akun}>
            <Td className="font-medium text-slate-800">{x.akun}</Td>
            <Td right>{rupiah(x.simak)}</Td>
            <Td right>{rupiah(x.sakti)}</Td>
            <Td right className={x.selisih ? 'font-semibold text-rose-700' : 'text-slate-400'}>{rupiah(x.selisih)}</Td>
            <Td className="min-w-72">
              {x.selisih ? (
                terkunci
                  ? <span className="text-sm">{penjelasan[x.akun]}</span>
                  : <Textarea rows={2} value={penjelasan[x.akun] || ''} onChange={(e) => setPenjelasan({ ...penjelasan, [x.akun]: e.target.value })} placeholder="Penyebab selisih dan tindak lanjut" />
              ) : <Badge tone="teal">Sesuai</Badge>}
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}

function Daftar({ judul, tone, list, render, kosong }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700"><Badge tone={tone}>{list.length}</Badge> {judul}</p>
      {list.length ? <ul className="space-y-1.5 text-sm">{list.map(render)}</ul> : <p className="text-sm text-slate-400">{kosong}</p>}
    </div>
  )
}

function Pencocokan({ r }) {
  const baris = (kiri, kanan, nilai, key) => (
    <li key={key} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <span><span className="font-mono text-xs text-slate-500">{kiri}</span> {kanan}</span>
      <span className="tabular-nums">{nilai}</span>
    </li>
  )
  return (
    <Card title="Pencocokan per dokumen" desc={`${r.cocok.length} dokumen cocok di kedua sisi`}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Daftar judul="Nomor sama, nilai/akun berbeda" tone="amber" list={r.beda} kosong="Tidak ada."
          render={(b, i) => baris(b.simak.nomor, `${b.simak.uraian} — ${b.catatan}`, `${rupiah(b.simak.nilai)} vs ${rupiah(b.sakti.nilai)}`, i)} />
        <Daftar judul="Hanya di SAKTI (belanja belum/tidak dicatat sebagai BMN)" tone="rose" list={r.hanyaSakti} kosong="Tidak ada."
          render={(s) => baris(s.nomorSP2D, `${s.uraian} · ${s.akun}`, rupiah(s.nilai), s.id)} />
        <Daftar judul="Hanya di SIMAK (perolehan tanpa realisasi belanja yang cocok)" tone="blue" list={r.hanyaSimak} kosong="Tidak ada."
          render={(s) => baris(s.nomor, s.uraian, rupiah(s.nilai), s.id)} />
        <Daftar judul="Dibeli dengan belanja tetapi di bawah batas kapitalisasi (ekstrakomptabel)" tone="slate" list={r.ekstrakomptabel} kosong="Tidak ada."
          render={(s) => baris(s.nomor, `${s.uraian}${s.sakti ? ' — SP2D tercatat di SAKTI, tidak menambah neraca' : ''}`, rupiah(s.nilaiBelanja), s.id)} />
      </div>
    </Card>
  )
}

function DataSakti({ sakti, mulai, akhir, transaksi, mutasi, edit }) {
  const { satkerId } = useSatker()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const kosong = { tanggal: mulai, akunBelanja: '532111', uraian: '', nilai: '', nomorSP2D: '' }
  const [f, setF] = useState(kosong)
  const list = sakti.filter((s) => s.tanggal >= mulai && s.tanggal <= akhir).sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  async function salin() {
    const data = saktiDariSimak({ transaksi, mutasiPersediaan: mutasi, mulai, akhir })
    if (!data.length) return toast.info('Tidak ada pembelian/pengembangan pada periode ini.')
    if (!(await konfirmasi({ judul: `Salin ${data.length} realisasi dari Buku Barang?`, pesan: 'Data SAKTI dibuat sama persis dengan pencatatan SIMAK. Setelah itu sisipkan perbedaan (ubah nilai, tambah SP2D) agar mahasiswa berlatih menelusuri selisih.', ya: 'Salin' }))) return
    await tambahSaktiBanyak(satkerId, data)
    toast.sukses(`${data.length} realisasi SAKTI ditambahkan.`)
  }

  return (
    <Card title="Data realisasi SAKTI" desc={edit ? 'Diisi dosen sebagai unit akuntansi' : 'Diterima dari unit akuntansi (dosen)'}
      actions={edit ? <Button size="sm" variant="secondary" onClick={salin}><CopyPlus size={14} /> Salin dari Buku Barang</Button> : null}>
      {edit && (
        <form className="mb-5 grid items-end gap-2 sm:grid-cols-[140px_1fr_1fr_140px_140px_auto]" onSubmit={async (e) => {
          e.preventDefault()
          await tambahSakti(satkerId, { ...f, akun: akunDariBelanja(f.akunBelanja) })
          setF({ ...kosong, tanggal: f.tanggal, akunBelanja: f.akunBelanja })
          toast.sukses('Realisasi SAKTI ditambahkan.')
        }}>
          <Field label="Tanggal SP2D"><Input type="date" required value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></Field>
          <Field label="Akun belanja"><Select value={f.akunBelanja} onChange={(e) => setF({ ...f, akunBelanja: e.target.value })} options={AKUN_BELANJA.map((a) => ({ value: a.kode, label: `${a.kode} ${a.uraian}` }))} /></Field>
          <Field label="Uraian"><Input required value={f.uraian} onChange={(e) => setF({ ...f, uraian: e.target.value })} /></Field>
          <Field label="Nilai (Rp)"><Input type="number" min="0" required value={f.nilai} onChange={(e) => setF({ ...f, nilai: e.target.value })} /></Field>
          <Field label="Nomor SP2D"><Input required value={f.nomorSP2D} onChange={(e) => setF({ ...f, nomorSP2D: e.target.value })} /></Field>
          <Button type="submit"><Plus size={15} /> Tambah</Button>
        </form>
      )}
      <Table head={['Tanggal', 'Nomor SP2D', 'Akun belanja', 'Uraian', { label: 'Nilai', right: true }, ...(edit ? [''] : [])]} empty={list.length ? null : 'Belum ada realisasi SAKTI pada periode ini.'}>
        {list.map((s) => (
          <tr key={s.id}>
            <Td className="whitespace-nowrap">{tanggalID(s.tanggal)}</Td>
            <Td className="font-mono text-xs">{s.nomorSP2D}</Td>
            <Td className="text-xs">{s.akunBelanja}<span className="block text-slate-500">{s.akun || akunDariBelanja(s.akunBelanja)}</span></Td>
            <Td>{s.uraian}</Td>
            <Td right>{rupiah(s.nilai)}</Td>
            {edit && <Td><Button size="sm" variant="ghost" onClick={() => hapusSakti(satkerId, s.id)} aria-label="Hapus"><Trash2 size={14} /></Button></Td>}
          </tr>
        ))}
      </Table>
      {!edit && !list.length && <div className="mt-3"><Alert tone="slate">Minta dosen mengisi data realisasi SAKTI untuk periode ini.</Alert></div>}
      <p className="mt-3 text-xs text-slate-400">Kode akun belanja ilustratif untuk latihan. Akun neraca yang dibandingkan: {AKUN_REKON.join(', ')}.</p>
    </Card>
  )
}
