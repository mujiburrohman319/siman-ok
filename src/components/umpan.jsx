// Umpan balik antarmuka: toast singkat setelah aksi dan dialog konfirmasi sebelum aksi yang tidak dapat dibatalkan.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { Button } from './ui.jsx'

const Ctx = createContext(null)

const IKON = { sukses: CheckCircle2, galat: XCircle, info: Info }
const WARNA = { sukses: 'text-brand-600', galat: 'text-rose-600', info: 'text-sky-600' }

export function UmpanProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const seq = useRef(0)

  const tutupToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const tampil = useCallback((jenis, pesan) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-3), { id, jenis, pesan }])
    setTimeout(() => tutupToast(id), jenis === 'galat' ? 7000 : 4000)
  }, [tutupToast])

  const toast = useRef(null)
  toast.current ??= {
    sukses: (p) => tampil('sukses', p),
    galat: (p) => tampil('galat', p?.message || p),
    info: (p) => tampil('info', p),
  }

  /** konfirmasi({ judul, pesan, ya, bahaya }) → Promise<boolean> */
  const konfirmasi = useCallback((opsi) => new Promise((resolve) => setDialog({ ...opsi, resolve })), [])
  const jawab = (v) => { dialog?.resolve(v); setDialog(null) }

  return (
    <Ctx.Provider value={{ toast: toast.current, konfirmasi }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end print:hidden" aria-live="polite">
        {toasts.map((t) => {
          const I = IKON[t.jenis]
          return (
            <div key={t.id} role={t.jenis === 'galat' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl bg-white p-3.5 text-sm shadow-pop ring-1 ring-slate-900/10">
              <I size={18} className={`mt-0.5 shrink-0 ${WARNA[t.jenis]}`} />
              <p className="flex-1 text-slate-800">{t.pesan}</p>
              <button onClick={() => tutupToast(t.id)} className="-m-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup"><X size={14} /></button>
            </div>
          )
        })}
      </div>
      {dialog && <Dialog {...dialog} onJawab={jawab} />}
    </Ctx.Provider>
  )
}

function Dialog({ judul, pesan, ya = 'Lanjutkan', tidak = 'Batal', bahaya, onJawab }) {
  const tombol = useRef(null)
  useEffect(() => {
    tombol.current?.focus()
    const h = (e) => e.key === 'Escape' && onJawab(false)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onJawab])
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={() => onJawab(false)} role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md animate-pop-in rounded-2xl bg-white p-5 shadow-pop ring-1 ring-slate-900/10" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${bahaya ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}><AlertTriangle size={20} /></span>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{judul}</h3>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{pesan}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onJawab(false)}>{tidak}</Button>
          <Button ref={tombol} variant={bahaya ? 'danger' : 'primary'} onClick={() => onJawab(true)}>{ya}</Button>
        </div>
      </div>
    </div>
  )
}

export const useToast = () => useContext(Ctx).toast
export const useKonfirmasi = () => useContext(Ctx).konfirmasi
