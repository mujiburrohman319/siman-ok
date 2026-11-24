import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configOk } from './lib/firebase.js'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { SatkerProvider } from './lib/satker.jsx'
import Layout from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import { UmpanProvider } from './components/umpan.jsx'
import Login from './pages/Login.jsx'

// Tiap halaman dimuat saat dibuka agar unduhan awal kecil (jaringan seluler kampus).
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Aset = lazy(() => import('./pages/Aset.jsx'))
const Transaksi = lazy(() => import('./pages/Transaksi.jsx'))
const Inventarisasi = lazy(() => import('./pages/Inventarisasi.jsx'))
const Laporan = lazy(() => import('./pages/Laporan.jsx'))
const RKBMN = lazy(() => import('./pages/RKBMN.jsx'))
const Usulan = lazy(() => import('./pages/Usulan.jsx'))
const Telaah = lazy(() => import('./pages/Telaah.jsx'))
const Kelas = lazy(() => import('./pages/Kelas.jsx'))
const Referensi = lazy(() => import('./pages/Referensi.jsx'))
const Wasdal = lazy(() => import('./pages/Wasdal.jsx'))

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
          <Route path="wasdal" element={<Wasdal />} />
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
    <UmpanProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </UmpanProvider>
  )
}
