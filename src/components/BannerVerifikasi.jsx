import { useState } from 'react'
import { MailWarning } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { isDosenAwal } from '../lib/akses.js'
import { Button } from './ui.jsx'
import { useToast } from './umpan.jsx'

/** Pengingat verifikasi email. Untuk dosen awal, akses dosen baru aktif setelah verifikasi. */
export default function BannerVerifikasi() {
  const { user, emailTerverifikasi, kirimVerifikasi, cekVerifikasi } = useAuth()
  const toast = useToast()
  const [proses, setProses] = useState(false)
  if (!user || emailTerverifikasi) return null
  const dosen = isDosenAwal(user.email)

  async function kirim() {
    setProses(true)
    try { await kirimVerifikasi(); toast.sukses(`Tautan verifikasi dikirim ke ${user.email}. Periksa juga folder spam.`) } catch (e) { toast.galat(e.code === 'auth/too-many-requests' ? 'Terlalu sering. Coba lagi beberapa menit lagi.' : e) } finally { setProses(false) }
  }
  async function cek() {
    setProses(true)
    try {
      if (await cekVerifikasi()) toast.sukses('Email terverifikasi.')
      else toast.info('Email belum terverifikasi. Klik tautan di email terlebih dahulu.')
    } catch (e) { toast.galat(e) } finally { setProses(false) }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 print:hidden">
      <MailWarning size={18} className="shrink-0" />
      <p className="min-w-0 flex-1">
        {dosen
          ? <>Akun dosen awal: <b>akses Pengelola Barang aktif setelah email {user.email} diverifikasi.</b></>
          : <>Email {user.email} belum diverifikasi.</>}
        {' '}Klik tautan yang kami kirim, lalu tekan "Saya sudah verifikasi".
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={proses} onClick={kirim}>Kirim ulang</Button>
        <Button size="sm" disabled={proses} onClick={cek}>Saya sudah verifikasi</Button>
      </div>
    </div>
  )
}
