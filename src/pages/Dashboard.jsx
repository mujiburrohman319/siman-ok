import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Landmark, PieChart, Scale, TrendingDown, Wallet } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { useWasdal } from './Wasdal.jsx'
import { TINGKAT, skorKepatuhan } from '../lib/wasdal.js'
import { AKUN, akunAset, hitungPenyusutan, kelompokNeraca, rupiah } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Badge, Card, PageHeader, Stat, Table, Td } from '../components/ui.jsx'

export default function Dashboard() {
  const { profil } = useAuth()
  return (
    <>
      <PageHeader title={`Selamat datang, ${profil?.nama?.split(' ')[0] || ''}`} desc="Ringkasan BMN satker simulasi Anda per hari ini." />
      <PerluSatker><Isi /></PerluSatker>
    </>
  )
}

function Isi() {
  const { satkerId, aset, transaksi } = useSatker()
  const rkbmn = useCollection(['satker', satkerId, 'rkbmn'])
  const usulan = useCollection(['satker', satkerId, 'usulan'])
  const hariIni = new Date()

  const diNeraca = aset.filter((a) => a.intrakomptabel && ['aktif', 'dihentikan'].includes(a.status))
  const nilai = diNeraca.reduce((s, a) => s + a.nilai, 0)
  const susut = diNeraca.reduce((s, a) => s + hitungPenyusutan(a, hariIni).akumulasi, 0)

  const perAkun = AKUN.map((akun) => {
    const list = diNeraca.filter((a) => akunAset(a) === akun)
    return {
      akun,
      jumlah: list.length,
      nilai: list.reduce((s, a) => s + a.nilai, 0),
      susut: list.reduce((s, a) => s + hitungPenyusutan(a, hariIni).akumulasi, 0),
    }
  }).filter((r) => r.jumlah)

  const tugas = useWasdal()
  const menunggu = usulan.data.filter((u) => u.status === 'diajukan').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Stat icon={Landmark} label="NUP tercatat" value={aset.filter((a) => a.status !== 'dihapus').length} sub={`${transaksi.length} transaksi dibukukan`} />
        <Stat icon={Wallet} tone="blue" label="Nilai perolehan (neraca)" value={rupiah(nilai)} sub="Aset intrakomptabel" />
        <Stat icon={TrendingDown} tone="amber" label="Akumulasi penyusutan" value={rupiah(susut)} sub="Per akhir semester terakhir" />
        <Stat icon={Scale} tone="violet" label="Nilai buku" value={rupiah(nilai - susut)} sub={`${menunggu} usulan menunggu keputusan`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card icon={PieChart} title="Komposisi BMN per akun" desc="Aset intrakomptabel yang tersaji di neraca" className="lg:col-span-2">
          <Table head={['Akun', 'Kelompok', { label: 'NUP', right: true }, { label: 'Nilai perolehan', right: true }, { label: 'Nilai buku', right: true }]} empty={perAkun.length ? null : 'Belum ada aset. Catat saldo awal di menu Transaksi BMN.'}>
            {perAkun.map((r) => (
              <tr key={r.akun}>
                <Td>{r.akun}</Td>
                <Td><Badge tone={kelompokNeraca(r.akun) === 'Aset Tetap' ? 'teal' : 'blue'}>{kelompokNeraca(r.akun)}</Badge></Td>
                <Td right>{r.jumlah}</Td>
                <Td right>{rupiah(r.nilai)}</Td>
                <Td right>{rupiah(r.nilai - r.susut)}</Td>
              </tr>
            ))}
          </Table>
          
        </Card>

        <Card icon={AlertTriangle} title="Perlu ditindaklanjuti" desc={`Skor kepatuhan ${skorKepatuhan(tugas)}/100 · ${tugas.length} temuan`} actions={tugas.length > 4 ? <Link to="/wasdal" className="text-xs font-medium text-brand-700 hover:underline">Lihat semua</Link> : null}>
          {tugas.length ? (
            <ul className="space-y-2 text-sm">
              {tugas.slice(0, 4).map((t, i) => (
                <li key={i}>
                  <Link to={t.tautan} className="group flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-amber-950 transition hover:border-amber-300 hover:bg-amber-50">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${{ tinggi: 'bg-rose-500', sedang: 'bg-amber-500', rendah: 'bg-sky-500' }[t.tingkat]}`} title={`Risiko ${TINGKAT[t.tingkat]}`} />
                    <span className="flex-1 leading-snug">{t.judul}{t.asetIds.length ? ` (${t.asetIds.length} NUP)` : ''}</span>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-amber-600 transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800"><CheckCircle2 size={16} /> Tidak ada temuan. Data satker tertib.</p>
          )}
          <div className="mt-5 border-t border-slate-100 pt-4 text-sm">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><ClipboardList size={14} /> Status RKBMN</p>
            {rkbmn.data.length ? (
              <ul className="divide-y divide-slate-100">
                {rkbmn.data.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">TA {r.tahun} · <span className="capitalize">{r.jenis}</span></span>
                    <StatusRKBMN status={r.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-500">Belum disusun.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function StatusRKBMN({ status }) {
  const m = {
    draft: ['slate', 'Draf'],
    reviu_apip: ['amber', 'Reviu APIP'],
    diajukan: ['blue', 'Ditelaah Pengelola'],
    dikembalikan: ['rose', 'Dikembalikan'],
    disetujui: ['teal', 'Hasil Penelaahan terbit'],
  }[status] || ['slate', status]
  return <Badge tone={m[0]}>{m[1]}</Badge>
}
