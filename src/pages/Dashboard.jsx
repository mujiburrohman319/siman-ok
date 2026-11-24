import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
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

  const tugas = []
  const rbAktif = aset.filter((a) => a.status === 'aktif' && a.kondisi === 'RB')
  if (rbAktif.length) tugas.push({ teks: `${rbAktif.length} aset berkondisi rusak berat belum direklasifikasi ke Daftar Barang Rusak Berat`, to: '/transaksi' })
  const tanpaLokasi = aset.filter((a) => a.status === 'aktif' && !a.lokasiRuang)
  if (tanpaLokasi.length) tugas.push({ teks: `${tanpaLokasi.length} aset belum memiliki lokasi ruangan (DBR tidak lengkap)`, to: '/aset' })
  const kembali = rkbmn.data.filter((r) => r.status === 'dikembalikan')
  if (kembali.length) tugas.push({ teks: `${kembali.length} RKBMN dikembalikan Pengelola Barang untuk direvisi`, to: '/rkbmn' })
  const idle = aset.filter((a) => a.status === 'aktif' && a.statusPenggunaan === 'idle')
  if (idle.length) tugas.push({ teks: `${idle.length} BMN idle — pertimbangkan usulan alih status atau penyerahan ke Pengelola`, to: '/usulan' })
  const menunggu = usulan.data.filter((u) => u.status === 'diajukan').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="NUP tercatat" value={aset.filter((a) => a.status !== 'dihapus').length} sub={`${transaksi.length} transaksi dibukukan`} />
        <Stat label="Nilai perolehan (neraca)" value={rupiah(nilai)} sub="Aset intrakomptabel" />
        <Stat label="Akumulasi penyusutan" value={rupiah(susut)} sub="Per akhir semester terakhir" />
        <Stat label="Nilai buku" value={rupiah(nilai - susut)} sub={`${menunggu} usulan menunggu keputusan`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Komposisi BMN per akun" className="lg:col-span-2">
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
          <p className="mt-3 text-xs text-slate-500">Persediaan (aset lancar) belum dicakup versi ini; lihat backlog di CLAUDE.md.</p>
        </Card>

        <Card title="Perlu ditindaklanjuti">
          {tugas.length ? (
            <ul className="space-y-2 text-sm">
              {tugas.map((t, i) => (
                <li key={i}>
                  <Link to={t.to} className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100">{t.teks}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Tidak ada temuan. Data satker tertib.</p>
          )}
          <div className="mt-4 space-y-1 text-sm">
            <p className="font-medium text-slate-700">Status RKBMN</p>
            {rkbmn.data.length ? rkbmn.data.map((r) => (
              <p key={r.id} className="flex justify-between"><span>{r.tahun} · {r.jenis}</span><StatusRKBMN status={r.status} /></p>
            )) : <p className="text-slate-500">Belum disusun.</p>}
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
