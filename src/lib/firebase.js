import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const configOk = Boolean(config.apiKey && config.projectId)

export const app = configOk ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
// Semua data hanya di Firestore (tanpa mode offline/localStorage)
export const db = app ? getFirestore(app, import.meta.env.VITE_FIRESTORE_DB || '(default)') : null
