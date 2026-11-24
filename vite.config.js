import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Firebase App Hosting menyediakan konfigurasi web app saat build (FIREBASE_WEBAPP_CONFIG, JSON).
// Petakan ke VITE_FIREBASE_* bila belum diisi (mis. lewat .env.local) agar tidak perlu menyimpan kunci di repo.
try {
  const c = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}')
  const peta = { apiKey: 'API_KEY', authDomain: 'AUTH_DOMAIN', projectId: 'PROJECT_ID', storageBucket: 'STORAGE_BUCKET', messagingSenderId: 'MESSAGING_SENDER_ID', appId: 'APP_ID' }
  for (const [k, v] of Object.entries(peta)) if (c[k] && !process.env[`VITE_FIREBASE_${v}`]) process.env[`VITE_FIREBASE_${v}`] = c[k]
} catch {
  console.warn('FIREBASE_WEBAPP_CONFIG tidak dapat dibaca; memakai VITE_FIREBASE_* dari lingkungan/.env')
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase jarang berubah: pisahkan agar tetap tersimpan di cache browser antar-rilis
        manualChunks: (id) => (/node_modules\/(@firebase|firebase)\//.test(id) ? 'firebase' : /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id) ? 'react' : undefined),
      },
    },
  },
})
