import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { ajukanUsulan } from '../lib/db.js'
import { JENIS_USULAN, hitungPenyusutan, rupiah, tarifSewaSederhana, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td, Textarea, inputCls } from '../components/ui.jsx'
import { labelAset } from './Aset.jsx'

const PEMANFAATAN = ['sewa', 'pinjam_pakai', 'ksp', 'bgs_bsg']

export const StatusUsulan = ({ s }) => {
  const m = { diajukan: ['blue', 'Menunggu keputusan'], disetujui: ['teal', 'Disetujui'], ditolak: ['rose', 'Ditolak'] }[s] || ['slate', s]
  return <Badge tone={m[0]}>{m[1]}</Badge>
}

export default function Usulan() {
  return (
    <>
      <PageHeader
        title="Usulan Pengelolaan BMN"
        desc="Usulan penggunaan, pemanfaatan, pemindahtanganan, dan penghapusan kepada Pengelola Barang. Persetujuan otomatis membukukan transaksi terkait."
      />
      <PerluSatker>
        <div className="grid gap-5 xl:grid-cols-5">
          <FormUsulan />
          <DaftarUsulan />
        </div>
      </PerluSatker>
    </>
  )
}

function FormUsulan() {
  const { user, isStaff } = useAuth()
  const { satkerId, aset } = useSatker()
  const kosong = { jenis: 'penghapusan', asetIds: [], alasan: '', mitra: '', durasiBulan: '', nilaiSewa: '', dokumenPendukung: '' }
  const [f, setF] = useState(kosong)
  const [pesan, setPesan] = useState(null)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const grupPenghapusan = ['Pemindahtanganan', 'Penghapusan'].includes(JENIS_USULAN[f.jenis].grup)
  const pilihan = aset.filter((a) => (grupPenghapusan ? ['aktif', 'rusak_berat', 'hilang', 'dihentikan'] : ['aktif']).includes(a.status))
  const toggle = (id) => set('asetIds', f.asetIds.includes(id) ? f.asetIds.filter((x) => x !== id) : [...f.asetIds, id])
  const terpilih = aset.filter((a) => f.asetIds.includes(a.id))
  const nilaiBuku = terpilih.reduce((s, a) => s + hitungPenyusutan(a, new Date()).nilaiBuku, 0)

  async function kirim(e) {
    e.preventDefault()
    setPesan(null)
    if (!f.asetIds.length) return setPesan({ tone: 'rose', teks: 'Pilih minimal satu aset.' })
    try {
      await ajukanUsulan(satkerId, { ...f, namaJenis: JENIS_USULAN[f.jenis].nama, ringkasAset: terpilih.map(labelAset), nilaiBuku }, user.uid)
      setF(kosong)
      setPesan({ tone: 'teal', teks: 'Usulan terkirim ke Pengelola Barang.' })
    } catch (err) {
      setPesan({ tone: 'rose', teks: err.message })
    }
  }

  if (isStaff) return <Card title="Ajukan usulan" className="xl:col-span-2"><p className="text-sm text-slate-500">Usulan diajukan oleh mahasiswa (KPB). Keputusan diberikan di menu Penelaahan &amp; Persetujuan.</p></Card>

  return (
    <Card title="Ajukan usulan" className="xl:col-span-2">
      <form onSubmit={kirim} className="space-y-4">
        <Field label="Jenis usulan">
          <select value={f.jenis} onChange={(e) => setF({ ...kosong, jenis: e.target.value })} className={`${inputCls} w-full cursor-pointer`}>
            {['Penggunaan', 'Pemanfaatan', 'Pemindahtanganan', 'Penghapusan'].map((g) => (
              <optgroup key={g} label={g}>
                {Object.entries(JENIS_USULAN).filter(([, v]) => v.grup === g).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Aset yang diusulkan</p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {pilihan.length ? pilihan.map((a) => (
              <label key={a.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={f.asetIds.includes(a.id)} onChange={() => toggle(a.id)} />
                <span>{labelAset(a)} <span className="text-xs text-slate-500">· {a.kondisi} · {a.status}</span></span>
              </label>
            )) : <p className="text-sm text-slate-500">Tidak ada aset yang dapat diusulkan.</p>}
          </div>
          {terpilih.length > 0 && <p className="mt-1 text-xs text-slate-500">{terpilih.length} aset · nilai buku {rupiah(nilaiBuku)}</p>}
        </div>
        {PEMANFAATAN.includes(f.jenis) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mitra / pihak lain"><Input required value={f.mitra} onChange={(e) => set('mitra', e.target.value)} /></Field>
            <Field label="Jangka waktu (bulan)"><Input type="number" min="1" required value={f.durasiBulan} onChange={(e) => set('durasiBulan', e.target.value)} /></Field>
            {f.jenis === 'sewa' && (
              <Field label="Usulan nilai sewa (Rp)" hint={f.durasiBulan ? `Pembanding sederhana: ${rupiah(tarifSewaSederhana(nilaiBuku, f.durasiBulan))}` : 'Isi jangka waktu untuk melihat pembanding'} className="col-span-2">
                <Input type="number" min="0" required value={f.nilaiSewa} onChange={(e) => set('nilaiSewa', e.target.value)} />
              </Field>
            )}
          </div>
        )}
        {['alih_status', 'hibah', 'tukar_menukar', 'penjualan', 'pmpp'].includes(f.jenis) && (
          <Field label="Pihak penerima / pembeli"><Input value={f.mitra} onChange={(e) => set('mitra', e.target.value)} /></Field>
        )}
        <Field label="Alasan / pertimbangan"><Textarea required value={f.alasan} onChange={(e) => set('alasan', e.target.value)} /></Field>
        <Field label="Dokumen pendukung" hint="mis. Berita Acara penelitian kondisi, foto, surat permohonan mitra"><Input value={f.dokumenPendukung} onChange={(e) => set('dokumenPendukung', e.target.value)} /></Field>
        {pesan && <Alert tone={pesan.tone}>{pesan.teks}</Alert>}
        <Button type="submit">Kirim usulan</Button>
      </form>
    </Card>
  )
}

function DaftarUsulan() {
  const { satkerId } = useSatker()
  const { data } = useCollection(['satker', satkerId, 'usulan'], [orderBy('createdAt', 'desc')])
  return (
    <Card title="Riwayat usulan" className="xl:col-span-3">
      <Table head={['Diajukan', 'Jenis', 'Aset', 'Status', 'Nomor SK / catatan']} empty={data.length ? null : 'Belum ada usulan.'}>
        {data.map((u) => (
          <tr key={u.id}>
            <Td className="whitespace-nowrap">{u.createdAt ? tanggalID(u.createdAt.toDate()) : '…'}</Td>
            <Td>{u.namaJenis}{u.mitra && <span className="block text-xs text-slate-500">{u.mitra}</span>}</Td>
            <Td className="text-xs">{(u.ringkasAset || []).map((r) => <div key={r}>{r}</div>)}</Td>
            <Td><StatusUsulan s={u.status} /></Td>
            <Td className="text-xs">{u.nomorSK}{u.catatanPengelola && <span className="block text-slate-500">{u.catatanPengelola}</span>}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
