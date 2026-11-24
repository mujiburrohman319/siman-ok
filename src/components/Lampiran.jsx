import { useRef, useState } from 'react'
import { where } from 'firebase/firestore'
import { Eye, FileText, ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { ambilLampiran, hapusLampiran, unggahLampiran } from '../lib/db.js'
import { TIPE_DIIZINKAN, base64KeBlob, bacaBase64, formatUkuran, kompresGambar, validasiBerkas } from '../lib/lampiran.js'
import { tanggalID } from '../lib/bmn.js'
import { Button } from './ui.jsx'
import { useKonfirmasi, useToast } from './umpan.jsx'

/** Daftar + unggah lampiran untuk satu aset atau transaksi. induk = {tipe: 'aset'|'transaksi', id} */
export default function Lampiran({ induk, bolehUnggah = true, judul }) {
  const { user, isStaff } = useAuth()
  const { satkerId } = useSatker()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const input = useRef(null)
  const { data } = useCollection(['satker', satkerId, 'lampiran'], [where('induk.id', '==', induk.id)], [induk.id])
  const [proses, setProses] = useState('')

  async function pilih(e) {
    const files = [...e.target.files]
    e.target.value = ''
    for (const asli of files) {
      setProses(`Mengunggah ${asli.name}…`)
      try {
        const file = await kompresGambar(asli)
        const salah = validasiBerkas(file)
        if (salah) { toast.galat(`${asli.name}: ${salah}`); continue }
        await unggahLampiran({ satkerId, induk, nama: asli.name, tipe: file.type, ukuran: file.size, base64: await bacaBase64(file), uid: user.uid })
        toast.sukses(`${asli.name} terunggah${file.size < asli.size ? ` (dikompres ke ${formatUkuran(file.size)})` : ''}.`)
      } catch (err) {
        toast.galat(err)
      }
    }
    setProses('')
  }

  async function lihat(l) {
    setProses(`Membuka ${l.nama}…`)
    try {
      const url = URL.createObjectURL(base64KeBlob(await ambilLampiran(satkerId, l), l.tipe))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.galat(err)
    } finally {
      setProses('')
    }
  }

  async function hapus(l) {
    if (!(await konfirmasi({ judul: `Hapus ${l.nama}?`, pesan: 'Lampiran dihapus permanen.', ya: 'Hapus', bahaya: true }))) return
    await hapusLampiran(satkerId, l)
    toast.info('Lampiran dihapus.')
  }

  const urut = [...data].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Paperclip size={15} /> {judul || (induk.tipe === 'aset' ? 'Foto & dokumen aset' : 'Dokumen sumber')} ({data.length})</h4>
        {bolehUnggah && (
          <>
            <input ref={input} type="file" multiple accept={Object.keys(TIPE_DIIZINKAN).join(',')} className="hidden" onChange={pilih} />
            <Button size="sm" variant="secondary" disabled={!!proses} onClick={() => input.current?.click()}><Upload size={14} /> Unggah</Button>
          </>
        )}
      </div>
      {proses && <p className="mb-2 text-xs text-brand-700">{proses}</p>}
      {urut.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {urut.map((l) => {
            const Ikon = l.tipe === 'application/pdf' ? FileText : ImageIcon
            const bolehHapus = isStaff || (l.dibuatOleh === user.uid && l.induk?.tipe === 'aset')
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Ikon size={18} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{l.nama}</p>
                  <p className="text-xs text-slate-500">{TIPE_DIIZINKAN[l.tipe]} · {formatUkuran(l.ukuran)}{l.createdAt ? ` · ${tanggalID(l.createdAt.toDate())}` : ''}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => lihat(l)} aria-label={`Lihat ${l.nama}`}><Eye size={15} /></Button>
                {bolehHapus && <Button size="sm" variant="ghost" onClick={() => hapus(l)} aria-label={`Hapus ${l.nama}`}><Trash2 size={15} /></Button>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
          Belum ada lampiran. {bolehUnggah && 'JPG, PNG, WEBP, atau PDF, maks. 2 MB; foto dikompres otomatis.'}
        </p>
      )}
      {induk.tipe === 'transaksi' && bolehUnggah && <p className="mt-1.5 text-xs text-slate-400">Lampiran transaksi tidak dapat dihapus karena bagian dari jejak audit.</p>}
    </div>
  )
}
