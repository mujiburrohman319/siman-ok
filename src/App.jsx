import { Navigate, Route, Routes } from 'react-router-dom'
import { configOk } from './lib/firebase.js'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { SatkerProvider } from './lib/satker.jsx'
import Layout from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Aset from './pages/Aset.jsx'
import Transaksi from './pages/Transaksi.jsx'
import Inventarisasi from './pages/Inventarisasi.jsx'
import Laporan from './pages/Laporan.jsx'
import RKBMN from './pages/RKBMN.jsx'
import Usulan from './pages/Usulan.jsx'
import Telaah from './pages/Telaah.jsx'
import Kelas from './pages/Kelas.jsx'
import Referensi from './pages/Referensi.jsx'

function Gate() {
  const { user, profil, isStaff, loading } = useAuth()
  if (loading) return <Loading />
  if (!user || !profil) return <Login />
  return (
    <SatkerProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="aset" element={<Aset />} />
          <Route path="transaksi" element={<Transaksi />} />
          <Route path="inventarisasi" element={<Inventarisasi />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="rkbmn" element={<RKBMN />} />
          <Route path="usulan" element={<Usulan />} />
          {isStaff && <Route path="telaah" element={<Telaah />} />}
          {isStaff && <Route path="kelas" element={<Kelas />} />}
          {isStaff && <Route path="referensi" element={<Referensi />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SatkerProvider>
  )
}

export default function App() {
  if (!configOk) {
    return (
      <div className="mx-auto mt-20 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h1 className="mb-2 text-lg font-semibold">Konfigurasi Firebase belum diisi</h1>
        <p>Salin <code>.env.example</code> menjadi <code>.env.local</code>, isi kredensial dari Firebase Console, lalu jalankan ulang <code>npm run dev</code>.</p>
      </div>
    )
  }
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
