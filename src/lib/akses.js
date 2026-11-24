// Peran dan dosen awal. Fungsi murni, diuji di tests/akses.test.js.
//
// Dosen awal: email di bawah ini otomatis berperan Pengelola Barang setelah emailnya TERVERIFIKASI,
// sehingga dosen pertama tidak perlu mengubah data lewat Firebase Console. Verifikasi wajib karena
// pendaftaran email/kata sandi tidak membuktikan kepemilikan email.
// WAJIB sama dengan daftar di fungsi dosenAwal() pada firestore.rules (dijaga uji akses.test.js).
export const DOSEN_AWAL = ['mujiburrohman319@gmail.com']

export const PERAN = { kpb: 'Mahasiswa (KPB)', pengelola: 'Dosen (Pengelola Barang)', admin: 'Admin' }
export const PERAN_STAF = ['pengelola', 'admin']

export const normEmail = (e) => String(e || '').trim().toLowerCase()
export const isDosenAwal = (email) => DOSEN_AWAL.includes(normEmail(email))

/** Peran efektif di sisi klien (sama dengan isStaff() di rules). */
export const isStaf = (user, profil) => PERAN_STAF.includes(profil?.role) || (!!user?.emailVerified && isDosenAwal(user?.email))

/**
 * Perubahan profil yang perlu disimpan setelah masuk: tandai email terverifikasi,
 * dan naikkan dosen awal yang sudah terverifikasi menjadi pengelola. null bila tidak ada.
 */
export function sinkronProfil(user, profil) {
  if (!user || !profil) return null
  const patch = {}
  if (user.emailVerified && !profil.emailTerverifikasi) patch.emailTerverifikasi = true
  if (user.emailVerified && isDosenAwal(user.email) && !PERAN_STAF.includes(profil.role)) patch.role = 'pengelola'
  return Object.keys(patch).length ? patch : null
}

/** Apakah dosen `oleh` boleh mengubah peran `target` menjadi `peranBaru`? Mengembalikan alasan bila tidak. */
export function cekUbahPeran(oleh, target, peranBaru) {
  if (!PERAN[peranBaru]) return 'Peran tidak dikenal'
  if (target.role === peranBaru) return 'Peran sudah sama'
  if (oleh.id === target.id && !PERAN_STAF.includes(peranBaru)) return 'Anda tidak dapat menurunkan peran sendiri'
  if (isDosenAwal(target.email) && !PERAN_STAF.includes(peranBaru)) return 'Dosen awal tidak dapat diturunkan (atur di src/lib/akses.js dan firestore.rules)'
  return null
}
