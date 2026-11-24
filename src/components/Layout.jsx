import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Boxes, ArrowLeftRight, FileBarChart, ClipboardList, Send, ScanSearch, Gavel, School, Settings2, LogOut, Menu, X,
} from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { useCollection } from '../lib/hooks.js'

const MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { grup: 'Penatausahaan' },
  { to: '/aset', label: 'Daftar Aset & KIB', icon: Boxes },
  { to: '/transaksi', label: 'Transaksi BMN', icon: ArrowLeftRight },
  { to: '/inventarisasi', label: 'Inventarisasi', icon: ScanSearch },
  { to: '/laporan', label: 'Laporan', icon: FileBarChart },
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

export default function Layout() {
  const { profil, isStaff, keluar } = useAuth()
  const { satker, satkerId, setPilihan } = useSatker()
  const [buka, setBuka] = useState(false)
  const daftarSatker = useCollection(isStaff ? ['satker'] : null)
  const items = isStaff ? [...MENU, ...MENU_DOSEN] : MENU

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3 text-sm">
      {items.map((m, i) =>
        m.grup ? (
          <p key={i} className="mt-4 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-200/70">{m.grup}</p>
        ) : (
          <NavLink
            key={m.to}
            to={m.to}
            end={m.end}
            onClick={() => setBuka(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${isActive ? 'bg-white/15 font-medium text-white' : 'text-teal-50/85 hover:bg-white/10'}`
            }
          >
            <m.icon size={17} /> {m.label}
          </NavLink>
        ),
      )}
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-teal-900 transition lg:static lg:translate-x-0 print:hidden ${buka ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400 font-bold text-teal-950">S</div>
          <div>
            <p className="font-semibold leading-tight text-white">SIMANTAP</p>
            <p className="text-[11px] leading-tight text-teal-100/70">Simulator Manajemen Aset Negara</p>
          </div>
          <button className="ml-auto text-white lg:hidden" onClick={() => setBuka(false)} aria-label="Tutup menu"><X size={20} /></button>
        </div>
        {nav}
        <p className="absolute bottom-3 left-0 right-0 px-5 text-[11px] leading-snug text-teal-100/50">
          Prodi Akuntansi Sektor Publik<br />Politeknik Negeri Sambas
        </p>
      </aside>
      {buka && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setBuka(false)} />}

      <div className="min-w-0 flex-1">
        <div className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900 print:hidden">
          Aplikasi Simulasi Pembelajaran — bukan sistem resmi pengelolaan BMN. Seluruh data adalah data latihan.
        </div>
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden">
          <button className="text-slate-600 lg:hidden" onClick={() => setBuka(true)} aria-label="Buka menu"><Menu size={22} /></button>
          {isStaff ? (
            <select
              value={satkerId}
              onChange={(e) => setPilihan(e.target.value)}
              className="max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              aria-label="Pilih satker"
            >
              <option value="">— Pilih satker mahasiswa —</option>
              {daftarSatker.data.map((s) => (
                <option key={s.id} value={s.id}>{s.kode} · {s.nama}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-600">
              {satker ? <><span className="font-semibold text-slate-800">{satker.kode}</span> · {satker.nama}</> : 'Belum ditempatkan pada satker'}
            </p>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <p className="font-medium text-slate-800">{profil?.nama}</p>
              <p className="text-xs text-slate-500">{isStaff ? 'Pengelola Barang (Dosen)' : 'Kuasa Pengguna Barang'}</p>
            </div>
            <button onClick={keluar} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Keluar" aria-label="Keluar"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 print:max-w-none print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
