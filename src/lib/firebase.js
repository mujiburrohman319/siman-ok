import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// Di browser variabel berasal dari Vite (import.meta.env); di uji Node (tests/emulator) dari process.env.
const env = import.meta.env ?? globalThis.process?.env ?? {}

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const configOk = Boolean(config.apiKey && config.projectId)

export const app = configOk ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
// Semua data hanya di Firestore (tanpa mode offline/localStorage)
export const db = app ? getFirestore(app, env.VITE_FIRESTORE_DB || '(default)') : null

// VITE_USE_EMULATOR=true → pakai Firebase Emulator lokal (npm run emulators), bukan proyek sungguhan.
if (app && String(env.VITE_USE_EMULATOR) === 'true') {
  connectAuthEmulator(auth, `http://${env.VITE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`, { disableWarnings: true })
  const [host, port] = (env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
  connectFirestoreEmulator(db, host, Number(port))
}
