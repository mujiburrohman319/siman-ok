import { forwardRef, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Inbox, Loader2, X } from 'lucide-react'

/** Gabung kelas; jika pemanggil memberi lebar sendiri (w-*), lebar bawaan dibuang. */
const lebar = (cls = '') => (/(^|\s)(w-|max-w-|min-w-|flex-1)/.test(cls) ? '' : 'w-full')

export function Card({ title, desc, icon: Icon, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`rounded-2xl bg-white shadow-card ring-1 ring-slate-900/[0.06] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <Icon size={16} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
              {desc && <p className="text-xs text-slate-500">{desc}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

const VARIAN = {
  primary:
    'bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  secondary:
    'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400 disabled:hover:bg-white',
  danger: 'bg-rose-600 text-white shadow-sm shadow-rose-900/20 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
}
const UKURAN = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', lg: 'h-10 px-4 text-sm' }

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', className = '', ...p }, ref) {
  return (
    <button
      ref={ref}
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${UKURAN[size]} ${VARIAN[variant]} ${className}`}
    />
  )
})

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition placeholder:text-slate-400 hover:ring-slate-400 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:ring-slate-200'

export const Input = (p) => <input {...p} className={`${inputCls} ${lebar(p.className)} ${p.className || ''}`} />
export const Textarea = (p) => <textarea rows={3} {...p} className={`${inputCls} ${lebar(p.className)} ${p.className || ''}`} />
export function Select({ options, placeholder, ...p }) {
  return (
    <select {...p} className={`${inputCls} cursor-pointer ${lebar(p.className)} ${p.className || ''}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

const BADGE = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  teal: 'bg-brand-50 text-brand-800 ring-brand-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
}
const DOT = { slate: 'bg-slate-400', teal: 'bg-brand-500', amber: 'bg-amber-500', rose: 'bg-rose-500', blue: 'bg-sky-500' }
export const Badge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[tone]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
    {children}
  </span>
)

export function Table({ head, children, empty, footer }) {
  return (
    <div className="scrollbar-thin -mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            {head.map((h, i) => (
              <th
                key={i}
                className={`whitespace-nowrap border-y border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold first:rounded-l-lg first:border-l last:rounded-r-lg last:border-r ${typeof h === 'object' && h?.right ? 'text-right' : ''}`}
              >
                {typeof h === 'object' ? h.label : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/70">{children}</tbody>
        {footer && <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">{footer}</tfoot>}
      </table>
      {empty && <Kosong>{empty}</Kosong>}
    </div>
  )
}

export const Td = ({ right, className = '', ...p }) => (
  <td {...p} className={`px-3 py-2.5 align-top text-slate-700 ${right ? 'whitespace-nowrap text-right tabular-nums' : ''} ${className}`} />
)

export function Kosong({ children, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400"><Icon size={20} /></span>
      <p className="max-w-sm text-sm text-slate-500">{children}</p>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-start justify-center overflow-y-auto bg-slate-950/50 p-3 pt-10 backdrop-blur-[2px] sm:p-6 sm:pt-16"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full animate-pop-in rounded-2xl bg-white shadow-pop ring-1 ring-slate-900/10 ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold leading-snug text-slate-900">{title}</h3>
          <button onClick={onClose} className="-m-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Alert({ tone = 'amber', children }) {
  const c = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900 before:bg-amber-400',
    rose: 'border-rose-200 bg-rose-50 text-rose-800 before:bg-rose-500',
    teal: 'border-brand-200 bg-brand-50 text-brand-900 before:bg-brand-500',
    slate: 'border-slate-200 bg-white text-slate-700 before:bg-slate-300',
  }[tone]
  return (
    <div className={`relative overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 text-sm before:absolute before:inset-y-0 before:left-0 before:w-1 ${c}`}>
      {children}
    </div>
  )
}

export function PageHeader({ title, desc, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:mb-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {desc && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500 print:hidden">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  )
}

const STAT_TONE = {
  teal: 'bg-brand-50 text-brand-700 ring-brand-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
}
export function Stat({ label, value, sub, icon: Icon, tone = 'teal' }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/[0.06] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {Icon && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ${STAT_TONE[tone]}`}><Icon size={16} /></span>}
      </div>
      <p className="mt-2 break-words text-lg font-semibold tracking-tight tabular-nums text-slate-900 sm:text-xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

/** Tab bersegmen (pil) yang bisa digulir horizontal di layar sempit. */
export function Tabs({ items, value, onChange }) {
  return (
    <div className="scrollbar-thin -mx-1 mb-5 overflow-x-auto px-1 print:hidden">
      <div className="inline-flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {items.map(([k, l]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === k ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

export const Loading = () => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
    <Loader2 size={18} className="animate-spin text-brand-600" /> Memuat data…
  </div>
)

/** Halaman bertahap untuk daftar panjang. Kembali ke halaman 1 bila panjang daftar berubah (mis. filter). */
export function usePaging(list, ukuran = 25) {
  const [hal, setHal] = useState(1)
  const jumlahHal = Math.max(1, Math.ceil(list.length / ukuran))
  useEffect(() => { setHal(1) }, [list.length])
  const aktif = Math.min(hal, jumlahHal)
  const isi = useMemo(() => list.slice((aktif - 1) * ukuran, aktif * ukuran), [list, aktif, ukuran])
  return { isi, hal: aktif, jumlahHal, setHal, total: list.length, ukuran }
}

export function Paging({ hal, jumlahHal, setHal, total, ukuran }) {
  if (total <= ukuran) return null
  const dari = (hal - 1) * ukuran + 1
  const sampai = Math.min(hal * ukuran, total)
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 print:hidden">
      <span>{dari}–{sampai} dari {total}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={hal <= 1} onClick={() => setHal(hal - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={15} /></Button>
        <span className="px-2 tabular-nums">{hal} / {jumlahHal}</span>
        <Button size="sm" variant="secondary" disabled={hal >= jumlahHal} onClick={() => setHal(hal + 1)} aria-label="Halaman berikutnya"><ChevronRight size={15} /></Button>
      </div>
    </div>
  )
}

/** Tombol Excel + PDF. laporan = fungsi yang mengembalikan data laporan (lihat src/lib/ekspor.js). */
export function TombolEkspor({ nama, laporan, tandaTangan }) {
  const [proses, setProses] = useState(false)
  async function jalankan(jenis) {
    setProses(true)
    try {
      const m = await import('../lib/ekspor.js')
      if (jenis === 'xlsx') m.unduhExcel(nama, laporan())
      else await m.unduhPDF(nama, laporan(), { tandaTangan })
    } finally {
      setProses(false)
    }
  }
  return (
    <div className="flex gap-1.5 print:hidden">
      <Button size="sm" variant="secondary" disabled={proses} onClick={() => jalankan('xlsx')}><FileSpreadsheet size={14} /> Excel</Button>
      <Button size="sm" variant="secondary" disabled={proses} onClick={() => jalankan('pdf')}><FileDown size={14} /> PDF</Button>
    </div>
  )
}
