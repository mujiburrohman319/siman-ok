import { useMemo, useState } from 'react'
import { ClipboardCheck, Package, PackagePlus, Plus } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { buatBarangPersediaan, catatMutasiPersediaan, isiPersediaanContoh } from '../lib/db.js'
import { JENIS_MUTASI, kartuPersediaan, lbkpPersediaan, nilaiBarang, nilaiPersediaan, selisihOpname } from '../lib/persediaan.js'
import { DOKUMEN_SUMBER, rupiah, tanggalID } from '../lib/bmn.js'
import { KODE_PERSEDIAAN, cariKodePersediaan } from '../data/persediaan.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, Kosong, Modal, PageHeader, Paging, Select, Stat, Table, Tabs, Td, TombolEkspor, usePaging } from '../components/ui.jsx'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'

const hariIni = () => new Date().toISOString().slice(0, 10)
const angka = (n) => Number(n || 0).toLocaleString('id-ID')

export function usePersediaan() {
  const { satkerId } = useSatker()
  const barang = useCollection(satkerId ? ['satker', satkerId, 'persediaan'] : null).data
  const mutasi = useCollection(satkerId ? ['satker', satkerId, 'mutasiPersediaan'] : null).data
  return { barang, mutasi }
}

export default function Persediaan() {
  const [tab, setTab] = useState('saldo')
  return (
    <>
      <PageHeader
        title="Persediaan"
        desc="Barang habis pakai (aset lancar). Nilai keluar dihitung FIFO; mutasi dibukukan kronologis dan tidak dapat diubah. Opname fisik membukukan selisih otomatis."
      />
      <Tabs items={[['saldo', 'Barang & saldo'], ['mutasi', 'Catat mutasi'], ['opname', 'Opname fisik'], ['lbkp', 'LBKP Persediaan']]} value={tab} onChange={setTab} />
      <PerluSatker>
        {tab === 'saldo' && <Saldo />}
        {tab === 'mutasi' && <FormMutasi />}
        {tab === 'opname' && <Opname />}
        {tab === 'lbkp' && <LBKPPersediaan />}
      </PerluSatker>
    </>
  )
}

function Saldo() {
  const { satkerId, satker } = useSatker()
  const { user } = useAuth()
  const toast = useToast()
  const { barang, mutasi } = usePersediaan()
  const [buka, setBuka] = useState(null)
  const [tambah, setTambah] = useState(false)
  const [proses, setProses] = useState(false)
  const urut = useMemo(() => [...barang].sort((a, b) => a.kode.localeCompare(b.kode) || a.nama.localeCompare(b.nama)), [barang])
  const paging = usePaging(urut, 20)
  const total = nilaiPersediaan(barang)
  const ekspor = () => ({
    judul: 'Daftar Saldo Persediaan', sheet: 'Saldo', subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, `Per ${tanggalID(new Date())}`],
    kolom: [{ label: 'Kode' }, { label: 'Nama barang' }, { label: 'Satuan' }, { label: 'Saldo', tipe: 'angka' }, { label: 'Nilai (FIFO)', tipe: 'uang' }],
    baris: urut.map((b) => [b.kode, b.nama, b.satuan, b.saldoQty, nilaiBarang(b)]),
    total: ['Jumlah', '', '', '', total],
  })

  async function contoh() {
    setProses(true)
    try { await isiPersediaanContoh(satkerId, user.uid); toast.sukses('Persediaan contoh (4 barang) telah dibukukan.') } catch (e) { toast.galat(e) } finally { setProses(false) }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Package} label="Jenis barang" value={barang.length} sub={`${mutasi.length} mutasi dibukukan`} />
        <Stat icon={Package} tone="blue" label="Nilai persediaan" value={rupiah(total)} sub="Masuk neraca sebagai aset lancar" />
        <Stat icon={Package} tone="amber" label="Barang habis" value={barang.filter((b) => !b.saldoQty).length} sub="Saldo nol" />
      </div>
      <Card title="Saldo per barang" actions={<><Button size="sm" variant="secondary" onClick={() => setTambah(true)}><Plus size={14} /> Barang</Button><TombolEkspor nama="Saldo persediaan" laporan={ekspor} /></>}>
        {!barang.length ? (
          <div className="space-y-3 text-center">
            <Kosong icon={PackagePlus}>Belum ada barang persediaan.</Kosong>
            <Button variant="secondary" onClick={contoh} disabled={proses}>{proses ? 'Memproses…' : 'Isi persediaan contoh'}</Button>
          </div>
        ) : (
          <>
            <Table head={['Kode', 'Nama barang', { label: 'Saldo', right: true }, { label: 'Nilai (FIFO)', right: true }, 'Mutasi terakhir', '']}>
              {paging.isi.map((b) => (
                <tr key={b.id}>
                  <Td className="font-mono text-xs">{b.kode}</Td>
                  <Td><span className="font-medium text-slate-800">{b.nama}</span><span className="block text-xs text-slate-500">{cariKodePersediaan(b.kode)?.uraian}</span></Td>
                  <Td right>{angka(b.saldoQty)} {b.satuan}</Td>
                  <Td right>{rupiah(nilaiBarang(b))}</Td>
                  <Td>{b.tglTerakhir ? tanggalID(b.tglTerakhir) : '—'}</Td>
                  <Td><Button size="sm" variant="ghost" onClick={() => setBuka(b)}>Kartu</Button></Td>
                </tr>
              ))}
            </Table>
            <Paging {...paging} />
          </>
        )}
      </Card>
      <Modal open={!!buka} onClose={() => setBuka(null)} wide title={buka ? `Kartu Persediaan — ${buka.nama}` : ''}>{buka && <Kartu b={buka} mutasi={mutasi} />}</Modal>
      <Modal open={tambah} onClose={() => setTambah(false)} title="Barang persediaan baru"><BarangBaru selesai={() => setTambah(false)} /></Modal>
    </div>
  )
}

