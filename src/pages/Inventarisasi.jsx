import { useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { buatInventarisasi, catatTransaksi, simpanInventarisasi } from '../lib/db.js'
import { golonganDari } from '../data/kodeBarang.js'
import { KONDISI, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td } from '../components/ui.jsx'
import { labelAset } from './Aset.jsx'

const JENIS = {
  sensus: 'Sensus barang (BMN selain persediaan & KDP, min. 1× dalam 5 tahun)',
  opname_kdp: 'Opname fisik KDP (min. 1× setahun)',
}

export default function Inventarisasi() {
  return (
    <>
      <PageHeader title="Inventarisasi BMN" desc="Pendataan, pencatatan, dan pelaporan hasil pendataan BMN. Hasil yang berbeda dengan catatan dibukukan sebagai transaksi koreksi." />
      <PerluSatker><Isi /></PerluSatker>
    </>
  )
}

function Isi() {
  const { satkerId } = useSatker()
  const { data } = useCollection(['satker', satkerId, 'inventarisasi'], [orderBy('createdAt', 'desc')])
  const [aktif, setAktif] = useState(null)
  const [baru, setBaru] = useState({ jenis: 'sensus', tanggal: new Date().toISOString().slice(0, 10) })
  const sesi = data.find((d) => d.id === aktif)

  async function mulai() {
    const r = await buatInventarisasi(satkerId, { ...baru, hasil: {} })
    setAktif(r.id)
  }

  return (
    <div className="space-y-5">
      <Card title="Mulai inventarisasi">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Jenis"><Select value={baru.jenis} onChange={(e) => setBaru({ ...baru, jenis: e.target.value })} options={Object.entries(JENIS).map(([value, label]) => ({ value, label }))} className="w-96" /></Field>
          <Field label="Tanggal"><Input type="date" value={baru.tanggal} onChange={(e) => setBaru({ ...baru, tanggal: e.target.value })} /></Field>
          <Button onClick={mulai}>Mulai</Button>
        </div>
      </Card>

      <Card title="Sesi inventarisasi">
        <Table head={['Tanggal', 'Jenis', 'Status', '']} empty={data.length ? null : 'Belum ada sesi.'}>
          {data.map((d) => (
            <tr key={d.id}>
              <Td>{tanggalID(d.tanggal)}</Td>
              <Td>{JENIS[d.jenis]}</Td>
              <Td><Badge tone={d.status === 'selesai' ? 'teal' : 'amber'}>{d.status}</Badge></Td>
              <Td><Button variant="ghost" onClick={() => setAktif(d.id)}>Buka</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>

      {sesi && <Lembar key={sesi.id} sesi={sesi} />}
    </div>
  )
}

function Lembar({ sesi }) {
  const { user, ref } = useAuth()
  const { satkerId, aset } = useSatker()
  const [hasil, setHasil] = useState(sesi.hasil || {})
  const [nomorBA, setNomorBA] = useState(sesi.nomorBA || '')
  const [pesan, setPesan] = useState(null)
  const [proses, setProses] = useState(false)
  const selesai = sesi.status === 'selesai'

  const objek = aset
    .filter((a) => a.status === 'aktif')
    .filter((a) => (sesi.jenis === 'opname_kdp' ? golonganDari(a.kodeBarang) === '7' : golonganDari(a.kodeBarang) !== '7'))
    .sort((a, b) => (a.lokasiRuang || '').localeCompare(b.lokasiRuang || '') || a.kodeBarang.localeCompare(b.kodeBarang))

  const h = (a) => hasil[a.id] || { ditemukan: true, kondisi: a.kondisi }
  const set = (a, patch) => setHasil({ ...hasil, [a.id]: { ...h(a), ...patch } })

  const berubah = objek.filter((a) => h(a).ditemukan && h(a).kondisi !== a.kondisi)
  const hilang = objek.filter((a) => !h(a).ditemukan)

  async function simpanDraf() {
    await simpanInventarisasi(satkerId, sesi.id, { hasil, nomorBA })
    setPesan({ tone: 'teal', teks: 'Lembar kerja tersimpan.' })
  }

  async function finalisasi() {
    if (!nomorBA) return setPesan({ tone: 'rose', teks: 'Isi nomor Berita Acara Inventarisasi terlebih dahulu.' })
    if (!window.confirm(`Bukukan ${berubah.length} koreksi kondisi dan ${hilang.length} reklasifikasi barang hilang?`)) return
    setProses(true)
    setPesan(null)
    const dokumen = { jenis: 'Berita Acara Inventarisasi', nomor: nomorBA, tanggal: sesi.tanggal }
    try {
      for (const a of berubah) {
        await catatTransaksi({ satkerId, asetId: a.id, uid: user.uid, ref, sumber: { inventarisasiId: sesi.id }, input: { jenis: 'koreksi_kondisi', tanggal: sesi.tanggal, kondisiBaru: h(a).kondisi, dokumen, keterangan: 'Hasil inventarisasi' } })
      }
      for (const a of hilang) {
        await catatTransaksi({ satkerId, asetId: a.id, uid: user.uid, ref, sumber: { inventarisasiId: sesi.id }, input: { jenis: 'reklasifikasi_hilang', tanggal: sesi.tanggal, dokumen, keterangan: 'Tidak ditemukan saat inventarisasi' } })
      }
      await simpanInventarisasi(satkerId, sesi.id, {
        hasil, nomorBA, status: 'selesai',
        ringkasan: { diperiksa: objek.length, ditemukan: objek.length - hilang.length, kondisiBerubah: berubah.length, tidakDitemukan: hilang.length },
      })
      setPesan({ tone: 'teal', teks: 'Inventarisasi selesai dan hasilnya telah dibukukan.' })
    } catch (e) {
      setPesan({ tone: 'rose', teks: e.message })
    } finally {
      setProses(false)
    }
  }

  return (
    <Card title={`Lembar kerja — ${JENIS[sesi.jenis]} · ${tanggalID(sesi.tanggal)}`}>
      {selesai && sesi.ringkasan && (
        <Alert tone="teal">Selesai. Diperiksa {sesi.ringkasan.diperiksa} NUP, ditemukan {sesi.ringkasan.ditemukan}, kondisi berubah {sesi.ringkasan.kondisiBerubah}, tidak ditemukan {sesi.ringkasan.tidakDitemukan}. BA: {sesi.nomorBA}</Alert>
      )}
      <div className="mt-3">
        <Table head={['Lokasi', 'Aset', 'Kondisi tercatat', 'Ditemukan?', 'Kondisi fisik']} empty={objek.length ? null : 'Tidak ada objek inventarisasi.'}>
          {objek.map((a) => (
            <tr key={a.id} className={!h(a).ditemukan ? 'bg-rose-50' : h(a).kondisi !== a.kondisi ? 'bg-amber-50' : ''}>
              <Td>{a.lokasiRuang || '—'}</Td>
              <Td>{labelAset(a)}</Td>
              <Td>{KONDISI[a.kondisi]}</Td>
              <Td><input type="checkbox" disabled={selesai} checked={h(a).ditemukan} onChange={(e) => set(a, { ditemukan: e.target.checked })} aria-label="Ditemukan" /></Td>
              <Td><Select disabled={selesai || !h(a).ditemukan} value={h(a).kondisi} onChange={(e) => set(a, { kondisi: e.target.value })} options={Object.entries(KONDISI).map(([value, label]) => ({ value, label }))} className="w-36" /></Td>
            </tr>
          ))}
        </Table>
      </div>
      {!selesai && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Nomor Berita Acara Inventarisasi"><Input value={nomorBA} onChange={(e) => setNomorBA(e.target.value)} className="w-64" /></Field>
          <Button variant="secondary" onClick={simpanDraf}>Simpan lembar kerja</Button>
          <Button onClick={finalisasi} disabled={proses}>{proses ? 'Membukukan…' : `Selesaikan & bukukan (${berubah.length + hilang.length} koreksi)`}</Button>
        </div>
      )}
      {pesan && <div className="mt-3"><Alert tone={pesan.tone}>{pesan.teks}</Alert></div>}
    </Card>
  )
}
