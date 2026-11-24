// Impor kodefikasi barang dari CSV. Fungsi murni, diuji di tests/kodefikasi.test.js.
// Kolom: kode, uraian, kib, masa_manfaat [, aab]  — pemisah ; , atau tab; baris pertama judul kolom.
import { GOLONGAN } from '../data/kodeBarang.js'
import { KIB } from '../data/kib.js'

export const POLA_KODE = /^\d(\.\d{2}){3}\.\d{3}$/

/** Pecah satu baris CSV (mendukung tanda kutip ganda dan "" di dalamnya). */
function pecah(baris, pemisah) {
  const out = []
  let cur = ''
  let kutip = false
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i]
    if (kutip) {
      if (c === '"' && baris[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') kutip = false
      else cur += c
    } else if (c === '"') kutip = true
    else if (c === pemisah) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

const normKolom = (s) => s.toLowerCase().replace(/[^a-z]/g, '')
const ALIAS = { kode: ['kode', 'kodebarang'], uraian: ['uraian', 'namabarang', 'nama'], kib: ['kib', 'jeniskib'], masaManfaat: ['masamanfaat', 'masamanfaattahun', 'umurekonomis'], aab: ['aab', 'alatangkutan'] }

/**
 * @returns {{data: {kode, uraian, kib, masaManfaat, aab}[], galat: {baris:number, pesan:string}[]}}
 */
export function parseKodefikasi(teks) {
  const baris = String(teks).replace(/^﻿/, '').split(/\r?\n/).map((b, i) => ({ b, n: i + 1 })).filter((x) => x.b.trim())
  if (!baris.length) return { data: [], galat: [{ baris: 0, pesan: 'Berkas kosong' }] }
  const kepala = baris[0].b
  const pemisah = ['\t', ';', ','].map((p) => [p, kepala.split(p).length]).sort((a, b) => b[1] - a[1])[0][0]
  const kolom = pecah(kepala, pemisah).map(normKolom)
  const idx = Object.fromEntries(Object.entries(ALIAS).map(([k, al]) => [k, kolom.findIndex((c) => al.includes(c))]))
  const galat = []
  if (idx.kode < 0 || idx.uraian < 0) return { data: [], galat: [{ baris: 1, pesan: 'Kolom wajib "kode" dan "uraian" tidak ditemukan pada baris judul' }] }

  const data = []
  const sudah = new Set()
  for (const { b, n } of baris.slice(1)) {
    const c = pecah(b, pemisah)
    const kode = c[idx.kode] || ''
    const uraian = c[idx.uraian] || ''
    const kib = idx.kib >= 0 ? (c[idx.kib] || '').toLowerCase().replace(/\s+/g, '_') : ''
    const mmTeks = idx.masaManfaat >= 0 ? c[idx.masaManfaat] || '' : ''
    const masaManfaat = mmTeks === '' ? 0 : Number(mmTeks.replace(',', '.'))
    if (!POLA_KODE.test(kode)) { galat.push({ baris: n, pesan: `Format kode "${kode}" tidak valid (contoh 3.10.01.02.002)` }); continue }
    if (!GOLONGAN[kode[0]]) { galat.push({ baris: n, pesan: `Golongan ${kode[0]} bukan golongan aset tetap/ATB (2–8)` }); continue }
    if (!uraian) { galat.push({ baris: n, pesan: `Uraian kode ${kode} kosong` }); continue }
    if (kib && kib !== '-' && !KIB[kib]) { galat.push({ baris: n, pesan: `Jenis KIB "${kib}" tidak dikenal (${Object.keys(KIB).join(', ')})` }); continue }
    if (!Number.isFinite(masaManfaat) || masaManfaat < 0) { galat.push({ baris: n, pesan: `Masa manfaat "${mmTeks}" tidak valid` }); continue }
    if (sudah.has(kode)) { galat.push({ baris: n, pesan: `Kode ${kode} ganda` }); continue }
    sudah.add(kode)
    const kibOk = kib && kib !== '-' ? kib : null
    const aabTeks = idx.aab >= 0 ? (c[idx.aab] || '').toLowerCase() : ''
    data.push({ kode, uraian, kib: kibOk, masaManfaat, aab: ['1', 'ya', 'y', 'true'].includes(aabTeks) || kibOk === 'aab' })
  }
  return { data, galat }
}

/** Kodefikasi → teks CSV (untuk templat/ekspor). */
export function keCSV(list) {
  const q = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))
  return ['kode;uraian;kib;masa_manfaat;aab', ...list.map((k) => [k.kode, k.uraian, k.kib || '', k.masaManfaat ?? 0, k.aab ? 'ya' : ''].map(q).join(';'))].join('\n')
}

/** Bagi daftar besar ke beberapa dokumen Firestore (≤ 1 MiB per dokumen). */
export function bagiKodefikasi(list, n = 2500) {
  const out = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}
