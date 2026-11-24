import { createContext, useContext, useMemo, useState } from 'react'
import { orderBy } from 'firebase/firestore'
import { useAuth } from './auth.jsx'
import { useCollection, useDoc } from './hooks.js'

const SatkerCtx = createContext(null)

/**
 * Satker aktif: mahasiswa = satkernya sendiri; dosen = satker yang dipilih di header.
 * Menyediakan daftar aset dan transaksi satker aktif (realtime) untuk semua halaman.
 */
export function SatkerProvider({ children }) {
  const { profil, isStaff } = useAuth()
  const [pilihan, setPilihan] = useState('')
  const satkerId = isStaff ? pilihan : profil?.satkerId || ''

  const { data: satker } = useDoc(satkerId ? ['satker', satkerId] : null)
  const aset = useCollection(satkerId ? ['satker', satkerId, 'aset'] : null)
  const transaksi = useCollection(satkerId ? ['satker', satkerId, 'transaksi'] : null, [orderBy('tanggal', 'asc')])

  const value = useMemo(
    () => ({
      satkerId,
      satker,
      setPilihan,
      aset: aset.data,
      transaksi: transaksi.data,
      loading: aset.loading || transaksi.loading,
    }),
    [satkerId, satker, aset.data, transaksi.data, aset.loading, transaksi.loading],
  )
  return <SatkerCtx.Provider value={value}>{children}</SatkerCtx.Provider>
}

export const useSatker = () => useContext(SatkerCtx)