function BarangBaru({ selesai }) {
  const { satkerId } = useSatker()
  const toast = useToast()
  const [f, setF] = useState({ kode: '', nama: '', satuan: '' })
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      await buatBarangPersediaan(satkerId, f)
      toast.sukses(`${f.nama} ditambahkan. Catat saldo awal atau pembelian di tab Catat mutasi.`)
      selesai()
    }}>
      <Field label="Kode persediaan" hint="Contoh kodefikasi; dosen dapat menggantinya">
        <Select required value={f.kode} onChange={(e) => { const k = cariKodePersediaan(e.target.value); setF({ ...f, kode: e.target.value, satuan: f.satuan || k?.satuan || '' }) }} placeholder="— pilih —" options={KODE_PERSEDIAAN.map((k) => ({ value: k.kode, label: `${k.kode} ${k.uraian}` }))} />
      </Field>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Nama barang"><Input required value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} placeholder="mis. Kertas HVS A4 70 gram" /></Field>
        <Field label="Satuan"><Input required value={f.satuan} onChange={(e) => setF({ ...f, satuan: e.target.value })} /></Field>
      </div>
      <Button type="submit">Simpan</Button>
    </form>
  )
}

function Kartu({ b, mutasi }) {
  const { satker } = useSatker()
  const rows = kartuPersediaan(mutasi.filter((m) => m.barangId === b.id))
  const ekspor = () => ({
    judul: `Kartu Persediaan — ${b.nama}`, sheet: 'Kartu', subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, `${b.kode} · satuan ${b.satuan}`],
    kolom: [{ label: 'Tanggal' }, { label: 'Uraian' }, { label: 'Dokumen' }, { label: 'Masuk', tipe: 'angka' }, { label: 'Keluar', tipe: 'angka' }, { label: 'Nilai', tipe: 'uang' }, { label: 'Saldo', tipe: 'angka' }, { label: 'Nilai saldo', tipe: 'uang' }],
    baris: rows.map((m) => [tanggalID(m.tanggal), m.namaJenis, m.dokumen?.nomor, m.arah === 'masuk' ? m.qty : '', m.arah === 'keluar' ? m.qty : '', m.nilai, m.saldoQty, m.saldoNilai]),
  })
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><TombolEkspor nama={`Kartu persediaan ${b.nama}`} laporan={ekspor} /></div>
      <Table head={['Tanggal', 'Uraian', 'Dokumen', { label: 'Masuk', right: true }, { label: 'Keluar', right: true }, { label: 'Nilai', right: true }, { label: 'Saldo', right: true }, { label: 'Nilai saldo', right: true }]} empty={rows.length ? null : 'Belum ada mutasi.'}>
        {rows.map((m) => (
          <tr key={m.id}>
            <Td className="whitespace-nowrap">{tanggalID(m.tanggal)}</Td>
            <Td>{m.namaJenis}{m.rincian?.length > 1 && <span className="block text-xs text-slate-500">FIFO: {m.rincian.map((r) => `${r.qty}×${rupiah(r.harga)}`).join(' + ')}</span>}</Td>
            <Td className="text-xs">{m.dokumen?.nomor}</Td>
            <Td right>{m.arah === 'masuk' ? angka(m.qty) : ''}</Td>
            <Td right className="text-rose-700">{m.arah === 'keluar' ? angka(m.qty) : ''}</Td>
            <Td right>{rupiah(m.nilai)}</Td>
            <Td right>{angka(m.saldoQty)}</Td>
            <Td right>{rupiah(m.saldoNilai)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

function FormMutasi() {
  const { satkerId } = useSatker()
  const { user } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const { barang } = usePersediaan()
  const awal = { barangId: '', jenis: 'pemakaian', tanggal: hariIni(), qty: '', hargaSatuan: '', dokumen: { jenis: 'Dokumen Lainnya', nomor: '' }, keterangan: '' }
  const [f, setF] = useState(awal)
  const [err, setErr] = useState('')
  const [proses, setProses] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const b = barang.find((x) => x.id === f.barangId)
  const masuk = JENIS_MUTASI[f.jenis].arah === 'masuk'

  async function simpan(e) {
    e.preventDefault()
    setErr('')
    if (!(await konfirmasi({
      judul: `Bukukan ${JENIS_MUTASI[f.jenis].nama}?`,
      pesan: <><p className="font-medium text-slate-800">{b?.nama}: {f.qty} {b?.satuan}{masuk && f.hargaSatuan ? ` × ${rupiah(f.hargaSatuan)}` : ''}</p><p className="mt-2">Mutasi persediaan tidak dapat diubah atau dihapus, dan mutasi berikutnya tidak boleh bertanggal lebih awal.</p></>,
      ya: 'Bukukan',
    }))) return
    setProses(true)
    try {
      await catatMutasiPersediaan({ satkerId, barangId: f.barangId, uid: user.uid, input: f })
      toast.sukses('Mutasi persediaan dibukukan.')
      setF({ ...awal, jenis: f.jenis, barangId: f.barangId })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setProses(false)
    }
  }

  return (
    <Card title="Catat mutasi persediaan" className="max-w-2xl">
      {!barang.length ? <Alert tone="slate">Tambahkan barang persediaan terlebih dahulu di tab Barang & saldo.</Alert> : (
        <form onSubmit={simpan} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Barang"><Select required value={f.barangId} onChange={(e) => set('barangId', e.target.value)} placeholder="— pilih —" options={barang.map((x) => ({ value: x.id, label: `${x.nama} (saldo ${angka(x.saldoQty)} ${x.satuan})` }))} /></Field>
            <Field label="Jenis mutasi">
              <Select value={f.jenis} onChange={(e) => set('jenis', e.target.value)} options={Object.entries(JENIS_MUTASI).filter(([k]) => !k.startsWith('selisih')).map(([value, v]) => ({ value, label: `${v.arah === 'masuk' ? '↑' : '↓'} ${v.nama}` }))} />
            </Field>
            <Field label="Tanggal" hint={b?.tglTerakhir ? `Tidak boleh sebelum ${tanggalID(b.tglTerakhir)}` : null}><Input type="date" required value={f.tanggal} min={b?.tglTerakhir || undefined} onChange={(e) => set('tanggal', e.target.value)} /></Field>
            <Field label={`Kuantitas${b ? ` (${b.satuan})` : ''}`}><Input type="number" min="1" step="1" required value={f.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
            {masuk && <Field label="Harga satuan (Rp)" hint={f.qty && f.hargaSatuan ? `Nilai ${rupiah(f.qty * f.hargaSatuan)}` : null}><Input type="number" min="0" required value={f.hargaSatuan} onChange={(e) => set('hargaSatuan', e.target.value)} /></Field>}
            {!masuk && b && <div className="self-end pb-2 text-xs text-slate-500">Nilai keluar dihitung FIFO dari {b.lapisan?.length || 0} lapisan harga.</div>}
            <Field label="Dokumen sumber"><Select value={f.dokumen.jenis} onChange={(e) => set('dokumen', { ...f.dokumen, jenis: e.target.value })} options={[...DOKUMEN_SUMBER, 'Bukti Permintaan Barang'].map((v) => ({ value: v, label: v }))} /></Field>
            <Field label="Nomor dokumen"><Input required value={f.dokumen.nomor} onChange={(e) => set('dokumen', { ...f.dokumen, nomor: e.target.value })} /></Field>
          </div>
          <Field label="Keterangan"><Input value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
          {err && <Alert tone="rose">{err}</Alert>}
          <Button type="submit" disabled={proses}>{proses ? 'Menyimpan…' : 'Bukukan mutasi'}</Button>
        </form>
      )}
    </Card>
  )
}

function Opname() {
  const { satkerId } = useSatker()
  const { user } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const { barang } = usePersediaan()
  const [fisik, setFisik] = useState({})
  const [tanggal, setTanggal] = useState(hariIni())
  const [nomorBA, setNomorBA] = useState('')
  const [proses, setProses] = useState(false)
  const urut = [...barang].sort((a, b) => a.kode.localeCompare(b.kode))
  const terisi = urut.filter((b) => fisik[b.id] !== undefined && fisik[b.id] !== '')

  async function bukukan() {
    if (!nomorBA) return toast.galat('Isi nomor Berita Acara Opname.')
    let sel
    try { sel = selisihOpname(urut, fisik, { tanggal, dokumen: { jenis: 'Berita Acara Inventarisasi', nomor: nomorBA } }) } catch (e) { return toast.galat(e) }
    if (!sel.length) return toast.info('Tidak ada selisih antara saldo buku dan hasil hitung fisik.')
    if (!(await konfirmasi({ judul: 'Bukukan hasil opname?', pesan: <>Akan dibukukan <b>{sel.length} mutasi selisih</b> (lebih/kurang) dengan dasar BA {nomorBA}.</>, ya: 'Bukukan selisih' }))) return
    setProses(true)
    try {
      for (const x of sel) await catatMutasiPersediaan({ satkerId, barangId: x.barangId, uid: user.uid, input: x.input, sumber: { opname: nomorBA } })
      toast.sukses(`${sel.length} selisih opname dibukukan.`)
      setFisik({})
    } catch (e) {
      toast.galat(e)
    } finally {
      setProses(false)
    }
  }

  return (
    <Card icon={ClipboardCheck} title="Opname fisik persediaan" desc="Isi hasil hitung fisik; selisih terhadap saldo buku dibukukan sebagai mutasi selisih lebih/kurang."
      actions={<><Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-40" aria-label="Tanggal opname" /><Input placeholder="Nomor BA opname" value={nomorBA} onChange={(e) => setNomorBA(e.target.value)} className="w-44" /><Button onClick={bukukan} disabled={proses || !terisi.length}>{proses ? 'Memproses…' : 'Bukukan selisih'}</Button></>}>
      <Table head={['Barang', { label: 'Saldo buku', right: true }, { label: 'Hasil hitung fisik', right: true }, { label: 'Selisih', right: true }]} empty={urut.length ? null : 'Belum ada barang persediaan.'}>
        {urut.map((b) => {
          const v = fisik[b.id]
          const d = v === undefined || v === '' ? null : Number(v) - (b.saldoQty || 0)
          return (
            <tr key={b.id}>
              <Td><span className="font-medium text-slate-800">{b.nama}</span><span className="block font-mono text-xs text-slate-500">{b.kode}</span></Td>
              <Td right>{angka(b.saldoQty)} {b.satuan}</Td>
              <Td right><Input type="number" min="0" step="1" value={v ?? ''} onChange={(e) => setFisik({ ...fisik, [b.id]: e.target.value })} className="w-24 text-right" aria-label={`Fisik ${b.nama}`} /></Td>
              <Td right>{d === null ? '—' : d === 0 ? <Badge tone="teal">Sesuai</Badge> : <Badge tone={d > 0 ? 'blue' : 'rose'}>{d > 0 ? '+' : ''}{angka(d)}</Badge>}</Td>
            </tr>
          )
        })}
      </Table>
    </Card>
  )
}

function opsiPeriode() {
  const y = new Date().getFullYear()
  const out = []
  for (let t = y; t >= y - 2; t--) out.push([`${t}-S2`, `Semester II ${t}`, `${t}-07-01`, `${t}-12-31`], [`${t}-S1`, `Semester I ${t}`, `${t}-01-01`, `${t}-06-30`], [`${t}-TH`, `Tahunan ${t}`, `${t}-01-01`, `${t}-12-31`])
  return out
}

function LBKPPersediaan() {
  const { satker } = useSatker()
  const { barang, mutasi } = usePersediaan()
  const periode = opsiPeriode()
  const [p, setP] = useState(`${new Date().getFullYear()}-S1`)
  const [, label, mulai, akhir] = periode.find((x) => x[0] === p)
  const rows = useMemo(() => lbkpPersediaan(barang, mutasi, mulai, akhir).filter((r) => r.awalQty || r.masukQty || r.keluarQty), [barang, mutasi, mulai, akhir])
  const jumlah = (k) => rows.reduce((s, r) => s + r[k], 0)
  const ekspor = () => ({
    judul: 'Laporan Barang Kuasa Pengguna — Persediaan', sheet: 'LBKP Persediaan', subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, label],
    kolom: [{ label: 'Kode' }, { label: 'Nama barang' }, { label: 'Satuan' }, { label: 'Saldo awal (qty)', tipe: 'angka' }, { label: 'Saldo awal', tipe: 'uang' }, { label: 'Masuk (qty)', tipe: 'angka' }, { label: 'Masuk', tipe: 'uang' }, { label: 'Keluar (qty)', tipe: 'angka' }, { label: 'Keluar', tipe: 'uang' }, { label: 'Saldo akhir (qty)', tipe: 'angka' }, { label: 'Saldo akhir', tipe: 'uang' }],
    baris: rows.map((r) => [r.kode, r.nama, r.satuan, r.awalQty, r.awal, r.masukQty, r.masuk, r.keluarQty, r.keluar, r.akhirQty, r.akhir]),
    total: ['Jumlah', '', '', '', jumlah('awal'), '', jumlah('masuk'), '', jumlah('keluar'), '', jumlah('akhir')],
  })
  return (
    <Card actions={<><Select value={p} onChange={(e) => setP(e.target.value)} options={periode.map(([value, l]) => ({ value, label: l }))} className="w-52" /><TombolEkspor nama={`LBKP Persediaan ${label}`} laporan={ekspor} tandaTangan={['Kuasa Pengguna Barang']} /></>}>
      <div className="mb-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">Laporan Barang Kuasa Pengguna — Persediaan</p>
        <p className="text-sm text-slate-600">{satker?.kode} · {satker?.nama}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <Table head={['Barang', { label: 'Saldo awal', right: true }, { label: 'Masuk', right: true }, { label: 'Keluar', right: true }, { label: 'Saldo akhir', right: true }]} empty={rows.length ? null : 'Tidak ada mutasi persediaan pada periode ini.'}
        footer={rows.length ? <tr><Td>Jumlah</Td><Td right>{rupiah(jumlah('awal'))}</Td><Td right>{rupiah(jumlah('masuk'))}</Td><Td right>{rupiah(jumlah('keluar'))}</Td><Td right>{rupiah(jumlah('akhir'))}</Td></tr> : null}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td><span className="font-medium text-slate-800">{r.nama}</span><span className="block font-mono text-xs text-slate-500">{r.kode}</span></Td>
            {[['awalQty', 'awal'], ['masukQty', 'masuk'], ['keluarQty', 'keluar'], ['akhirQty', 'akhir']].map(([q, v]) => (
              <Td key={v} right>{rupiah(r[v])}<span className="block text-xs text-slate-500">{angka(r[q])} {r.satuan}</span></Td>
            ))}
          </tr>
        ))}
      </Table>
    </Card>
  )
}
