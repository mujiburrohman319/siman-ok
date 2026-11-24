import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { Alert, Button, Field, Input } from '../components/ui.jsx'

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-teal-900 p-10 text-teal-50 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400 text-lg font-bold text-teal-950">S</div>
          <div>
            <p className="text-lg font-semibold text-white">SIMANTAP</p>
            <p className="text-sm text-teal-100/70">Simulator Manajemen Aset Negara</p>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">Praktik siklus Barang Milik Negara, dari RKBMN sampai laporan.</h1>
          <p className="mt-4 text-teal-100/80">
            Anda berperan sebagai Kuasa Pengguna Barang pada satker simulasi: membukukan aset, menyusun RKBMN,
            mengajukan usulan pengelolaan, dan menyusun Laporan Barang Kuasa Pengguna. Dosen bertindak sebagai Pengelola Barang.
          </p>
        </div>
        <p className="text-xs text-teal-100/60">Mata Kuliah Manajemen Barang Milik Negara · Prodi Akuntansi Sektor Publik · Politeknik Negeri Sambas</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{mode === 'masuk' ? 'Masuk' : 'Daftar akun mahasiswa'}</h2>
            <p className="text-sm text-slate-500">Aplikasi simulasi pembelajaran — bukan sistem resmi.</p>
          </div>
          {user && <Alert>Akun Anda belum memiliki profil. Lengkapi data di bawah.</Alert>}
          {mode === 'daftar' && (
            <>
              <Field label="Nama lengkap"><Input required value={f.nama} onChange={set('nama')} /></Field>
              <Field label="NIM"><Input required value={f.nim} onChange={set('nim')} /></Field>
            </>
          )}
          {!user && (
            <>
              <Field label="Email"><Input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
              <Field label="Kata sandi"><Input type="password" required minLength={6} value={f.pass} onChange={set('pass')} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} /></Field>
            </>
          )}
          {err && <Alert tone="rose">{err}</Alert>}
          <Button type="submit" className="w-full py-2" disabled={proses}>{proses ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}</Button>
          {!user && (
            <p className="text-center text-sm text-slate-600">
              {mode === 'masuk' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              <button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setMode(mode === 'masuk' ? 'daftar' : 'masuk')}>
                {mode === 'masuk' ? 'Daftar' : 'Masuk'}
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
