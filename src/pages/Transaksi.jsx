import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { catatTransaksi } from '../lib/db.js'
import { KODE_BARANG, cariKode } from '../data/kodeBarang.js'
import { KIB } from '../data/kib.js'
import { DOKUMEN_SUMBER, JENIS_TRANSAKSI, KONDISI, isIntrakomptabel, nupBerikutnya, rupiah, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td } from '../components/ui.jsx'
import { labelAset } from './Aset.jsx'

const hariIni = () => new Date().toISOString().slice(0, 10)
const grupJenis = ['tambah', 'ubah', 'kurang'].map((k) => ({
  k,
  label: { tambah: 'Perolehan (aset baru)', ubah: 'Perubahan', kurang: 'Penghapusan / pengurangan' }[k],
  list: Object.entries(JENIS_TRANSAKSI).filter(([, v]) => v.kelompok === k),
}))

export default function Transaksi() {
  return (
    <>
      <PageHeader
        title="Transaksi BMN"
        desc="Pembukuan sesuai jenis transaksi PMK 181/2016. Transaksi tidak dapat diubah atau dihapus; kesalahan dikoreksi dengan transaksi koreksi."
      />
      <PerluSatker>
        <div className="grid gap-5 xl:grid-cols-5">
          <FormTransaksi />
          <BukuBarang />
        </div>
      </PerluSatker>
    </>
  )
}

