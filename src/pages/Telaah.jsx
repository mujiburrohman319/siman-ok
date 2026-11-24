import { useEffect, useState } from 'react'
import { collectionGroup, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { setujuiUsulan, simpanRKBMN, tolakUsulan } from '../lib/db.js'
import { rupiah, tanggalID, validasiBarisPengadaan } from '../lib/bmn.js'
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Td, Textarea } from '../components/ui.jsx'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'

/** Antrean lintas satker: dokumen berstatus tertentu di sub-koleksi semua satker. */
function useAntrean(koleksi, status) {
  const [data, setData] = useState([])
  useEffect(
    () =>
      onSnapshot(
        query(collectionGroup(db, koleksi), where('status', '==', status)),
        (s) => setData(s.docs.map((d) => ({ id: d.id, satkerId: d.ref.parent.parent.id, ...d.data() }))),
        () => setData([]),
      ),
    [koleksi, status],
  )
  return data
}

export default function Telaah() {
  const satkerList = useCollection(['satker']).data
  const rkbmn = useAntrean('rkbmn', 'diajukan')
  const usulan = useAntrean('usulan', 'diajukan')
  const [buka, setBuka] = useState(null) // {tipe, item}
  const nama = (id) => satkerList.find((s) => s.id === id)
  const label = (id) => { const s = nama(id); return s ? `${s.kode} · ${s.nama}` : id }

  return (
    <>
      <PageHeader title="Penelaahan & Persetujuan" desc="Anda bertindak sebagai Pengelola Barang: menelaah RKBMN yang lulus reviu APIP dan memutus usulan pengelolaan BMN dari satker mahasiswa." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`RKBMN menunggu penelaahan (${rkbmn.length})`}>
          <Table head={['Satker', 'Dokumen', '']} empty={rkbmn.length ? null : 'Tidak ada antrean.'}>
            {rkbmn.map((r) => (
              <tr key={`${r.satkerId}-${r.id}`}>
                <Td>{label(r.satkerId)}</Td>
                <Td>RKBMN {r.jenis} TA {r.tahun}<span className="block text-xs text-slate-500">{r.baris?.length || 0} baris</span></Td>
                <Td><Button variant="secondary" onClick={() => setBuka({ tipe: 'rkbmn', item: r })}>Telaah</Button></Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title={`Usulan menunggu keputusan (${usulan.length})`}>
          <Table head={['Satker', 'Usulan', '']} empty={usulan.length ? null : 'Tidak ada antrean.'}>
            {usulan.map((u) => (
              <tr key={`${u.satkerId}-${u.id}`}>
                <Td>{label(u.satkerId)}</Td>
                <Td>{u.namaJenis}<span className="block text-xs text-slate-500">{u.ringkasAset?.length} aset · nilai buku {rupiah(u.nilaiBuku)}</span></Td>
                <Td><Button variant="secondary" onClick={() => setBuka({ tipe: 'usulan', item: u })}>Putuskan</Button></Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Modal open={!!buka} onClose={() => setBuka(null)} wide title={buka ? `${buka.tipe === 'rkbmn' ? 'Penelaahan RKBMN' : 'Keputusan usulan'} — ${label(buka.item.satkerId)}` : ''}>
        {buka?.tipe === 'rkbmn' && <PanelRKBMN r={buka.item} satker={nama(buka.item.satkerId)} selesai={() => setBuka(null)} />}
        {buka?.tipe === 'usulan' && <PanelUsulan u={buka.item} satker={nama(buka.item.satkerId)} selesai={() => setBuka(null)} />}
      </Modal>
    </>
  )
}

function PanelRKBMN({ r, satker, selesai }) {
  const { profil } = useAuth()
  const [baris, setBaris] = useState(r.baris || [])
  const [catatan, setCatatan] = useState('')
  const [err, setErr] = useState('')
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const ubah = (i, k) => setBaris(baris.map((b, j) => (j === i ? { ...b, keputusan: { ...(b.keputusan || {}), ...k } } : b)))
  const now = () => new Date().toISOString()
  const riwayat = (status, cat) => [...(r.riwayat || []), { status, oleh: profil.nama, waktu: now(), catatan: cat }]

  async function putus(status) {
    setErr('')
    if (status === 'disetujui' && baris.some((b) => !b.keputusan?.status)) return setErr('Beri keputusan untuk setiap baris.')
    if (status === 'dikembalikan' && !catatan) return setErr('Tuliskan catatan pengembalian.')
    const setuju = status === 'disetujui'
    if (!(await konfirmasi({
      judul: setuju ? 'Tetapkan Hasil Penelaahan RKBMN?' : 'Kembalikan RKBMN untuk direvisi?',
      pesan: setuju ? 'Dokumen ditandatangani Pengguna dan Pengelola Barang (simulasi) dan menjadi dasar usulan anggaran.' : 'Satker akan merevisi RKBMN sesuai catatan Anda.',
      ya: setuju ? 'Tetapkan' : 'Kembalikan',
    }))) return
    await simpanRKBMN(r.satkerId, r.id, {
      baris,
      status,
      telaah: { catatan, oleh: profil.nama, tanggal: now() },
      riwayat: riwayat(status, catatan),
      ...(status === 'disetujui'
        ? { tandaTangan: [
            { peran: 'Pengguna Barang (simulasi)', nama: `Penanggung jawab ${satker?.nama || 'satker'}`, tanggal: now() },
            { peran: 'Pengelola Barang (simulasi)', nama: profil.nama, tanggal: now() },
          ] }
        : {}),
    })
    toast.sukses(setuju ? 'Hasil Penelaahan RKBMN ditetapkan.' : 'RKBMN dikembalikan ke satker.')
    selesai()
  }

  return (
    <div className="space-y-4">
      {r.reviuApip && <Alert tone="slate"><b>CHR APIP ({r.reviuApip.oleh}):</b> {r.reviuApip.catatan}</Alert>}
      <Table head={r.jenis === 'pengadaan' ? ['Uraian', { label: 'Kebutuhan', right: true }, { label: 'Tersedia', right: true }, { label: 'Usulan', right: true }, 'Validasi', 'Keputusan'] : ['Aset', 'Uraian', { label: 'Biaya', right: true }, 'Keputusan']}>
        {baris.map((b, i) => (
          <tr key={b.id || b.asetId}>
            {r.jenis === 'pengadaan' ? (
              <>
                <Td>{b.uraian}<span className="block text-xs text-slate-500">{b.kodeProgram}</span></Td>
                <Td right>{b.kebutuhanSBSK}</Td>
                <Td right>{b.tersedia}</Td>
                <Td right>{b.usulan}</Td>
                <Td>{validasiBarisPengadaan(b).sesuai ? <Badge tone="teal">Sesuai</Badge> : <span className="text-xs text-rose-700">{validasiBarisPengadaan(b).catatan.join('; ')}</span>}</Td>
              </>
            ) : (
              <>
                <Td className="text-xs">{b.label}</Td>
                <Td>{b.uraian}</Td>
                <Td right>{rupiah(b.biaya)}</Td>
              </>
            )}
            <Td>
              <div className="flex flex-col gap-1">
                <Select value={b.keputusan?.status || ''} onChange={(e) => ubah(i, { status: e.target.value })} placeholder="—" options={[{ value: 'setuju', label: 'Setuju' }, { value: 'ubah', label: 'Setuju dengan perubahan' }, { value: 'tolak', label: 'Tolak' }]} className="w-48" />
                {b.keputusan?.status === 'ubah' && <Input type="number" min="0" placeholder={r.jenis === 'pengadaan' ? 'jumlah disetujui' : 'biaya disetujui'} value={b.keputusan?.jumlah || ''} onChange={(e) => ubah(i, { jumlah: e.target.value })} className="w-48" />}
                <Input placeholder="catatan" value={b.keputusan?.catatan || ''} onChange={(e) => ubah(i, { catatan: e.target.value })} className="w-48" />
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      <Field label="Catatan penelaahan"><Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Field>
      {err && <Alert tone="rose">{err}</Alert>}
      <div className="flex gap-2">
        <Button onClick={() => putus('disetujui')}>Terbitkan Hasil Penelaahan</Button>
        <Button variant="secondary" onClick={() => putus('dikembalikan')}>Kembalikan untuk revisi</Button>
      </div>
    </div>
  )
}

function PanelUsulan({ u, satker, selesai }) {
  const { user, ref } = useAuth()
  const { aset, satkerId } = useSatker()
  const tahun = new Date().getFullYear()
  const [nomorSK, setNomorSK] = useState(`SK-SIM/${satker?.kode || 'SATKER'}/${u.id.slice(0, 4).toUpperCase()}/${tahun}`)
  const [catatan, setCatatan] = useState('')
  const [err, setErr] = useState('')
  const [proses, setProses] = useState(false)
  const asetSatkerAktif = satkerId === u.satkerId
  const toast = useToast()
  const konfirmasi = useKonfirmasi()

  async function setujui() {
    setErr('')
    if (!(await konfirmasi({
      judul: `Setujui usulan ${u.namaJenis}?`,
      pesan: <>SK <b>{nomorSK}</b> terbit dan konsekuensinya langsung dibukukan pada {u.asetIds?.length || 0} aset satker. Transaksi yang dibukukan tidak dapat dibatalkan.</>,
      ya: 'Setujui & bukukan',
    }))) return
    setProses(true)
    try {
      await setujuiUsulan({ satkerId: u.satkerId, usulan: u, nomorSK, catatan, uid: user.uid, ref })
      toast.sukses(`Usulan ${u.namaJenis} disetujui (${nomorSK}).`)
      selesai()
    } catch (e) {
      setErr(e.message)
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-xs text-slate-500">Jenis</dt><dd className="font-medium">{u.namaJenis}</dd></div>
        <div><dt className="text-xs text-slate-500">Diajukan</dt><dd>{u.createdAt ? tanggalID(u.createdAt.toDate()) : '—'}</dd></div>
        {u.mitra && <div><dt className="text-xs text-slate-500">Mitra / penerima</dt><dd>{u.mitra}</dd></div>}
        {u.durasiBulan && <div><dt className="text-xs text-slate-500">Jangka waktu</dt><dd>{u.durasiBulan} bulan</dd></div>}
        {u.nilaiSewa && <div><dt className="text-xs text-slate-500">Nilai sewa</dt><dd>{rupiah(u.nilaiSewa)}</dd></div>}
        <div><dt className="text-xs text-slate-500">Nilai buku aset</dt><dd>{rupiah(u.nilaiBuku)}</dd></div>
      </dl>
      <div><p className="text-xs text-slate-500">Aset</p>{(u.ringkasAset || []).map((a) => <p key={a}>{a}</p>)}</div>
      {asetSatkerAktif && (u.asetIds || []).some((id) => aset.find((a) => a.id === id)?.status === 'dihapus') && <Alert tone="rose">Sebagian aset sudah dihapuskan.</Alert>}
      <div><p className="text-xs text-slate-500">Alasan</p><p>{u.alasan}</p></div>
      {u.dokumenPendukung && <div><p className="text-xs text-slate-500">Dokumen pendukung</p><p>{u.dokumenPendukung}</p></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nomor surat keputusan (simulasi)"><Input value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} /></Field>
        <Field label="Catatan"><Input value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Field>
      </div>
      <Alert tone="slate">Persetujuan akan otomatis membukukan transaksi (untuk pemindahtanganan/penghapusan) atau mengubah status penggunaan aset (untuk penggunaan/pemanfaatan).</Alert>
      {err && <Alert tone="rose">{err}</Alert>}
      <div className="flex gap-2">
        <Button onClick={setujui} disabled={proses || !nomorSK}>{proses ? 'Memproses…' : 'Setujui'}</Button>
        <Button variant="danger" onClick={async () => {
          if (!catatan) return setErr('Isi catatan alasan penolakan.')
          if (!(await konfirmasi({ judul: `Tolak usulan ${u.namaJenis}?`, pesan: 'Keputusan penolakan dikirim ke satker beserta catatan Anda.', ya: 'Tolak usulan', bahaya: true }))) return
          await tolakUsulan({ satkerId: u.satkerId, usulanId: u.id, catatan, uid: user.uid })
          toast.info('Usulan ditolak.')
          selesai()
        }}>Tolak</Button>
      </div>
    </div>
  )
}
