import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSatker } from '../lib/satker.jsx'
import { ubahAtributAset } from '../lib/db.js'
import { cariKode, golonganDari, GOLONGAN } from '../data/kodeBarang.js'
import { KIB } from '../data/kib.js'
import { KONDISI, STATUS_ASET, STATUS_PENGGUNAAN, akunAset, hitungPenyusutan, rupiah, tanggalID } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Td } from '../components/ui.jsx'

export const toneKondisi = { B: 'teal', RR: 'amber', RB: 'rose' }
export const toneStatus = { aktif: 'teal', rusak_berat: 'rose', hilang: 'rose', dihentikan: 'amber', dihapus: 'slate' }
export const labelAset = (a) => `${a.kodeBarang} · NUP ${a.nup} · ${a.namaBarang}${a.merk ? ` (${a.merk})` : ''}`

export default function Aset() {
  return (
    <>
      <PageHeader
        title="Daftar Aset & KIB"
        desc="Daftar Barang Kuasa Pengguna. Nilai, kondisi, dan status hanya berubah melalui transaksi agar jejak pembukuan utuh."
        actions={<Link to="/transaksi"><Button>Catat perolehan</Button></Link>}
      />
      <PerluSatker><DaftarAset /></PerluSatker>
    </>
  )
}

function DaftarAset() {
  const { aset } = useSatker()
  const [cari, setCari] = useState('')
  const [gol, setGol] = useState('')
  const [status, setStatus] = useState('aktif')
  const [pilih, setPilih] = useState(null)

  const list = useMemo(() => {
    const q = cari.toLowerCase()
    return aset
      .filter((a) => (!gol || golonganDari(a.kodeBarang) === gol) && (!status || a.status === status))
      .filter((a) => !q || `${a.kodeBarang} ${a.namaBarang} ${a.merk} ${a.lokasiRuang}`.toLowerCase().includes(q))
      .sort((a, b) => a.kodeBarang.localeCompare(b.kodeBarang) || a.nup - b.nup)
  }, [aset, cari, gol, status])

  const terpilih = pilih ? aset.find((a) => a.id === pilih) : null

  return (
    <Card
      title={`${list.length} aset`}
      actions={
        <>
          <Input placeholder="Cari kode, nama, merk, ruang…" value={cari} onChange={(e) => setCari(e.target.value)} className="w-56" />
          <Select value={gol} onChange={(e) => setGol(e.target.value)} placeholder="Semua golongan" options={Object.entries(GOLONGAN).map(([value, label]) => ({ value, label }))} className="w-48" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Semua status" options={Object.entries(STATUS_ASET).map(([value, label]) => ({ value, label }))} className="w-52" />
        </>
      }
    >
      <Table head={['Kode barang', 'NUP', 'Nama / merk', 'Lokasi', 'Kondisi', 'Status', 'Buku', { label: 'Nilai', right: true }]} empty={list.length ? null : 'Tidak ada aset sesuai filter.'}>
        {list.map((a) => (
          <tr key={a.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setPilih(a.id)}>
            <Td className="font-mono text-xs">{a.kodeBarang}</Td>
            <Td>{a.nup}</Td>
            <Td><span className="font-medium text-slate-800">{a.namaBarang}</span>{a.merk && <span className="block text-xs text-slate-500">{a.merk}</span>}</Td>
            <Td>{a.lokasiRuang || <span className="text-amber-700">belum diisi</span>}</Td>
            <Td><Badge tone={toneKondisi[a.kondisi]}>{KONDISI[a.kondisi]}</Badge></Td>
            <Td><Badge tone={toneStatus[a.status]}>{STATUS_ASET[a.status]}</Badge></Td>
            <Td className="text-xs">{a.bersejarah ? 'Bersejarah' : a.intrakomptabel ? 'Intrakomptabel' : 'Ekstrakomptabel'}</Td>
            <Td right>{rupiah(a.nilai)}</Td>
          </tr>
        ))}
      </Table>
      <Modal open={!!terpilih} onClose={() => setPilih(null)} title={terpilih ? labelAset(terpilih) : ''} wide>
        {terpilih && <DetailAset aset={terpilih} />}
      </Modal>
    </Card>
  )
}

