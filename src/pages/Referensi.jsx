import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { simpanReferensi } from '../lib/db.js'
import { KODE_BARANG } from '../data/kodeBarang.js'
import { REFERENSI_DEFAULT, rupiah } from '../lib/bmn.js'
import { Alert, Button, Card, Field, Input, PageHeader, Table, Td } from '../components/ui.jsx'

export default function Referensi() {
  const { ref } = useAuth()
  const [f, setF] = useState(ref)
  const [pesan, setPesan] = useState('')
  useEffect(() => setF(ref), [ref])

  const ubahSbsk = (i, k, v) => setF({ ...f, sbsk: f.sbsk.map((s, j) => (j === i ? { ...s, [k]: k === 'standar' ? Number(v) : v } : s)) })

  async function simpan() {
    await simpanReferensi({ batasKapitalisasi: f.batasKapitalisasi, batasPemeliharaan: Number(f.batasPemeliharaan), sbsk: f.sbsk, tahunAnggaran: f.tahunAnggaran ? Number(f.tahunAnggaran) : null })
    setPesan('Referensi tersimpan dan langsung berlaku untuk semua satker.')
  }

  return (
    <>
      <PageHeader title="Referensi" desc="Aturan validasi disimpan sebagai data agar dapat disesuaikan bila regulasi berubah, tanpa mengubah kode aplikasi." actions={<Button onClick={simpan}>Simpan referensi</Button>} />
      {pesan && <div className="mb-4"><Alert tone="teal">{pesan}</Alert></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Batas nilai">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kapitalisasi Peralatan & Mesin (Rp)" hint={rupiah(f.batasKapitalisasi.peralatan)}>
              <Input type="number" value={f.batasKapitalisasi.peralatan} onChange={(e) => setF({ ...f, batasKapitalisasi: { ...f.batasKapitalisasi, peralatan: Number(e.target.value) } })} />
            </Field>
            <Field label="Kapitalisasi Gedung & Bangunan (Rp)" hint={rupiah(f.batasKapitalisasi.gedung)}>
              <Input type="number" value={f.batasKapitalisasi.gedung} onChange={(e) => setF({ ...f, batasKapitalisasi: { ...f.batasKapitalisasi, gedung: Number(e.target.value) } })} />
            </Field>
            <Field label="Objek RKBMN pemeliharaan, nilai per unit ≥ (Rp)" hint="PMK 150/2014: Rp100 juta">
              <Input type="number" value={f.batasPemeliharaan} onChange={(e) => setF({ ...f, batasPemeliharaan: e.target.value })} />
            </Field>
            <Field label="Tahun anggaran berjalan (simulasi)" hint={`Kosong = tahun kalender (${new Date().getFullYear()}). Menentukan kapan usulan perubahan RKBMN dapat diajukan.`}>
              <Input type="number" min="2000" placeholder={String(new Date().getFullYear())} value={f.tahunAnggaran ?? ''} onChange={(e) => setF({ ...f, tahunAnggaran: e.target.value })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-slate-500">Nilai bawaan: Rp{REFERENSI_DEFAULT.batasKapitalisasi.peralatan.toLocaleString('id-ID')} dan Rp{REFERENSI_DEFAULT.batasKapitalisasi.gedung.toLocaleString('id-ID')}. Sesuaikan dengan ketentuan kapitalisasi terbaru yang Anda ajarkan. Perubahan hanya berlaku untuk transaksi berikutnya.</p>
        </Card>

        <Card title="Standar Barang dan Standar Kebutuhan (latihan)" actions={<Button variant="secondary" onClick={() => setF({ ...f, sbsk: [...f.sbsk, { id: Math.random().toString(36).slice(2, 8), jenis: '', satuan: 'unit', dasar: '', standar: 1 }] })}><Plus size={16} /> Tambah</Button>}>
          <Alert>Angka bawaan adalah contoh untuk latihan, bukan angka regulasi. Ganti sesuai PMK SBSK yang dibahas di kelas.</Alert>
          <div className="mt-3">
            <Table head={['Jenis', 'Dasar', { label: 'Standar', right: true }, 'Satuan', '']}>
              {f.sbsk.map((s, i) => (
                <tr key={s.id}>
                  <Td><Input value={s.jenis} onChange={(e) => ubahSbsk(i, 'jenis', e.target.value)} className="w-48" /></Td>
                  <Td><Input value={s.dasar} onChange={(e) => ubahSbsk(i, 'dasar', e.target.value)} className="w-36" /></Td>
                  <Td><Input type="number" step="0.1" value={s.standar} onChange={(e) => ubahSbsk(i, 'standar', e.target.value)} className="w-20 text-right" /></Td>
                  <Td><Input value={s.satuan} onChange={(e) => ubahSbsk(i, 'satuan', e.target.value)} className="w-16" /></Td>
                  <Td><button onClick={() => setF({ ...f, sbsk: f.sbsk.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600" aria-label="Hapus"><Trash2 size={16} /></button></Td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>

        <Card title={`Kodefikasi barang contoh (${KODE_BARANG.length})`} className="lg:col-span-2">
          <p className="mb-3 text-xs text-slate-500">Daftar ilustratif di <code>src/data/kodeBarang.js</code>. Untuk memakai tabel resmi, ganti file tersebut (lihat CLAUDE.md).</p>
          <Table head={['Kode', 'Uraian', 'KIB', { label: 'Masa manfaat', right: true }]}>
            {KODE_BARANG.map((k) => <tr key={k.kode}><Td className="font-mono text-xs">{k.kode}</Td><Td>{k.uraian}</Td><Td>{k.kib || '—'}</Td><Td right>{k.masaManfaat ? `${k.masaManfaat} th` : '—'}</Td></tr>)}
          </Table>
        </Card>
      </div>
    </>
  )
}
