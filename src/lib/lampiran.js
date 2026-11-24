// Lampiran (dokumen sumber & foto aset) disimpan di Firestore sebagai potongan base64:
// satker/{s}/lampiran/{id} (metadata) + satker/{s}/lampiran/{id}/potong/{i} (data).
// Alasan: Cloud Storage untuk proyek Firebase baru mensyaratkan paket Blaze, dan aturan Storage tidak dapat
// memeriksa keanggotaan satker di named database. Dengan Firestore, aturan keamanan yang sama berlaku.
export const MAKS_BYTE = 2 * 1024 * 1024
export const UKURAN_POTONG = 950_000 // karakter base64 per dokumen (batas dokumen Firestore 1 MiB)
export const TIPE_DIIZINKAN = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'application/pdf': 'PDF' }

export function validasiBerkas({ type, size }) {
  if (!TIPE_DIIZINKAN[type]) return `Format tidak didukung. Gunakan ${Object.values(TIPE_DIIZINKAN).join(', ')}.`
  if (size > MAKS_BYTE) return `Ukuran ${(size / 1024 / 1024).toFixed(1)} MB melebihi batas 2 MB.`
  return null
}

export function potong(base64, n = UKURAN_POTONG) {
  const out = []
  for (let i = 0; i < base64.length; i += n) out.push(base64.slice(i, i + n))
  return out.length ? out : ['']
}

export const formatUkuran = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

// ---------------------------------------------------------------- khusus browser
export function bacaBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Perkecil foto (sisi terpanjang ≤ 1600 px, JPEG 0,82) agar hemat kuota; berkas non-gambar dikembalikan apa adanya. */
export async function kompresGambar(file) {
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file
  const bmp = await createImageBitmap(file)
  const skala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * skala), height: Math.round(bmp.height * skala) })
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
}

export function base64KeBlob(base64, type) {
  const bin = atob(base64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}
