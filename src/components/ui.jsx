import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

const VARIAN = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-300',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

export function Button({ variant = 'primary', className = '', ...p }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${VARIAN[variant]} ${className}`}
    />
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100'

export const Input = (p) => <input {...p} className={`${inputCls} ${p.className || ''}`} />
export const Textarea = (p) => <textarea rows={3} {...p} className={`${inputCls} ${p.className || ''}`} />
export function Select({ options, placeholder, ...p }) {
  return (
    <select {...p} className={`${inputCls} ${p.className || ''}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

const BADGE = {
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  blue: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
}
export const Badge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>
)

export function Table({ head, children, empty, footer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-semibold ${typeof h === 'object' && h?.right ? 'text-right' : ''}`}>
                {typeof h === 'object' ? h.label : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
        {footer && <tfoot className="border-t-2 border-slate-200 font-semibold">{footer}</tfoot>}
      </table>
      {empty && <p className="py-8 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

export const Td = ({ right, className = '', ...p }) => (
  <td {...p} className={`px-3 py-2 align-top text-slate-700 ${right ? 'text-right tabular-nums' : ''} ${className}`} />
)

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12" onMouseDown={onClose}>
      <div className={`w-full rounded-xl bg-white shadow-xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Alert({ tone = 'amber', children }) {
  const c = { amber: 'border-amber-200 bg-amber-50 text-amber-900', rose: 'border-rose-200 bg-rose-50 text-rose-800', teal: 'border-teal-200 bg-teal-50 text-teal-900', slate: 'border-slate-200 bg-slate-50 text-slate-700' }[tone]
  return <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export function PageHeader({ title, desc, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:mb-2">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {desc && <p className="mt-0.5 max-w-3xl text-sm text-slate-500 print:hidden">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export const Loading = () => <p className="py-10 text-center text-sm text-slate-500">Memuat data…</p>
