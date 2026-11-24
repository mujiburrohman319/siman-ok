import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getRedirectResult, onAuthStateChanged, sendEmailVerification,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { buatProfil, muatKodefikasi, simpanSinkronProfil } from './db.js'
import { isDosenAwal, isStaf, sinkronProfil } from './akses.js'
import { setKodefikasi } from '../data/kodeBarang.js'
import { REFERENSI_DEFAULT } from './bmn.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profil, setProfil] = useState(null)
  const [profilSiap, setProfilSiap] = useState(false)
  const [ref, setRef] = useState(REFERENSI_DEFAULT)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])
  // Hasil masuk Google lewat redirect (dipakai bila popup diblokir browser)
  const [galatRedirect, setGalatRedirect] = useState(null)
  useEffect(() => { getRedirectResult(auth).catch((e) => setGalatRedirect(e)) }, [])

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

  // Setelah email terverifikasi: tandai di profil dan naikkan dosen awal menjadi pengelola (src/lib/akses.js).
  const [verVerifikasi, setVerVerifikasi] = useState(0)
  useEffect(() => {
    const patch = sinkronProfil(user, profil)
    if (!patch) return
    // Token harus memuat email_verified terbaru agar diterima firestore.rules
    user.getIdToken(true).then(() => simpanSinkronProfil(user.uid, patch)).catch(() => {})
  }, [user, profil, verVerifikasi])

  /** Muat ulang status verifikasi setelah pengguna mengeklik tautan di email. */
  async function cekVerifikasi() {
    await auth.currentUser?.reload()
    await auth.currentUser?.getIdToken(true)
    setVerVerifikasi((v) => v + 1)
    return !!auth.currentUser?.emailVerified
  }

  const isStaff = isStaf(user, profil)

  const value = {
    user,
    profil,
    ref,
    kodefikasi,
    isStaff,
    loading: user === undefined || (!!user && !profilSiap),
    masuk: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    /** Masuk dengan akun Google; bila popup diblokir (mis. di ponsel), beralih ke redirect. */
    masukGoogle: async () => {
      const p = new GoogleAuthProvider()
      p.setCustomParameters({ prompt: 'select_account' })
      try {
        await signInWithPopup(auth, p)
      } catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await signInWithRedirect(auth, p)
        else throw e
      }
    },
    galatRedirect,
    daftar: async ({ email, pass, nama, nim }) => {
      // Jika sudah login tetapi profil belum ada (pendaftaran sebelumnya terputus), cukup buat profil.
      // Akun Google sudah login (profil belum ada) → cukup buat profil; email Google sudah terverifikasi.
      const u = auth.currentUser || (await createUserWithEmailAndPassword(auth, email, pass)).user
      const em = (u.email || email).trim().toLowerCase()
      const dosen = u.emailVerified && isDosenAwal(em)
      if (dosen) await u.getIdToken(true)
      await buatProfil(u.uid, { nama, nim, email: em, role: dosen ? 'pengelola' : 'kpb', emailTerverifikasi: u.emailVerified })
      if (!u.emailVerified) await sendEmailVerification(u).catch(() => {})
    },
    emailTerverifikasi: !!user?.emailVerified,
    kirimVerifikasi: () => sendEmailVerification(auth.currentUser),
    cekVerifikasi,
    keluar: () => signOut(auth),
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