function FormTransaksi() {
  const { user, ref } = useAuth()
  const { satkerId, aset } = useSatker()
  const [params] = useSearchParams()
  const awal = {
    jenis: params.get('aset') ? 'koreksi_kondisi' : 'pembelian',
    asetId: params.get('aset') || '',
    tanggal: hariIni(),
    kodeBarang: '',
    nilai: '',
    tglPerolehan: '',
    merk: '',
    lokasiRuang: '',
    kondisi: 'B',
    asalPerolehan: 'APBN',
    bersejarah: false,
    kondisiBaru: '',
    kib: {},
    dokumen: { jenis: 'BAST', nomor: '', tanggal: hariIni() },
    keterangan: '',
  }
  const [f, setF] = useState(awal)
  const [pesan, setPesan] = useState(null)
  const [proses, setProses] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const def = JENIS_TRANSAKSI[f.jenis]
  const kode = cariKode(f.kodeBarang)
  const kib = kode?.kib && KIB[kode.kib]
  const asetTerpilih = aset.find((a) => a.id === f.asetId)
  const pilihanAset = aset
    .filter((a) => a.status !== 'dihapus')
    .sort((a, b) => a.kodeBarang.localeCompare(b.kodeBarang) || a.nup - b.nup)
    .map((a) => ({ value: a.id, label: `${labelAset(a)} — ${a.status}` }))

  const butuhNilai = def.kelompok === 'tambah' || ['pengembangan_nilai', 'koreksi_nilai'].includes(f.jenis)

  async function simpan(e) {
    e.preventDefault()
    setPesan(null)
    setProses(true)
    try {
      const input = { ...f, nilai: f.nilai === '' ? undefined : Number(f.nilai) }
      if (def.kelompok === 'tambah') input.nup = nupBerikutnya(aset, f.kodeBarang)
      await catatTransaksi({ satkerId, asetId: def.kelompok === 'tambah' ? null : f.asetId, input, uid: user.uid, ref })
      setPesan({ tone: 'teal', teks: `${def.nama} berhasil dibukukan.` })
      setF({ ...awal, jenis: f.jenis, dokumen: { ...awal.dokumen, jenis: f.dokumen.jenis } })
    } catch (err) {
      setPesan({ tone: 'rose', teks: err.message })
    } finally {
      setProses(false)
    }
  }

  return (
    <Card title="Catat transaksi" className="xl:col-span-2">
      <form onSubmit={simpan} className="space-y-4">
        <Field label="Jenis transaksi">
          <select value={f.jenis} onChange={(e) => set('jenis', e.target.value)} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
            {grupJenis.map((g) => (
              <optgroup key={g.k} label={g.label}>
                {g.list.map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        {def.kelompok === 'tambah' ? (
          <>
            <Field label="Kode barang" hint={kode ? `Masa manfaat ${kode.masaManfaat || '—'} th · NUP berikutnya ${nupBerikutnya(aset, f.kodeBarang)}` : 'Contoh kodefikasi; dosen dapat mengganti dengan tabel resmi'}>
              <Select required value={f.kodeBarang} onChange={(e) => set('kodeBarang', e.target.value)} placeholder="— pilih —" options={KODE_BARANG.map((k) => ({ value: k.kode, label: `${k.kode} ${k.uraian}` }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nilai perolehan (Rp)" hint={f.kodeBarang && f.nilai !== '' ? (isIntrakomptabel(f.kodeBarang, Number(f.nilai), ref) ? 'Intrakomptabel' : 'Di bawah batas kapitalisasi → Ekstrakomptabel') : null}>
                <Input type="number" min="0" required={!f.bersejarah} disabled={f.bersejarah} value={f.nilai} onChange={(e) => set('nilai', e.target.value)} />
              </Field>
              <Field label="Tanggal perolehan"><Input type="date" value={f.tglPerolehan} onChange={(e) => set('tglPerolehan', e.target.value)} placeholder="sama dengan tanggal transaksi" /></Field>
              <Field label="Merk / tipe"><Input value={f.merk} onChange={(e) => set('merk', e.target.value)} /></Field>
              <Field label="Lokasi ruangan"><Input value={f.lokasiRuang} onChange={(e) => set('lokasiRuang', e.target.value)} /></Field>
              <Field label="Kondisi"><Select value={f.kondisi} onChange={(e) => set('kondisi', e.target.value)} options={Object.entries(KONDISI).map(([value, label]) => ({ value, label }))} /></Field>
              <Field label="Asal perolehan"><Select value={f.asalPerolehan} onChange={(e) => set('asalPerolehan', e.target.value)} options={['APBN', 'Hibah', 'Perjanjian/Kontrak', 'Ketentuan Undang-Undang', 'Putusan Pengadilan'].map((v) => ({ value: v, label: v }))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.bersejarah} onChange={(e) => set('bersejarah', e.target.checked)} /> Aset bersejarah (dicatat tanpa nilai)
            </label>
            {kib && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{kib.nama}</p>
                <div className="grid grid-cols-2 gap-3">
                  {kib.field.map((fl) => (
                    <Field key={fl.k} label={fl.l}><Input type={fl.t || 'text'} value={f.kib[fl.k] ?? ''} onChange={(e) => set('kib', { ...f.kib, [fl.k]: e.target.value })} /></Field>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Aset">
              <Select required value={f.asetId} onChange={(e) => set('asetId', e.target.value)} placeholder="— pilih aset —" options={pilihanAset} />
            </Field>
            {asetTerpilih && (
              <p className="text-xs text-slate-500">Nilai tercatat {rupiah(asetTerpilih.nilai)} · Kondisi {KONDISI[asetTerpilih.kondisi]} · {asetTerpilih.intrakomptabel ? 'Intrakomptabel' : 'Ekstrakomptabel'}</p>
            )}
            {butuhNilai && (
              <Field label={f.jenis === 'koreksi_nilai' ? 'Nilai setelah koreksi (Rp)' : 'Nilai pengembangan (Rp)'}>
                <Input type="number" min="0" required value={f.nilai} onChange={(e) => set('nilai', e.target.value)} />
              </Field>
            )}
            {f.jenis === 'koreksi_kondisi' && (
              <Field label="Kondisi baru"><Select required value={f.kondisiBaru} onChange={(e) => set('kondisiBaru', e.target.value)} placeholder="— pilih —" options={Object.entries(KONDISI).map(([value, label]) => ({ value, label }))} /></Field>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal transaksi"><Input type="date" required value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
          <Field label="Dokumen sumber"><Select value={f.dokumen.jenis} onChange={(e) => set('dokumen', { ...f.dokumen, jenis: e.target.value })} options={DOKUMEN_SUMBER.map((v) => ({ value: v, label: v }))} /></Field>
          <Field label="Nomor dokumen"><Input required value={f.dokumen.nomor} onChange={(e) => set('dokumen', { ...f.dokumen, nomor: e.target.value })} /></Field>
          <Field label="Tanggal dokumen"><Input type="date" value={f.dokumen.tanggal} onChange={(e) => set('dokumen', { ...f.dokumen, tanggal: e.target.value })} /></Field>
        </div>
        <Field label="Keterangan"><Input value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
        {pesan && <Alert tone={pesan.tone}>{pesan.teks}</Alert>}
        <Button type="submit" disabled={proses}>{proses ? 'Menyimpan…' : 'Bukukan transaksi'}</Button>
      </form>
    </Card>
  )
}

function BukuBarang() {
  const { transaksi } = useSatker()
  const [filter, setFilter] = useState('')
  const list = useMemo(() => [...transaksi].reverse().filter((t) => !filter || t.kelompok === filter), [transaksi, filter])
  const tone = { tambah: 'teal', ubah: 'blue', kurang: 'rose' }
  return (
    <Card
      title="Buku Barang (semua transaksi)"
      className="xl:col-span-3"
      actions={<Select value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Semua kelompok" options={[{ value: 'tambah', label: 'Perolehan' }, { value: 'ubah', label: 'Perubahan' }, { value: 'kurang', label: 'Penghapusan' }]} className="w-44" />}
    >
      <Table head={['Tanggal', 'Transaksi', 'Barang', 'Dokumen', { label: 'Efek neraca', right: true }]} empty={list.length ? null : 'Belum ada transaksi.'}>
        {list.map((t) => {
          const efek = (t.efek || []).reduce((s, e) => s + e.nilai, 0)
          return (
            <tr key={t.id}>
              <Td className="whitespace-nowrap">{tanggalID(t.tanggal)}</Td>
              <Td><Badge tone={tone[t.kelompok]}>{t.namaJenis}</Badge></Td>
              <Td><span className="font-mono text-xs">{t.kodeBarang}</span> NUP {t.nup}<span className="block text-xs text-slate-500">{t.namaBarang}</span></Td>
              <Td className="text-xs">{t.dokumen?.jenis}<span className="block text-slate-500">{t.dokumen?.nomor}</span></Td>
              <Td right className={efek < 0 ? 'text-rose-700' : ''}>{(t.efek || []).length > 1 ? 'reklasifikasi' : rupiah(efek)}</Td>
            </tr>
          )
        })}
      </Table>
    </Card>
  )
}
