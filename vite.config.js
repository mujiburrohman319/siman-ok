import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
