import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Boxes, ArrowLeftRight, FileBarChart, ClipboardList, Send, ScanSearch, Gavel, School, Settings2, LogOut, Menu, X,
  FlaskConical, Building2, ChevronsUpDown, ShieldCheck, BookOpenCheck, Package,
} from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'
import { Loading } from './ui.jsx'

const MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/skenario', label: 'Skenario Kasus', icon: BookOpenCheck },
  { grup: 'Penatausahaan' },
  { to: '/aset', label: 'Daftar Aset & KIB', icon: Boxes },
  { to: '/transaksi', label: 'Transaksi BMN', icon: ArrowLeftRight },
  { to: '/persediaan', label: 'Persediaan', icon: Package },
  { to: '/inventarisasi', label: 'Inventarisasi', icon: ScanSearch },
  { to: '/laporan', label: 'Laporan', icon: FileBarChart },
  { to: '/wasdal', label: 'Wasdal', icon: ShieldCheck },
  { grup: 'Perencanaan & Pengelolaan' },
  { to: '/rkbmn', label: 'RKBMN', icon: ClipboardList },
  { to: '/usulan', label: 'Usulan Pengelolaan', icon: Send },
]
const MENU_DOSEN = [
  { grup: 'Pengelola Barang (Dosen)' },
  { to: '/telaah', label: 'Penelaahan & Persetujuan', icon: Gavel },
  { to: '/kelas', label: 'Kelas & Satker', icon: School },
  { to: '/referensi', label: 'Referensi', icon: Settings2 },
]

const inisial = (nama = '') => nama.split(' ').filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.')).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

export function Logo({ besar }) {
  const ukuran = besar ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <div className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm shadow-amber-900/30 ring-1 ring-white/30 ${ukuran}`}>
      <svg viewBox="0 0 32 32" className="h-3/4 w-3/4" aria-hidden="true">
        <path d="M8 22V12l8-4 8 4v10" fill="none" stroke="#0a2724" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M13 22v-5h6v5" fill="none" stroke="#0a2724" strokeWidth="2.4" />
      </svg>
    </div>
  )
}

export default function Layout() {
  const { profil, isStaff, keluar } = useAuth()
  const { satker, satkerId, setPilihan } = useSatker()
  const [buka, setBuka] = useState(false)
  const daftarSatker = useCollection(isStaff ? ['satker'] : null)
  const items = isStaff ? [...MENU, ...MENU_DOSEN] : MENU
  const peran = isStaff ? 'Pengelola Barang (Dosen)' : 'Kuasa Pengguna Barang'

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-brand-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(31_122_111/0.35),transparent)] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 print:hidden ${buka ? 'translate-x-0 shadow-pop' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <Logo />
          <div className="min-w-0">
            <p className="font-semibold leading-tight tracking-tight text-white">SIMANTAP</p>
            <p className="truncate text-[11px] leading-tight text-brand-100/60">Simulator Manajemen Aset Negara</p>
          </div>
          <button className="ml-auto rounded-lg p-1 text-brand-100/70 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setBuka(false)} aria-label="Tutup menu"><X size={20} /></button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4 text-sm">
          {items.map((m, i) =>
            m.grup ? (
              <p key={i} className="mb-1.5 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-brand-200/50">{m.grup}</p>
            ) : (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                onClick={() => setBuka(false)}
                className={({ isActive }) =>
                  `group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-white/[0.12] font-medium text-white' : 'text-brand-50/70 hover:bg-white/[0.06] hover:text-white'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-amber-400" />}
                    <m.icon size={17} className={isActive ? 'text-amber-300' : 'text-brand-200/60 group-hover:text-brand-100'} />
                    {m.label}
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white ring-2 ring-white/10">{inisial(profil?.nama)}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-white">{profil?.nama}</p>
              <p className="truncate text-[11px] text-brand-100/60">{peran}</p>
            </div>
            <button onClick={keluar} className="rounded-lg p-2 text-brand-100/60 transition hover:bg-white/10 hover:text-white" title="Keluar" aria-label="Keluar"><LogOut size={17} /></button>
          </div>
          <p className="mt-2 px-2 text-[10.5px] leading-snug text-brand-100/40">Prodi Akuntansi Sektor Publik · Politeknik Negeri Sambas</p>
        </div>
      </aside>
      {buka && <div className="fixed inset-0 z-20 animate-fade-in bg-slate-950/40 backdrop-blur-[1px] lg:hidden" onClick={() => setBuka(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button className="-ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setBuka(true)} aria-label="Buka menu"><Menu size={22} /></button>
            {isStaff ? (
              <label className="relative flex min-w-0 max-w-sm flex-1 items-center">
                <Building2 size={16} className="pointer-events-none absolute left-3 text-slate-400" />
                <select
                  value={satkerId}
                  onChange={(e) => setPilihan(e.target.value)}
                  className="w-full cursor-pointer appearance-none truncate rounded-lg border-0 bg-slate-100 py-2 pl-9 pr-8 text-sm font-medium text-slate-800 ring-1 ring-inset ring-transparent transition hover:bg-slate-200/70 focus:bg-white focus:ring-2 focus:ring-brand-600 focus:outline-none"
                  aria-label="Pilih satker"
                >
                  <option value="">Pilih satker mahasiswa…</option>
                  {daftarSatker.data.map((s) => (
                    <option key={s.id} value={s.id}>{s.kode} · {s.nama}</option>
                  ))}
                </select>
                <ChevronsUpDown size={15} className="pointer-events-none absolute right-2.5 text-slate-400" />
              </label>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:grid"><Building2 size={16} /></span>
                <p className="min-w-0 truncate text-sm text-slate-600">
                  {satker ? <><span className="font-semibold text-slate-900">{satker.kode}</span><span className="text-slate-400"> · </span>{satker.nama}</> : 'Belum ditempatkan pada satker'}
                </p>
              </div>
            )}
            <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 md:inline-flex">
              <FlaskConical size={13} /> Mode simulasi
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 border-t border-amber-200/70 bg-amber-50/90 px-4 py-1 text-center text-[11.5px] font-medium text-amber-900">
            <FlaskConical size={12} className="hidden shrink-0 sm:block" />
            Aplikasi Simulasi Pembelajaran — bukan sistem resmi pengelolaan BMN. Seluruh data adalah data latihan.
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
