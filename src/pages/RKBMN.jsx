import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useDoc } from '../lib/hooks.js'
import { rkbmnId, simpanRKBMN } from '../lib/db.js'
import { KODE_BARANG } from '../data/kodeBarang.js'
import { KONDISI, cekObjekPemeliharaan, rupiah, validasiBarisPengadaan } from '../lib/bmn.js'
import PerluSatker from '../components/PerluSatker.jsx'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Td, Textarea } from '../components/ui.jsx'
import { useToast } from '../components/umpan.jsx'
import { StatusRKBMN } from './Dashboard.jsx'
import { labelAset } from './Aset.jsx'

const uid = () => Math.random().toString(36).slice(2, 9)

export default function RKBMN() {
  const tahunIni = new Date().getFullYear()
  const [tahun, setTahun] = useState(tahunIni + 1)
  const [jenis, setJenis] = useState('pengadaan')
  return (
    <>
      <PageHeader
        title="Rencana Kebutuhan BMN"
        desc="RKBMN pengadaan dan pemeliharaan untuk satu tahun anggaran (PMK 150/2014). Disusun KPB, direviu APIP, lalu ditelaah Pengelola Barang."
        actions={
          <>
            <Select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} options={[tahunIni, tahunIni + 1, tahunIni + 2].map((t) => ({ value: t, label: `TA ${t}` }))} className="w-32" />
            <Select value={jenis} onChange={(e) => setJenis(e.target.value)} options={[{ value: 'pengadaan', label: 'Pengadaan' }, { value: 'pemeliharaan', label: 'Pemeliharaan' }]} className="w-40" />
          </>
        }
      />
      <PerluSatker><Dokumen key={`${tahun}-${jenis}`} tahun={tahun} jenis={jenis} /></PerluSatker>
    </>
  )
}

