import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { AKUN, KONDISI, akunAset, hitungLBKP, hitungPenyusutan, hitungPenyusutanPerAkun, kelompokNeraca, rupiah, saldoDariAset, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { neracaBMN } from '../lib/wasdal.js'
import { lbkpPersediaan, nilaiPersediaan } from '../lib/persediaan.js'
import { usePersediaan } from './Persediaan.jsx'
import { Alert, Button, Card, PageHeader, Select, Table, Tabs, Td, TombolEkspor } from '../components/ui.jsx'

const TABS = [
  ['lbkp', 'LBKP'],
  ['neraca', 'Neraca BMN'],
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
      <Tabs items={TABS} value={tab} onChange={setTab} />
      <PerluSatker>
        {tab === 'lbkp' && <LBKP />}
        {tab === 'neraca' && <Neraca />}
        {tab === 'dbkp' && <DBKP />}
        {tab === 'buku' && <BukuIntraEkstra />}
        {tab === 'dbr' && <DBR />}
        {tab === 'rb' && <DaftarRB />}
        {tab === 'pnbp' && <PNBP />}
      </PerluSatker>
    </>
  )
}

/** Kop untuk ekspor: judul + satker + periode. */
function useKop() {
  const { satker } = useSatker()
  return (judul, periode) => ({ judul, sheet: judul, subjudul: [`${satker?.kode || ''} · ${satker?.nama || ''}`, periode].filter(Boolean) })
}
const TTD_KPB = ['Kuasa Pengguna Barang']

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

  const kop = useKop()
  const ekspor = () => ({
    ...kop('Laporan Barang Kuasa Pengguna — Intrakomptabel', label),
    sheet: 'LBKP',
    kolom: [{ label: 'Akun' }, { label: 'Kelompok' }, { label: 'Saldo awal', tipe: 'uang' }, { label: 'Mutasi tambah', tipe: 'uang' }, { label: 'Mutasi kurang', tipe: 'uang' }, { label: 'Saldo akhir', tipe: 'uang' }, { label: 'Akum. penyusutan', tipe: 'uang' }, { label: 'Nilai buku', tipe: 'uang' }],
    baris: tampil.map((r) => [r.akun, kelompokNeraca(r.akun), r.saldoAwal, r.tambah, -r.kurang, r.saldoAkhir, susut[r.akun] || 0, r.saldoAkhir - (susut[r.akun] || 0)]),
    total: ['Jumlah', '', total.saldoAwal, total.tambah, -total.kurang, total.saldoAkhir, totalSusut, total.saldoAkhir - totalSusut],
  })

  return (
    <Card actions={<><Select value={periode} onChange={(e) => setPeriode(e.target.value)} options={opsiPeriode()} className="w-64 print:hidden" /><TombolEkspor nama={`LBKP ${label}`} laporan={ekspor} tandaTangan={TTD_KPB} /></>}>
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

function Neraca() {
  const { aset, transaksi } = useSatker()
  const { barang, mutasi } = usePersediaan()
  const hariIni = new Date()
  const n = useMemo(() => {
    const t = hariIni.toISOString().slice(0, 10)
    const persediaan = { buku: lbkpPersediaan(barang, mutasi, '1900-01-01', t).reduce((s, r) => s + r.akhir, 0), daftar: nilaiPersediaan(barang) }
    return neracaBMN({ aset, transaksi, persediaan, tanggal: hariIni })
  }, [aset, transaksi, barang, mutasi]) // eslint-disable-line react-hooks/exhaustive-deps
  const selisih = n.totalDaftar - n.totalBuku
  const kop = useKop()
  const periode = `Per ${tanggalID(hariIni)}`
  const barisEkspor = () => {
    const out = []
    for (const k of n.kelompok) {
      out.push([k.nama.toUpperCase(), '', '', ''])
      for (const b of k.baris) out.push([`   ${b.akun}`, b.buku, b.daftar, b.daftar - b.buku])
      for (const p of k.pengurang) out.push([`   ${p.akun}`, p.nilai, p.nilai, 0])
      out.push([`Jumlah ${k.nama}`, k.jumlahBuku, k.jumlahDaftar, k.jumlahDaftar - k.jumlahBuku])
    }
    return out
  }
  const ekspor = () => ({
    ...kop('Ringkasan Neraca BMN', periode), sheet: 'Neraca BMN',
    kolom: [{ label: 'Uraian' }, { label: 'Menurut Buku Barang', tipe: 'uang' }, { label: 'Menurut Daftar Barang', tipe: 'uang' }, { label: 'Selisih', tipe: 'uang' }],
    baris: barisEkspor(),
    total: ['JUMLAH ASET (BMN)', n.totalBuku, n.totalDaftar, selisih],
  })
  const Sel = ({ v, tebal }) => <Td right className={`${tebal ? 'font-semibold text-slate-900' : ''} ${v < 0 ? 'text-rose-700' : ''}`}>{rupiah(v)}</Td>
  return (
    <Card actions={<TombolEkspor nama={`Neraca BMN ${periode}`} laporan={ekspor} tandaTangan={TTD_KPB} />}>
      <KopLaporan judul="Ringkasan Neraca BMN" periode={periode} />
      <Table head={['Uraian', { label: 'Menurut Buku Barang', right: true }, { label: 'Menurut Daftar Barang', right: true }, { label: 'Selisih', right: true }]}
        footer={<tr><Td>JUMLAH ASET (BMN)</Td><Sel v={n.totalBuku} tebal /><Sel v={n.totalDaftar} tebal /><Sel v={selisih} tebal /></tr>}>
        {n.kelompok.flatMap((k) => [
          <tr key={k.nama} className="bg-slate-50/60"><Td colSpan={4} className="font-semibold text-slate-900">{k.nama}</Td></tr>,
          ...k.baris.map((b) => (
            <tr key={k.nama + b.akun}><Td className="pl-6">{b.akun}</Td><Sel v={b.buku} /><Sel v={b.daftar} /><Td right className={b.daftar !== b.buku ? 'font-semibold text-rose-700' : 'text-slate-400'}>{rupiah(b.daftar - b.buku)}</Td></tr>
          )),
          ...k.pengurang.map((p) => (
            <tr key={k.nama + p.akun}><Td className="pl-6 text-slate-500">{p.akun}</Td><Sel v={p.nilai} /><Sel v={p.nilai} /><Td right className="text-slate-400">{rupiah(0)}</Td></tr>
          )),
          <tr key={k.nama + 'j'}><Td className="font-medium">Jumlah {k.nama}</Td><Sel v={k.jumlahBuku} tebal /><Sel v={k.jumlahDaftar} tebal /><Sel v={k.jumlahDaftar - k.jumlahBuku} tebal /></tr>,
        ])}
      </Table>
      <div className="mt-3 space-y-2 print:hidden">
        {selisih
          ? <Alert tone="rose">Neraca menurut Buku Barang berbeda {rupiah(Math.abs(selisih))} dari Daftar Barang. Akibatnya nilai BMN di neraca tidak dapat diandalkan. Lihat menu Wasdal untuk menelusuri penyebabnya.</Alert>
          : <Alert tone="teal">Neraca menurut Buku Barang sama dengan Daftar Barang.</Alert>}
        <p className="text-xs text-slate-500">"Buku Barang" disusun dari transaksi yang dibukukan; "Daftar Barang" dari kondisi aset saat ini. Akumulasi penyusutan dan amortisasi dihitung dari Daftar Barang. Persediaan: Buku = kartu mutasi, Daftar = saldo FIFO per barang.</p>
      </div>
    </Card>
  )
}

function DBKP() {
  const { aset } = useSatker()
  const [akun, setAkun] = useState('')
  const list = aset.filter((a) => a.intrakomptabel && a.status === 'aktif' && (!akun || akunAset(a) === akun)).sort((a, b) => a.kodeBarang.localeCompare(b.kodeBarang) || a.nup - b.nup)
  const hariIni = new Date()
  const kop = useKop()
  const judul = `Daftar Barang Kuasa Pengguna${akun ? ` — ${akun}` : ''}`
  const ekspor = () => ({
    ...kop(judul, `Per ${tanggalID(hariIni)}`), sheet: 'DBKP',
    kolom: [{ label: 'No', tipe: 'angka' }, { label: 'Kode barang' }, { label: 'NUP', tipe: 'angka' }, { label: 'Nama barang' }, { label: 'Merk/tipe' }, { label: 'Tgl perolehan' }, { label: 'Kondisi' }, { label: 'Nilai perolehan', tipe: 'uang' }, { label: 'Nilai buku', tipe: 'uang' }],
    baris: list.map((a, i) => [i + 1, a.kodeBarang, a.nup, a.namaBarang, a.merk, tanggalID(a.tglPerolehan), KONDISI[a.kondisi], a.nilai, hitungPenyusutan(a, hariIni).nilaiBuku]),
    total: ['Jumlah', '', '', '', '', '', '', list.reduce((s, a) => s + a.nilai, 0), list.reduce((s, a) => s + hitungPenyusutan(a, hariIni).nilaiBuku, 0)],
  })
  return (
    <Card actions={<><Select value={akun} onChange={(e) => setAkun(e.target.value)} placeholder="Semua akun" options={AKUN.map((a) => ({ value: a, label: a }))} className="w-60 print:hidden" /><TombolEkspor nama={judul} laporan={ekspor} tandaTangan={TTD_KPB} /></>}>
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
  const kop = useKop()
  const ekspor = () => grup.map(([judul, list], i) => ({
    ...kop(judul, `Per ${tanggalID(new Date())}`), sheet: ['Intrakomptabel', 'Ekstrakomptabel', 'Bersejarah'][i],
    kolom: [{ label: 'Kode barang' }, { label: 'NUP', tipe: 'angka' }, { label: 'Nama barang' }, { label: 'Lokasi' }, { label: 'Nilai', tipe: 'uang' }],
    baris: list.map((a) => [a.kodeBarang, a.nup, a.namaBarang, a.lokasiRuang, a.nilai]),
    total: [`${list.length} NUP`, '', '', '', list.reduce((s, a) => s + a.nilai, 0)],
  }))
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><TombolEkspor nama="Buku Barang Intra Ekstra Bersejarah" laporan={ekspor} /></div>
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
  const kop = useKop()
  const dbr = (nama) => {
    const isi = aktif.filter((a) => (a.lokasiRuang || '(belum ditentukan)') === nama)
    return {
      ...kop(`Daftar Barang Ruangan — ${nama}`, `Per ${tanggalID(new Date())}`), sheet: nama,
      kolom: [{ label: 'No', tipe: 'angka' }, { label: 'Kode barang' }, { label: 'NUP', tipe: 'angka' }, { label: 'Nama barang' }, { label: 'Merk/tipe' }, { label: 'Kondisi' }, { label: 'Keterangan' }],
      baris: isi.map((a, i) => [i + 1, a.kodeBarang, a.nup, a.namaBarang, a.merk, KONDISI[a.kondisi], a.intrakomptabel ? '' : 'Ekstrakomptabel']),
    }
  }
  return (
    <Card actions={<><Select value={pilih} onChange={(e) => setR(e.target.value)} options={ruang.map((v) => ({ value: v, label: v }))} className="w-60 print:hidden" /><TombolEkspor nama="DBR semua ruangan" laporan={() => ruang.map(dbr)} tandaTangan={['Penanggung Jawab Ruangan', 'Kuasa Pengguna Barang']} /></>}>
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

const DAFTAR_RB = [['rusak_berat', 'Daftar Barang Rusak Berat'], ['hilang', 'Daftar Barang Hilang'], ['dihentikan', 'Aset Tetap yang Dihentikan dari Penggunaan']]

function DaftarRB() {
  const { aset } = useSatker()
  const kop = useKop()
  const ekspor = () => DAFTAR_RB.map(([st, judul]) => {
    const list = aset.filter((a) => a.status === st)
    return {
      ...kop(judul, `Per ${tanggalID(new Date())}`), sheet: { rusak_berat: 'Rusak Berat', hilang: 'Hilang', dihentikan: 'Dihentikan' }[st],
      kolom: [{ label: 'Kode barang' }, { label: 'NUP', tipe: 'angka' }, { label: 'Nama barang' }, { label: 'Lokasi' }, { label: 'Nilai', tipe: 'uang' }],
      baris: list.map((a) => [a.kodeBarang, a.nup, a.namaBarang, a.lokasiRuang, a.nilai]),
    }
  })
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><TombolEkspor nama="Daftar Barang Rusak Berat dan Hilang" laporan={ekspor} /></div>
      {DAFTAR_RB.map(([st, judul]) => {
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
  const kop = useKop()
  const ekspor = () => ({
    ...kop('Buku PNBP dari Pengelolaan BMN'), sheet: 'PNBP',
    kolom: [{ label: 'Tanggal' }, { label: 'Sumber' }, { label: 'Mitra' }, { label: 'Nomor SK' }, { label: 'Nilai', tipe: 'uang' }],
    baris: data.map((d) => [tanggalID(d.tanggal), d.sumber, d.mitra, d.nomorSK, d.nilai]),
    total: ['Jumlah', '', '', '', data.reduce((s, d) => s + d.nilai, 0)],
  })
  return (
    <Card actions={<TombolEkspor nama="Buku PNBP" laporan={ekspor} />}>
      <KopLaporan judul="Buku PNBP dari Pengelolaan BMN" />
      <Table head={['Tanggal', 'Sumber', 'Mitra', 'Nomor SK', { label: 'Nilai', right: true }]} empty={data.length ? null : 'Belum ada PNBP. PNBP tercatat otomatis saat usulan sewa disetujui.'}
        footer={data.length ? <tr><Td colSpan={4}>Jumlah</Td><Td right>{rupiah(data.reduce((s, d) => s + d.nilai, 0))}</Td></tr> : null}>
        {data.map((d) => <tr key={d.id}><Td>{tanggalID(d.tanggal)}</Td><Td>{d.sumber}</Td><Td>{d.mitra}</Td><Td>{d.nomorSK}</Td><Td right>{rupiah(d.nilai)}</Td></tr>)}
      </Table>
    </Card>
  )
}
