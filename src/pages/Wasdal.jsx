import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { TINGKAT, skorKepatuhan, temuanWasdal } from '../lib/wasdal.js'
import { tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Badge, Button, Card, PageHeader, TombolEkspor } from '../components/ui.jsx'
import { labelAset } from './Aset.jsx'

export const TONE_TINGKAT = { tinggi: 'rose', sedang: 'amber', rendah: 'blue' }

/** Data satker yang dibutuhkan wasdal, dipakai juga oleh Dashboard. */
export function useWasdal() {
  const { satkerId, aset, transaksi } = useSatker()
  const { ref } = useAuth()
  const usulan = useCollection(['satker', satkerId, 'usulan']).data
  const inventarisasi = useCollection(['satker', satkerId, 'inventarisasi']).data
  const pnbp = useCollection(['satker', satkerId, 'pnbp']).data
  return useMemo(() => temuanWasdal({ aset, transaksi, usulan, inventarisasi, pnbp, ref }), [aset, transaksi, usulan, inventarisasi, pnbp, ref])
}

export default function Wasdal() {
  return (
    <>
      <PageHeader
        title="Pengawasan & Pengendalian"
        desc="Pemantauan otomatis atas pembukuan, kelengkapan dokumen, penggunaan, dan penghapusan BMN satker. Temuan diperbarui setiap kali data berubah."
      />
      <PerluSatker><Isi /></PerluSatker>
    </>
  )
}

function Isi() {
  const { aset, satker } = useSatker()
  const temuan = useWasdal()
  const skor = skorKepatuhan(temuan)
  const hitung = (t) => temuan.filter((x) => x.tingkat === t).length
  const warnaSkor = skor >= 85 ? 'text-brand-700' : skor >= 60 ? 'text-amber-600' : 'text-rose-600'
  const ekspor = () => ({
    judul: 'Laporan Hasil Pengawasan dan Pengendalian BMN', sheet: 'Wasdal',
    subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, `Per ${tanggalID(new Date())} · Skor kepatuhan ${skor}`],
    kolom: [{ label: 'No', tipe: 'angka' }, { label: 'Tingkat' }, { label: 'Temuan' }, { label: 'Uraian' }, { label: 'Rekomendasi' }, { label: 'Dasar' }, { label: 'NUP terdampak', tipe: 'angka' }],
    baris: temuan.map((t, i) => [i + 1, TINGKAT[t.tingkat], t.judul, t.uraian, t.rekomendasi, t.dasar, t.asetIds.length]),
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.06]">
          <p className="text-[13px] font-medium text-slate-500">Skor kepatuhan</p>
          <p className={`mt-1 text-4xl font-semibold tracking-tight tabular-nums ${warnaSkor}`}>{skor}<span className="text-lg text-slate-400">/100</span></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${skor >= 85 ? 'bg-brand-500' : skor >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${skor}%` }} /></div>
        </div>
        {['tinggi', 'sedang', 'rendah'].map((t) => (
          <div key={t} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.06]">
            <p className="text-[13px] font-medium text-slate-500">Temuan risiko {TINGKAT[t].toLowerCase()}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{hitung(t)}</p>
            <div className="mt-2"><Badge tone={TONE_TINGKAT[t]}>{TINGKAT[t]}</Badge></div>
          </div>
        ))}
      </div>

      <Card icon={ShieldAlert} title="Daftar temuan" desc="Urut dari risiko tertinggi" actions={<TombolEkspor nama="Hasil Wasdal BMN" laporan={ekspor} tandaTangan={['Kuasa Pengguna Barang']} />}>
        {temuan.length ? (
          <ul className="space-y-3">
            {temuan.map((t) => <Temuan key={t.kode} t={t} aset={aset} />)}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><ShieldCheck size={24} /></span>
            <p className="font-medium text-slate-800">Tidak ada temuan</p>
            <p className="max-w-sm text-sm text-slate-500">Pembukuan, dokumen, dan status BMN satker sudah tertib.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Temuan({ t, aset }) {
  const [buka, setBuka] = useState(false)
  const terdampak = aset.filter((a) => t.asetIds.includes(a.id))
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Badge tone={TONE_TINGKAT[t.tingkat]}>{TINGKAT[t.tingkat]}</Badge>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{t.judul}</p>
          <p className="mt-1 text-sm text-slate-600">{t.uraian}</p>
          <p className="mt-2 flex gap-1.5 text-sm text-brand-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {t.rekomendasi}</p>
          <p className="mt-1.5 text-xs text-slate-400">Dasar: {t.dasar}</p>
        </div>
        <Link to={t.tautan}><Button size="sm" variant="secondary">Tindak lanjuti <ArrowRight size={14} /></Button></Link>
      </div>
      {terdampak.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button onClick={() => setBuka(!buka)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <ChevronDown size={14} className={`transition ${buka ? 'rotate-180' : ''}`} /> {terdampak.length} NUP terdampak
          </button>
          {buka && <ul className="mt-2 space-y-1 text-xs text-slate-600">{terdampak.map((a) => <li key={a.id} className="font-mono">{labelAset(a)}</li>)}</ul>}
        </div>
      )}
    </li>
  )
}
