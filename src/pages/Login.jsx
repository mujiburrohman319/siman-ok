import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { ArrowRight, Boxes, ClipboardList, FileBarChart, FlaskConical, Loader2, Send } from 'lucide-react'
import { Alert, Button, Field, Input } from '../components/ui.jsx'
import { Logo } from '../components/Layout.jsx'

const FITUR = [[Boxes, 'Pembukuan aset & KIB'], [ClipboardList, 'Penyusunan RKBMN'], [Send, 'Usulan pengelolaan'], [FileBarChart, 'LBKP & laporan BMN']]

const pesanError = (e) => {
  const c = e?.code || ''
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email atau kata sandi salah.'
  if (c.includes('email-already-in-use')) return 'Email sudah terdaftar. Silakan masuk.'
  if (c.includes('weak-password')) return 'Kata sandi minimal 6 karakter.'
  return e?.message || 'Terjadi kesalahan.'
}

export default function Login() {
  const { masuk, daftar, user } = useAuth()
  const [mode, setMode] = useState(user ? 'daftar' : 'masuk')
  const [f, setF] = useState({ email: user?.email || '', pass: '', nama: '', nim: '' })
  const [err, setErr] = useState('')
  const [proses, setProses] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setProses(true)
    try {
      if (mode === 'masuk') await masuk(f.email, f.pass)
      else await daftar(f)
    } catch (e2) {
      setErr(pesanError(e2))
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-950 p-12 text-brand-50 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_10%_0%,rgb(31_122_111/0.55),transparent),radial-gradient(60%_50%_at_100%_100%,rgb(245_158_11/0.18),transparent)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative flex items-center gap-3">
          <Logo besar />
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">SIMANTAP</p>
            <p className="text-sm text-brand-100/70">Simulator Manajemen Aset Negara</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-inset ring-amber-300/30">
            <FlaskConical size={13} /> Aplikasi Simulasi Pembelajaran
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight text-white">Praktik siklus Barang Milik Negara, dari RKBMN sampai laporan.</h1>
          <p className="mt-4 leading-relaxed text-brand-100/75">
            Anda berperan sebagai Kuasa Pengguna Barang pada satker simulasi. Dosen bertindak sebagai Pengelola Barang.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {FITUR.map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                <Icon size={16} className="shrink-0 text-amber-300" /> <span className="text-brand-50/90">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-100/50">Mata Kuliah Manajemen Barang Milik Negara · Prodi Akuntansi Sektor Publik · Politeknik Negeri Sambas</p>
      </div>

      <div className="flex flex-col items-center justify-center bg-slate-50 px-5 py-10 lg:bg-white">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Logo besar />
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">SIMANTAP</p>
            <p className="text-sm text-slate-500">Simulator Manajemen Aset Negara</p>
          </div>
        </div>
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/[0.06] lg:p-0 lg:shadow-none lg:ring-0">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{mode === 'masuk' ? 'Selamat datang kembali' : 'Daftar akun mahasiswa'}</h2>
            <p className="mt-1 text-sm text-slate-500">{mode === 'masuk' ? 'Masuk untuk melanjutkan praktikum Anda.' : 'Isi data diri Anda untuk mulai praktikum.'}</p>
          </div>
          {user && <Alert>Akun Anda belum memiliki profil. Lengkapi data di bawah.</Alert>}
          {mode === 'daftar' && (
            <>
              <Field label="Nama lengkap"><Input required value={f.nama} onChange={set('nama')} className="h-10" /></Field>
              <Field label="NIM"><Input required value={f.nim} onChange={set('nim')} className="h-10" /></Field>
            </>
          )}
          {!user && (
            <>
              <Field label="Email"><Input type="email" required value={f.email} onChange={set('email')} autoComplete="email" placeholder="nama@contoh.ac.id" className="h-10" /></Field>
              <Field label="Kata sandi"><Input type="password" required minLength={6} value={f.pass} onChange={set('pass')} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} placeholder="Minimal 6 karakter" className="h-10" /></Field>
            </>
          )}
          {err && <Alert tone="rose">{err}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={proses}>
            {proses ? <><Loader2 size={16} className="animate-spin" /> Memproses…</> : <>{mode === 'masuk' ? 'Masuk' : 'Daftar'} <ArrowRight size={16} /></>}
          </Button>
          {!user && (
            <p className="text-center text-sm text-slate-600">
              {mode === 'masuk' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <button type="button" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline" onClick={() => setMode(mode === 'masuk' ? 'daftar' : 'masuk')}>
                {mode === 'masuk' ? 'Daftar sekarang' : 'Masuk'}
              </button>
            </p>
          )}
        </form>
        <p className="mt-8 max-w-sm text-center text-xs text-slate-400">Aplikasi simulasi pembelajaran — bukan sistem resmi. Seluruh data adalah data latihan.</p>
      </div>
    </div>
  )
}