function DetailAset({ aset }) {
  const { satkerId, transaksi } = useSatker()
  const kode = cariKode(aset.kodeBarang)
  const kib = kode?.kib && KIB[kode.kib]
  const [f, setF] = useState({
    merk: aset.merk || '',
    lokasiRuang: aset.lokasiRuang || '',
    statusPenggunaan: aset.statusPenggunaan || 'digunakan_sendiri',
    kib: aset.kib || {},
  })
  const [pesan, setPesan] = useState('')
  const susut = hitungPenyusutan(aset, new Date())
  const riwayat = transaksi.filter((t) => t.asetId === aset.id)
  const bisaEdit = aset.status !== 'dihapus'

  async function simpan() {
    setPesan('')
    try {
      await ubahAtributAset(satkerId, aset.id, f)
      setPesan('Tersimpan.')
    } catch (e) {
      setPesan(e.message)
    }
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Info k="Akun" v={akunAset(aset)} />
        <Info k="Tanggal perolehan" v={tanggalID(aset.tglPerolehan)} />
        <Info k="Asal perolehan" v={aset.asalPerolehan} />
        <Info k="Kondisi" v={KONDISI[aset.kondisi]} />
        <Info k="Nilai perolehan" v={rupiah(aset.nilai)} />
        <Info k="Akumulasi penyusutan" v={rupiah(susut.akumulasi)} />
        <Info k="Nilai buku" v={rupiah(susut.nilaiBuku)} />
        <Info k="Masa manfaat" v={aset.masaManfaat ? `${aset.masaManfaat} tahun (${susut.semester} smt berjalan)` : 'Tidak disusutkan'} />
      </dl>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Merk / tipe"><Input value={f.merk} disabled={!bisaEdit} onChange={(e) => setF({ ...f, merk: e.target.value })} /></Field>
        <Field label="Lokasi ruangan (DBR)"><Input value={f.lokasiRuang} disabled={!bisaEdit} onChange={(e) => setF({ ...f, lokasiRuang: e.target.value })} /></Field>
        <Field label="Status penggunaan" hint={aset.pemanfaatan ? `Pemanfaatan: ${aset.pemanfaatan.jenis}, ${aset.pemanfaatan.durasiBulan} bln, SK ${aset.pemanfaatan.nomorSK || '-'}` : null}>
          <Select value={f.statusPenggunaan} disabled={!bisaEdit} onChange={(e) => setF({ ...f, statusPenggunaan: e.target.value })} options={Object.entries(STATUS_PENGGUNAAN).map(([value, label]) => ({ value, label }))} />
        </Field>
      </div>

      {kib && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">{kib.nama}</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {kib.field.map((fl) => (
              <Field key={fl.k} label={fl.l}>
                <Input type={fl.t || 'text'} disabled={!bisaEdit} value={f.kib[fl.k] ?? ''} onChange={(e) => setF({ ...f, kib: { ...f.kib, [fl.k]: e.target.value } })} />
              </Field>
            ))}
          </div>
        </div>
      )}

      {bisaEdit && (
        <div className="flex items-center gap-3">
          <Button onClick={simpan}>Simpan atribut</Button>
          <Link to={`/transaksi?aset=${aset.id}`}><Button variant="secondary">Catat transaksi untuk aset ini</Button></Link>
          {pesan && <span className="text-sm text-slate-600">{pesan}</span>}
        </div>
      )}
      {aset.kondisi === 'RB' && aset.status === 'aktif' && (
        <Alert>Aset rusak berat masih tercatat aktif di neraca. Ajukan usulan penghapusan/pemindahtanganan, lalu reklasifikasi ke Daftar Barang Rusak Berat.</Alert>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Riwayat transaksi</h4>
        <Table head={['Tanggal', 'Transaksi', 'Dokumen sumber', { label: 'Nilai', right: true }]} empty={riwayat.length ? null : 'Belum ada transaksi.'}>
          {riwayat.map((t) => (
            <tr key={t.id}>
              <Td>{tanggalID(t.tanggal)}</Td>
              <Td>{t.namaJenis}{t.keterangan && <span className="block text-xs text-slate-500">{t.keterangan}</span>}</Td>
              <Td className="text-xs">{t.dokumen?.jenis} {t.dokumen?.nomor}</Td>
              <Td right>{rupiah(t.nilai)}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}

const Info = ({ k, v }) => (
  <div>
    <dt className="text-xs text-slate-500">{k}</dt>
    <dd className="font-medium text-slate-800">{v || '—'}</dd>
  </div>
)