function Dokumen({ tahun, jenis }) {
  const { user, profil, isStaff } = useAuth()
  const { satkerId, satker } = useSatker()
  const id = rkbmnId(tahun, jenis)
  const { data: dok, loading } = useDoc(['satker', satkerId, 'rkbmn', id])
  const [baris, setBaris] = useState([])
  const [pesan, setPesan] = useState(null)
  const toast = useToast()
  const [chr, setChr] = useState('')

  useEffect(() => { if (!loading) setBaris(dok?.baris || []) }, [loading, dok?.updatedAt?.seconds]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = dok?.status || 'draft'
  const dapatEdit = !isStaff && ['draft', 'dikembalikan'].includes(status)
  const isApip = satker?.apipUids?.includes(user.uid)

  const riwayat = (s, catatan = '') => [...(dok?.riwayat || []), { status: s, oleh: profil.nama, waktu: new Date().toISOString(), catatan }]

  async function simpan(statusBaru = 'draft', extra = {}) {
    setPesan(null)
    try {
      // Dokumen baru selalu lahir sebagai draf (aturan keamanan), baru kemudian berpindah status
      if (!dok && statusBaru !== 'draft') await simpanRKBMN(satkerId, id, { tahun, jenis, baris, status: 'draft' })
      await simpanRKBMN(satkerId, id, {
        tahun, jenis, baris, status: statusBaru,
        ...(statusBaru !== status ? { riwayat: riwayat(statusBaru, extra.catatanRiwayat) } : {}),
        ...extra.patch,
      })
      toast.sukses({ draft: 'Draf tersimpan.', reviu_apip: 'RKBMN dikirim untuk reviu APIP.', diajukan: 'RKBMN diteruskan ke Pengelola Barang.' }[statusBaru] || 'Tersimpan.')
    } catch (e) {
      setPesan({ tone: 'rose', teks: e.message })
    }
  }

  if (loading) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusRKBMN status={status} />
        {status === 'dikembalikan' && dok?.telaah?.catatan && <Alert tone="rose">Catatan Pengelola Barang: {dok.telaah.catatan}</Alert>}
        {status === 'disetujui' && <Alert tone="teal">Hasil Penelaahan RKBMN telah ditandatangani Pengguna Barang dan Pengelola Barang. Dokumen ini menjadi dasar usulan anggaran.</Alert>}
      </div>

      {jenis === 'pengadaan'
        ? <TabelPengadaan baris={baris} setBaris={setBaris} edit={dapatEdit} />
        : <TabelPemeliharaan baris={baris} setBaris={setBaris} edit={dapatEdit} />}

      {pesan && <Alert tone={pesan.tone}>{pesan.teks}</Alert>}

      {dapatEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => simpan('draft')}>Simpan draf</Button>
          <Button disabled={!baris.length} onClick={() => simpan('reviu_apip')}>Kirim untuk reviu APIP</Button>
        </div>
      )}

      {status === 'reviu_apip' && (isApip || isStaff) && (
        <Card title="Reviu APIP — Catatan Hasil Reviu (CHR)">
          <p className="mb-3 text-sm text-slate-600">APIP mereviu kebenaran, kelengkapan, dan kepatuhan RKBMN terhadap kaidah perencanaan kebutuhan BMN.</p>
          <Textarea value={chr} onChange={(e) => setChr(e.target.value)} placeholder="Tuliskan temuan dan rekomendasi reviu…" />
          <div className="mt-3 flex gap-2">
            <Button disabled={!chr} onClick={() => simpan('diajukan', { patch: { reviuApip: { catatan: chr, oleh: profil.nama, tanggal: new Date().toISOString() } }, catatanRiwayat: 'Lulus reviu APIP' })}>Nyatakan telah direviu & teruskan ke Pengelola</Button>
            <Button variant="secondary" disabled={!chr} onClick={() => simpan('draft', { patch: { reviuApip: { catatan: chr, oleh: profil.nama, tanggal: new Date().toISOString() } }, catatanRiwayat: 'Dikembalikan APIP' })}>Kembalikan ke penyusun</Button>
          </div>
        </Card>
      )}
      {status === 'reviu_apip' && !isApip && !isStaff && <Alert tone="slate">Menunggu reviu oleh anggota yang ditunjuk sebagai APIP satker.</Alert>}

      {(dok?.reviuApip || dok?.riwayat?.length) && (
        <Card title="Jejak dokumen">
          {dok?.reviuApip && <p className="mb-2 text-sm"><span className="font-medium">CHR APIP ({dok.reviuApip.oleh}):</span> {dok.reviuApip.catatan}</p>}
          <ul className="space-y-1 text-xs text-slate-600">
            {(dok?.riwayat || []).map((r, i) => <li key={i}>{new Date(r.waktu).toLocaleString('id-ID')} — {r.oleh}: <b>{r.status}</b>{r.catatan ? ` (${r.catatan})` : ''}</li>)}
          </ul>
          {dok?.tandaTangan?.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {dok.tandaTangan.map((t, i) => (
                <div key={i} className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
                  <p className="text-xs text-slate-500">{t.peran}</p><p className="font-medium">{t.nama}</p><p className="text-xs text-slate-500">{new Date(t.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export function Keputusan({ k }) {
  if (!k?.status) return <span className="text-xs text-slate-400">—</span>
  const m = { setuju: ['teal', 'Disetujui'], tolak: ['rose', 'Ditolak'], ubah: ['amber', `Diubah: ${k.jumlah}`] }[k.status]
  return <div><Badge tone={m[0]}>{m[1]}</Badge>{k.catatan && <p className="mt-0.5 max-w-48 text-xs text-slate-500">{k.catatan}</p>}</div>
}

function TabelPengadaan({ baris, setBaris, edit }) {
  const { ref } = useAuth()
  const { aset } = useSatker()
  const sbskOpt = ref.sbsk.map((s) => ({ value: s.id, label: `${s.jenis} (${s.standar} ${s.satuan} ${s.dasar})` }))

  const hitung = (b) => {
    const s = ref.sbsk.find((x) => x.id === b.sbskId)
    const kebutuhanSBSK = s ? Math.ceil((Number(b.dasarJumlah) || 0) * s.standar) : Number(b.kebutuhanSBSK) || 0
    const pembanding = aset.filter((a) => a.status === 'aktif' && b.kodeBarang && a.kodeBarang === b.kodeBarang)
    const tersedia = pembanding.filter((a) => a.kondisi !== 'RB' && a.statusPenggunaan !== 'idle').length
    const idle = pembanding.filter((a) => a.statusPenggunaan === 'idle').length
    return { ...b, kebutuhanSBSK, tersedia, idle }
  }
  const rows = useMemo(() => baris.map(hitung), [baris, aset, ref]) // eslint-disable-line react-hooks/exhaustive-deps
  const ubah = (i, k, v) => setBaris(baris.map((b, j) => (j === i ? hitung({ ...b, [k]: v }) : b)))
  const total = rows.reduce((s, b) => s + (Number(b.usulan) || 0) * (Number(b.hargaSatuan) || 0), 0)

  return (
    <Card
      title="RKBMN Pengadaan"
      actions={edit && <Button variant="secondary" onClick={() => setBaris([...baris, { id: uid(), uraian: '', sbskId: '', dasarJumlah: '', kodeBarang: '', usulan: '', hargaSatuan: '', kodeProgram: '' }])}><Plus size={16} /> Tambah baris</Button>}
    >
      <p className="mb-3 text-xs text-slate-500">
        Objek: tanah/bangunan dan BMN selain tanah/bangunan yang sudah memiliki SBSK. Usulan maksimal = kebutuhan SBSK − BMN tersedia. Angka SBSK adalah angka latihan yang ditetapkan dosen.
      </p>
      <Table head={['Uraian kebutuhan', 'SBSK & dasar', 'Barang pembanding', { label: 'Kebutuhan', right: true }, { label: 'Tersedia', right: true }, { label: 'Usulan', right: true }, { label: 'Harga satuan', right: true }, 'Program/Kegiatan/Output', 'Validasi', 'Keputusan', '']} empty={rows.length ? null : 'Belum ada baris. Tambahkan kebutuhan.'}
        footer={rows.length ? <tr><Td colSpan={6}>Perkiraan total</Td><Td right>{rupiah(total)}</Td><Td colSpan={4} /></tr> : null}>
        {rows.map((b, i) => {
          const v = validasiBarisPengadaan(b)
          return (
            <tr key={b.id}>
              <Td><Input disabled={!edit} value={b.uraian} onChange={(e) => ubah(i, 'uraian', e.target.value)} className="w-44" /></Td>
              <Td>
                <Select disabled={!edit} value={b.sbskId} onChange={(e) => ubah(i, 'sbskId', e.target.value)} placeholder="— SBSK —" options={sbskOpt} className="w-52" />
                <Input disabled={!edit} type="number" min="0" placeholder="jumlah dasar (pegawai/pejabat)" value={b.dasarJumlah} onChange={(e) => ubah(i, 'dasarJumlah', e.target.value)} className="mt-1 w-52" />
              </Td>
              <Td><Select disabled={!edit} value={b.kodeBarang} onChange={(e) => ubah(i, 'kodeBarang', e.target.value)} placeholder="— kode barang —" options={KODE_BARANG.map((k) => ({ value: k.kode, label: `${k.kode} ${k.uraian}` }))} className="w-52" /></Td>
              <Td right>{b.kebutuhanSBSK}</Td>
              <Td right>{b.tersedia}{b.idle ? <span className="block text-xs text-amber-700">idle {b.idle}</span> : null}</Td>
              <Td><Input disabled={!edit} type="number" min="0" value={b.usulan} onChange={(e) => ubah(i, 'usulan', e.target.value)} className="w-20 text-right" /></Td>
              <Td><Input disabled={!edit} type="number" min="0" value={b.hargaSatuan} onChange={(e) => ubah(i, 'hargaSatuan', e.target.value)} className="w-32 text-right" /></Td>
              <Td><Input disabled={!edit} value={b.kodeProgram} placeholder="mis. 023.12.DL.4471.EBA" onChange={(e) => ubah(i, 'kodeProgram', e.target.value)} className="w-44" /></Td>
              <Td>{v.sesuai ? <Badge tone="teal">Sesuai</Badge> : <ul className="max-w-56 list-disc pl-4 text-xs text-rose-700">{v.catatan.map((c) => <li key={c}>{c}</li>)}</ul>}</Td>
              <Td><Keputusan k={b.keputusan} /></Td>
              <Td>{edit && <button onClick={() => setBaris(baris.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" aria-label="Hapus baris"><Trash2 size={16} /></button>}</Td>
            </tr>
          )
        })}
      </Table>
    </Card>
  )
}

function TabelPemeliharaan({ baris, setBaris, edit }) {
  const { ref } = useAuth()
  const { aset } = useSatker()
  const [lihatTidak, setLihatTidak] = useState(false)
  const kandidat = aset.filter((a) => a.status !== 'dihapus').map((a) => ({ a, cek: cekObjekPemeliharaan(a, ref) }))
  const boleh = kandidat.filter((k) => k.cek.boleh)
  const tidak = kandidat.filter((k) => !k.cek.boleh)
  const dipilih = (id) => baris.find((b) => b.asetId === id)
  const toggle = (a) => (dipilih(a.id) ? setBaris(baris.filter((b) => b.asetId !== a.id)) : setBaris([...baris, { asetId: a.id, label: labelAset(a), kondisi: a.kondisi, biaya: '', uraian: '' }]))
  const ubah = (id, k, v) => setBaris(baris.map((b) => (b.asetId === id ? { ...b, [k]: v } : b)))

  return (
    <Card title="RKBMN Pemeliharaan" actions={<label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={lihatTidak} onChange={(e) => setLihatTidak(e.target.checked)} /> Tampilkan aset yang tidak dapat diusulkan</label>}>
      <p className="mb-3 text-xs text-slate-500">
        Disusun dari Daftar Barang. Objek: tanah dan/atau bangunan, alat angkutan bermotor, dan BMN lain bernilai ≥ {rupiah(ref.batasPemeliharaan)} per unit.
        Tidak dapat diusulkan untuk BMN rusak berat, dalam penggunaan sementara, dioperasikan pihak lain, atau sedang dimanfaatkan (kecuali pinjam pakai &lt; 6 bulan).
      </p>
      <Table head={['', 'Aset', 'Kondisi', { label: 'Nilai', right: true }, 'Uraian pemeliharaan', { label: 'Perkiraan biaya', right: true }, 'Keputusan']} empty={boleh.length ? null : 'Tidak ada aset yang memenuhi syarat objek pemeliharaan.'}>
        {boleh.map(({ a }) => {
          const b = dipilih(a.id)
          return (
            <tr key={a.id} className={b ? 'bg-brand-50/50' : ''}>
              <Td><input type="checkbox" disabled={!edit} checked={!!b} onChange={() => toggle(a)} aria-label="Pilih aset" /></Td>
              <Td>{labelAset(a)}</Td>
              <Td>{KONDISI[a.kondisi]}</Td>
              <Td right>{rupiah(a.nilai)}</Td>
              <Td>{b && <Input disabled={!edit} value={b.uraian} onChange={(e) => ubah(a.id, 'uraian', e.target.value)} placeholder="mis. servis berkala, cat ulang" className="w-56" />}</Td>
              <Td>{b && <Input disabled={!edit} type="number" min="0" value={b.biaya} onChange={(e) => ubah(a.id, 'biaya', e.target.value)} className="w-36 text-right" />}</Td>
              <Td><Keputusan k={b?.keputusan} /></Td>
            </tr>
          )
        })}
      </Table>
      {lihatTidak && (
        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Tidak dapat diusulkan ({tidak.length})</h4>
          <Table head={['Aset', 'Alasan']}>
            {tidak.map(({ a, cek }) => <tr key={a.id}><Td>{labelAset(a)}</Td><Td className="text-xs text-rose-700">{cek.alasan.join('; ')}</Td></tr>)}
          </Table>
        </div>
      )}
      <Field label="" className="mt-3">
        <p className="text-sm text-slate-600">Total perkiraan biaya: <b>{rupiah(baris.reduce((s, b) => s + (Number(b.biaya) || 0), 0))}</b></p>
      </Field>
    </Card>
  )
}
