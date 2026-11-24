import { useId } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { cariKode, daftarKode } from '../data/kodeBarang.js'
import { Input } from './ui.jsx'

/** Pilih kode barang dengan pencarian (datalist) — tetap ringan untuk ribuan kode resmi. */
export default function PilihKode({ value, onChange, className = '', ...p }) {
  useAuth() // render ulang saat kodefikasi aktif berganti
  const id = useId()
  const k = cariKode(value)
  const salah = value && !k
  return (
    <div className={className}>
      <Input
        {...p}
        list={id}
        value={value || ''}
        placeholder="Ketik kode atau nama barang…"
        onChange={(e) => onChange(e.target.value.split(' ')[0])}
        className={`w-full font-mono ${salah ? 'ring-rose-400' : ''}`}
        autoComplete="off"
      />
      <datalist id={id}>
        {daftarKode().map((x) => <option key={x.kode} value={x.kode}>{x.uraian}</option>)}
      </datalist>
      <p className={`mt-1 truncate text-xs ${salah ? 'text-rose-600' : 'text-slate-500'}`}>{k ? k.uraian : salah ? 'Kode tidak ada di kodefikasi aktif' : ' '}</p>
    </div>
  )
}
