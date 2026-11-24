import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { AKUN, KONDISI, akunAset, hitungLBKP, hitungPenyusutan, hitungPenyusutanPerAkun, kelompokNeraca, rupiah, saldoDariAset, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Button, Card, PageHeader, Select, Table, Td } from '../components/ui.jsx'

const TABS = [
  ['lbkp', 'LBKP'],
  ['dbkp', 'DBKP'],
  ['buku', 'Buku Intra/Ekstrakomptabel'],
  ['dbr', 'DBR per ruangan'],
  ['rb', 'Rusak Berat / Hilang'],
  ['pnbp', 'Buku PNBP'],
]

export default function Laporan() {
  const [tab, setTab] = useState('lbkp')
  return (
    <>
      <PageHeader
        title="Laporan Barang Kuasa Pengguna"
        desc="Disusun otomatis dari Buku Barang. Laporan semesteran dan tahunan menjadi bahan penyusunan neraca satker."
        actions={<Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Cetak</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 print:hidden">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-teal-700 font-medium text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>
      <PerluSatker>
        {tab === 'lbkp' && <LBKP />}
        {tab === 'dbkp' && <DBKP />}
        {tab === 'buku' && <BukuIntraEkstra />}
        {tab === 'dbr' && <DBR />}
        {tab === 'rb' && <DaftarRB />}
        {tab === 'pnbp' && <PNBP />}
      </PerluSatker>
    </>
  )
}

function KopLaporan({ judul, periode }) {
  const { satker } = useSatker()
  return (
    <div className="mb-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">{judul}</p>
      <p className="text-sm text-slate-600">{satker?.kode} · {satker?.nama}</p>
      {periode && <p className="text-xs text-slate-500">{periode}</p>}
    </div>
  )
}

function opsiPeriode() {
  const y = new Date().getFullYear()
  const out = []
  for (let t = y; t >= y - 3; t--) {
    out.push({ value: `${t}-S2`, label: `Semester II ${t} (Jul–Des)` })
    out.push({ value: `${t}-S1`, label: `Semester I ${t} (Jan–Jun)` })
    out.push({ value: `${t}-TH`, label: `Tahunan ${t}` })
  }
  return out
}

function rentang(kode) {
  const [t, p] = kode.split('-')
  if (p === 'S1') return [`${t}-01-01`, `${t}-06-30`, `Semester I Tahun ${t}`]
  if (p === 'S2') return [`${t}-07-01`, `${t}-12-31`, `Semester II Tahun ${t}`]
  return [`${t}-01-01`, `${t}-12-31`, `Tahunan ${t}`]
}

function LBKP() {
  const { aset, transaksi } = useSatker()
  const [periode, setPeriode] = useState(`${new Date().getFullYear()}-S1`)
  const [mulai, akhir, label] = rentang(periode)
  const rows = useMemo(() => hitungLBKP(transaksi, mulai, akhir), [transaksi, mulai, akhir])
  const susut = hitungPenyusutanPerAkun(aset, akhir)
  const tampil = rows.filter((r) => r.saldoAwal || r.tambah || r.kurang)
  const total = tampil.reduce((s, r) => ({ saldoAwal: s.saldoAwal + r.saldoAwal, tambah: s.tambah + r.tambah, kurang: s.kurang + r.kurang, saldoAkhir: s.saldoAkhir + r.saldoAkhir }), { saldoAwal: 0, tambah: 0, kurang: 0, saldoAkhir: 0 })
  const totalSusut = Object.values(susut).reduce((s, v) => s + v, 0)

  // Cek silang: bila periode mencakup transaksi terakhir, saldo akhir LBKP = saldo dari Daftar Barang
  const terakhir = transaksi.at(-1)?.tanggal
  const cakupPenuh = !terakhir || terakhir <= akhir
  const dariAset = saldoDariAset(aset)
  const selisih = cakupPenuh ? AKUN.filter((a) => (rows.find((r) => r.akun === a)?.saldoAkhir || 0) !== (dariAset[a] || 0)) : []

  return (
    <Card actions={<Select value={periode} onChange={(e) => setPeriode(e.target.value)} options={opsiPeriode()} className="w-64 print:hidden" />}>
      <KopLaporan judul="Laporan Barang Kuasa Pengguna — Intrakomptabel" periode={label} />
      <Table
        head={['Akun', 'Kelompok', { label: 'Saldo awal', right: true }, { label: 'Mutasi tambah', right: true }, { label: 'Mutasi kurang', right: true }, { label: 'Saldo akhir', right: true }, { label: 'Akum. penyusutan', right: true }, { label: 'Nilai buku', right: true }]}
        empty={tampil.length ? null : 'Tidak ada saldo pada periode ini.'}
        footer={tampil.length ? (
          <tr>
            <Td colSpan={2}>Jumlah</Td>
            <Td right>{rupiah(total.saldoAwal)}</Td>
            <Td right>{rupiah(total.tambah)}</Td>
            <Td right>{rupiah(-total.kurang)}</Td>
            <Td right>{rupiah(total.saldoAkhir)}</Td>
            <Td right>{rupiah(totalSusut)}</Td>
            <Td right>{rupiah(total.saldoAkhir - totalSusut)}</Td>
          </tr>
        ) : null}
      >
        {tampil.map((r) => (
          <tr key={r.akun}>
            <Td>{r.akun}</Td>
            <Td>{kelompokNeraca(r.akun)}</Td>
            <Td right>{rupiah(r.saldoAwal)}</Td>
            <Td right>{rupiah(r.tambah)}</Td>
            <Td right>{rupiah(-r.kurang)}</Td>
            <Td right>{rupiah(r.saldoAkhir)}</Td>
            <Td right>{rupiah(susut[r.akun] || 0)}</Td>
            <Td right>{rupiah(r.saldoAkhir - (susut[r.akun] || 0))}</Td>
          </tr>
        ))}
      </Table>
      <div className="mt-3 space-y-2 print:hidden">
        {cakupPenuh && (selisih.length
          ? <Alert tone="rose">Saldo akhir tidak sama dengan Daftar Barang untuk akun: {selisih.join(', ')}. Periksa transaksi koreksi.</Alert>
          : <Alert tone="teal">Cek silang lulus: saldo akhir LBKP sama dengan nilai Daftar Barang Kuasa Pengguna.</Alert>)}
        <p className="text-xs text-slate-500">Penyusutan dihitung garis lurus semesteran dari kondisi aset saat ini (penyederhanaan untuk pembelajaran).</p>
      </div>
    </Card>
  )
}

function DBKP() {
  const { aset } = useSatker()
  const [akun, setAkun] = useState('')
  const list = aset.filter((a) => a.intrakomptabel && a.status === 'aktif' && (!akun || akunAset(a) === akun)).sort((a, b) => a.kodeBarang.localeCompare(b.kodeBarang) || a.nup - b.nup)
  const hariIni = new Date()
  return (
    <Card actions={<Select value={akun} onChange={(e) => setAkun(e.target.value)} placeholder="Semua akun" options={AKUN.map((a) => ({ value: a, label: a }))} className="w-60 print:hidden" />}>
      <KopLaporan judul={`Daftar Barang Kuasa Pengguna${akun ? ` — ${akun}` : ''}`} periode={`Per ${tanggalID(hariIni)}`} />
      <Table head={['No', 'Kode barang', 'NUP', 'Nama barang', 'Merk/tipe', 'Tgl perolehan', 'Kondisi', { label: 'Nilai perolehan', right: true }, { label: 'Nilai buku', right: true }]} empty={list.length ? null : 'Tidak ada data.'}
        footer={list.length ? <tr><Td colSpan={7}>Jumlah</Td><Td right>{rupiah(list.reduce((s, a) => s + a.nilai, 0))}</Td><Td right>{rupiah(list.reduce((s, a) => s + hitungPenyusutan(a, hariIni).nilaiBuku, 0))}</Td></tr> : null}>
        {list.map((a, i) => (
          <tr key={a.id}>
            <Td>{i + 1}</Td><Td className="font-mono text-xs">{a.kodeBarang}</Td><Td>{a.nup}</Td><Td>{a.namaBarang}</Td><Td>{a.merk}</Td>
            <Td>{tanggalID(a.tglPerolehan)}</Td><Td>{KONDISI[a.kondisi]}</Td><Td right>{rupiah(a.nilai)}</Td><Td right>{rupiah(hitungPenyusutan(a, hariIni).nilaiBuku)}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}

function BukuIntraEkstra() {
  const { aset } = useSatker()
  const aktif = aset.filter((a) => a.status === 'aktif')
  const grup = [
    ['Buku Barang Intrakomptabel', aktif.filter((a) => a.intrakomptabel)],
    ['Buku Barang Ekstrakomptabel', aktif.filter((a) => !a.intrakomptabel && !a.bersejarah)],
    ['Buku Barang Bersejarah (tanpa nilai)', aktif.filter((a) => a.bersejarah)],
  ]
  return (
    <div className="space-y-5">
      {grup.map(([judul, list]) => (
        <Card key={judul}>
          <KopLaporan judul={judul} />
          <Table head={['Kode barang', 'NUP', 'Nama barang', 'Lokasi', { label: 'Nilai', right: true }]} empty={list.length ? null : 'Kosong.'}
            footer={list.length ? <tr><Td colSpan={4}>{list.length} NUP</Td><Td right>{rupiah(list.reduce((s, a) => s + a.nilai, 0))}</Td></tr> : null}>
            {list.map((a) => <tr key={a.id}><Td className="font-mono text-xs">{a.kodeBarang}</Td><Td>{a.nup}</Td><Td>{a.namaBarang}</Td><Td>{a.lokasiRuang}</Td><Td right>{rupiah(a.nilai)}</Td></tr>)}
          </Table>
        </Card>
      ))}
    </div>
  )
}

function DBR() {
  const { aset } = useSatker()
  const aktif = aset.filter((a) => a.status === 'aktif')
  const ruang = [...new Set(aktif.map((a) => a.lokasiRuang || '(belum ditentukan)'))].sort()
  const [r, setR] = useState('')
  const pilih = r || ruang[0] || ''
  const list = aktif.filter((a) => (a.lokasiRuang || '(belum ditentukan)') === pilih)
  return (
    <Card actions={<Select value={pilih} onChange={(e) => setR(e.target.value)} options={ruang.map((v) => ({ value: v, label: v }))} className="w-60 print:hidden" />}>
      <KopLaporan judul={`Daftar Barang Ruangan — ${pilih}`} periode={`Per ${tanggalID(new Date())}`} />
      <Table head={['No', 'Kode barang', 'NUP', 'Nama barang', 'Merk/tipe', 'Kondisi', 'Keterangan']} empty={list.length ? null : 'Tidak ada barang.'}>
        {list.map((a, i) => <tr key={a.id}><Td>{i + 1}</Td><Td className="font-mono text-xs">{a.kodeBarang}</Td><Td>{a.nup}</Td><Td>{a.namaBarang}</Td><Td>{a.merk}</Td><Td>{KONDISI[a.kondisi]}</Td><Td>{a.intrakomptabel ? '' : 'Ekstrakomptabel'}</Td></tr>)}
      </Table>
      <div className="mt-10 hidden grid-cols-2 text-center text-sm print:grid">
        <div>Penanggung Jawab Ruangan<br /><br /><br />(............................)</div>
        <div>Kuasa Pengguna Barang<br /><br /><br />(............................)</div>
      </div>
    </Card>
  )
}

function DaftarRB() {
  const { aset } = useSatker()
  return (
    <div className="space-y-5">
      {[['rusak_berat', 'Daftar Barang Rusak Berat'], ['hilang', 'Daftar Barang Hilang'], ['dihentikan', 'Aset Tetap yang Dihentikan dari Penggunaan']].map(([st, judul]) => {
        const list = aset.filter((a) => a.status === st)
        return (
          <Card key={st}>
            <KopLaporan judul={judul} />
            <Table head={['Kode barang', 'NUP', 'Nama barang', 'Lokasi', { label: 'Nilai', right: true }]} empty={list.length ? null : 'Kosong.'}>
              {list.map((a) => <tr key={a.id}><Td className="font-mono text-xs">{a.kodeBarang}</Td><Td>{a.nup}</Td><Td>{a.namaBarang}</Td><Td>{a.lokasiRuang}</Td><Td right>{rupiah(a.nilai)}</Td></tr>)}
            </Table>
          </Card>
        )
      })}
    </div>
  )
}

function PNBP() {
  const { satkerId } = useSatker()
  const { data } = useCollection(['satker', satkerId, 'pnbp'])
  return (
    <Card>
      <KopLaporan judul="Buku PNBP dari Pengelolaan BMN" />
      <Table head={['Tanggal', 'Sumber', 'Mitra', 'Nomor SK', { label: 'Nilai', right: true }]} empty={data.length ? null : 'Belum ada PNBP. PNBP tercatat otomatis saat usulan sewa disetujui.'}
        footer={data.length ? <tr><Td colSpan={4}>Jumlah</Td><Td right>{rupiah(data.reduce((s, d) => s + d.nilai, 0))}</Td></tr> : null}>
        {data.map((d) => <tr key={d.id}><Td>{tanggalID(d.tanggal)}</Td><Td>{d.sumber}</Td><Td>{d.mitra}</Td><Td>{d.nomorSK}</Td><Td right>{rupiah(d.nilai)}</Td></tr>)}
      </Table>
    </Card>
  )
}
