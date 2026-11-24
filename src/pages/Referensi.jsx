import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileUp, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { hapusKodefikasi, simpanKodefikasi, simpanReferensi } from '../lib/db.js'
import { KODE_BARANG, daftarKode } from '../data/kodeBarang.js'
import { keCSV, parseKodefikasi } from '../lib/kodefikasi.js'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'
import { REFERENSI_DEFAULT, rupiah } from '../lib/bmn.js'
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Paging, Table, Td, usePaging } from '../components/ui.jsx'

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

        <Kodefikasi />
      </div>
    </>
  )
}

function Kodefikasi() {
  const { kodefikasi, profil } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const input = useRef(null)
  const [cari, setCari] = useState('')
  const [hasil, setHasil] = useState(null) // {nama, data, galat}
  const [proses, setProses] = useState(false)
  const aktif = daftarKode()
  const list = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return q ? aktif.filter((k) => `${k.kode} ${k.uraian}`.toLowerCase().includes(q)) : aktif
  }, [aktif, cari, kodefikasi]) // eslint-disable-line react-hooks/exhaustive-deps
  const paging = usePaging(list, 25)

  function unduhCSV() {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + keCSV(aktif)], { type: 'text/csv;charset=utf-8' }))
    Object.assign(document.createElement('a'), { href: url, download: kodefikasi ? 'kodefikasi-aktif.csv' : 'templat-kodefikasi.csv' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function pilih(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    setHasil({ nama: f.name, ...parseKodefikasi(await f.text()) })
  }

  async function terapkan() {
    if (!(await konfirmasi({
      judul: `Terapkan ${hasil.data.length.toLocaleString('id-ID')} kode barang?`,
      pesan: <>Kodefikasi aktif untuk semua satker diganti. Masa manfaat baru berlaku untuk aset yang diperoleh setelah ini; aset lama tetap memakai masa manfaat saat dicatat.{hasil.galat.length ? <> <b>{hasil.galat.length} baris bergalat</b> akan dilewati.</> : null}</>,
      ya: 'Terapkan',
    }))) return
    setProses(true)
    try {
      await simpanKodefikasi(hasil.data, { sumber: hasil.nama, oleh: profil.nama, lamaBagian: kodefikasi?.jumlahBagian || 0 })
      toast.sukses('Kodefikasi resmi diterapkan.')
      setHasil(null)
    } catch (e) {
      toast.galat(e)
    } finally {
      setProses(false)
    }
  }

  async function kembalikan() {
    if (!(await konfirmasi({ judul: 'Kembali ke kodefikasi contoh?', pesan: 'Kodefikasi hasil impor dihapus; aplikasi memakai daftar contoh bawaan.', ya: 'Kembalikan', bahaya: true }))) return
    await hapusKodefikasi(kodefikasi?.jumlahBagian || 0)
    toast.info('Kodefikasi contoh dipakai kembali.')
  }

  return (
    <Card className="lg:col-span-2" title={`Kodefikasi barang (${aktif.length.toLocaleString('id-ID')})`}
      desc={kodefikasi ? `Resmi: ${kodefikasi.sumber} · diimpor ${new Date(kodefikasi.tanggal).toLocaleDateString('id-ID')} oleh ${kodefikasi.oleh}` : `Daftar contoh bawaan (${KODE_BARANG.length} kode) — ganti dengan tabel resmi`}
      actions={<>
        <Button size="sm" variant="secondary" onClick={unduhCSV}><Download size={14} /> {kodefikasi ? 'Unduh CSV' : 'Unduh templat CSV'}</Button>
        <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pilih} />
        <Button size="sm" onClick={() => input.current?.click()}><FileUp size={14} /> Impor CSV</Button>
        {kodefikasi && <Button size="sm" variant="ghost" onClick={kembalikan}><RotateCcw size={14} /> Pakai contoh</Button>}
      </>}>
      {hasil && (
        <div className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{hasil.nama}</p>
            <Badge tone="teal">{hasil.data.length.toLocaleString('id-ID')} kode valid</Badge>
            {hasil.galat.length > 0 && <Badge tone="rose">{hasil.galat.length} baris bergalat</Badge>}
          </div>
          {hasil.galat.length > 0 && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
              {hasil.galat.slice(0, 100).map((g, i) => <li key={i}>Baris {g.baris}: {g.pesan}</li>)}
              {hasil.galat.length > 100 && <li>… dan {hasil.galat.length - 100} lainnya</li>}
            </ul>
          )}
          {hasil.data.length > 0 && <p className="text-xs text-slate-500">Contoh: {hasil.data.slice(0, 3).map((k) => `${k.kode} ${k.uraian}`).join(' · ')}</p>}
          <div className="flex gap-2">
            <Button onClick={terapkan} disabled={proses || !hasil.data.length}>{proses ? 'Menyimpan…' : 'Terapkan kodefikasi'}</Button>
            <Button variant="ghost" onClick={() => setHasil(null)}>Batal</Button>
          </div>
        </div>
      )}
      <p className="mb-3 text-xs text-slate-500">Format CSV: kolom <code>kode;uraian;kib;masa_manfaat;aab</code> (pemisah ; , atau tab). KIB: tanah, gedung, bangunan_air, aab, alat_besar, atau kosong. Masa manfaat dalam tahun sesuai KMK yang berlaku.</p>
      <label className="relative mb-3 block max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Cari kode atau uraian…" value={cari} onChange={(e) => setCari(e.target.value)} className="w-full pl-9" />
      </label>
      <Table head={['Kode', 'Uraian', 'KIB', { label: 'Masa manfaat', right: true }]} empty={list.length ? null : 'Tidak ada kode yang cocok.'}>
        {paging.isi.map((k) => <tr key={k.kode}><Td className="font-mono text-xs">{k.kode}</Td><Td>{k.uraian}</Td><Td>{k.kib || '—'}</Td><Td right>{k.masaManfaat ? `${k.masaManfaat} th` : '—'}</Td></tr>)}
      </Table>
      <Paging {...paging} />
    </Card>
  )
}
