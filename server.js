// Server statis untuk Firebase App Hosting / Cloud Run: menyajikan hasil `npm run build` (dist/) di $PORT.
// Tanpa dependensi tambahan. Rute aplikasi (mis. /aset) dijawab dengan index.html (SPA fallback).
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT) || 8080
const TIPE = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
}

function berkas(urlPath) {
  let p
  try { p = decodeURIComponent(urlPath.split('?')[0]) } catch { return null }
  const full = normalize(join(ROOT, p))
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null // cegah path traversal
  try { const s = statSync(full); return s.isFile() ? { full, size: s.size } : null } catch { return null }
}

createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
  const f = berkas(req.url) || (extname(req.url.split('?')[0]) ? null : berkas('/index.html'))
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Tidak ditemukan'); return }
  const aset = f.full.includes(`${sep}assets${sep}`) // nama berkas berisi hash → aman di-cache lama
  res.writeHead(200, {
    'Content-Type': TIPE[extname(f.full)] || 'application/octet-stream',
    'Content-Length': f.size,
    'Cache-Control': aset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(f.full).pipe(res)
}).listen(PORT, '0.0.0.0', () => console.log(`SIMANTAP melayani dist/ di port ${PORT}`))
