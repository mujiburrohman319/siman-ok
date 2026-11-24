import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { buatProfil, muatKodefikasi } from './db.js'
import { setKodefikasi } from '../data/kodeBarang.js'
import { REFERENSI_DEFAULT } from './bmn.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profil, setProfil] = useState(null)
  const [profilSiap, setProfilSiap] = useState(false)
  const [ref, setRef] = useState(REFERENSI_DEFAULT)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])

  useEffect(() => {
    if (!user) { setProfil(null); setProfilSiap(!user && user !== undefined); return }
    setProfilSiap(false)
    return onSnapshot(
      doc(db, 'users', user.uid),
      (s) => { setProfil(s.exists() ? { id: s.id, ...s.data() } : null); setProfilSiap(true) },
      () => setProfilSiap(true),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'referensi', 'config'), (s) => {
      const d = s.exists() ? s.data() : {}
      setRef({
        ...REFERENSI_DEFAULT,
        ...d,
        batasKapitalisasi: { ...REFERENSI_DEFAULT.batasKapitalisasi, ...(d.batasKapitalisasi || {}) },
        sbsk: d.sbsk?.length ? d.sbsk : REFERENSI_DEFAULT.sbsk,
      })
    }, () => {})
  }, [user])

  // Kodefikasi resmi hasil impor dosen (bila ada) dipasang sebagai daftar kode aktif
  const [kodefikasi, setKodefikasiMeta] = useState(null)
  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'referensi', 'kodefikasi'), async (s) => {
      const meta = s.exists() ? s.data() : null
      setKodefikasi(meta ? await muatKodefikasi(meta) : null)
      setKodefikasiMeta(meta)
    }, () => {})
  }, [user])

  const isStaff = ['pengelola', 'admin'].includes(profil?.role)

  const value = {
    user,
    profil,
    ref,
    kodefikasi,
    isStaff,
    loading: user === undefined || (!!user && !profilSiap),
    masuk: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    daftar: async ({ email, pass, nama, nim }) => {
      // Jika sudah login tetapi profil belum ada (pendaftaran sebelumnya terputus), cukup buat profil.
      const u = auth.currentUser || (await createUserWithEmailAndPassword(auth, email, pass)).user
      await buatProfil(u.uid, { nama, nim, email: (u.email || email).trim().toLowerCase() })
    },
    keluar: () => signOut(auth),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
