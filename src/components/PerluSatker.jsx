import { useAuth } from '../lib/auth.jsx'
import { useSatker } from '../lib/satker.jsx'
import { Alert, Loading } from './ui.jsx'

/** Membungkus halaman yang membutuhkan satker aktif. */
export default function PerluSatker({ children }) {
  const { isStaff } = useAuth()
  const { satkerId, loading } = useSatker()
  if (!satkerId)
    return (
      <Alert tone="slate">
        {isStaff
          ? 'Pilih satker mahasiswa di bagian atas halaman untuk melihat atau menelaah datanya.'
          : 'Akun Anda belum ditempatkan pada satker simulasi. Minta dosen menambahkan email Anda di menu Kelas & Satker.'}
      </Alert>
    )
  if (loading) return <Loading />
  return children
}
