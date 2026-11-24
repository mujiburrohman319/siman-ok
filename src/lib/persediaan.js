// Persediaan (aset lancar): mutasi masuk/keluar dengan metode FIFO, opname fisik, LBKP persediaan.
// Fungsi murni, diuji di tests/persediaan.test.js. Penulisan Firestore di src/lib/db.js (catatMutasiPersediaan).
//
// Keadaan barang: { kode, nama, satuan, saldoQty, lapisan: [{tanggal, qty, harga}], tglTerakhir }
// lapisan = sisa tiap penerimaan (FIFO: yang lebih dulu masuk dikeluarkan lebih dulu).

export const JENIS_MUTASI = {
  saldo_awal: { nama: 'Saldo Awal', arah: 'masuk' },
  pembelian: { nama: 'Pembelian', arah: 'masuk' },
  hibah_masuk: { nama: 'Hibah Masuk', arah: 'masuk' },
  transfer_masuk: { nama: 'Transfer Masuk', arah: 'masuk' },
  perolehan_lainnya: { nama: 'Perolehan Lainnya', arah: 'masuk' },
  selisih_lebih: { nama: 'Selisih Lebih Opname', arah: 'masuk' },
  pemakaian: { nama: 'Pemakaian (Habis Pakai)', arah: 'keluar' },
  transfer_keluar: { nama: 'Transfer Keluar', arah: 'keluar' },
  hibah_keluar: { nama: 'Hibah Keluar', arah: 'keluar' },
  usang: { nama: 'Usang / Rusak', arah: 'keluar' },
  selisih_kurang: { nama: 'Selisih Kurang Opname', arah: 'keluar' },
}

export class PersediaanError extends Error {}

export const nilaiBarang = (b) => (b?.lapisan || []).reduce((s, l) => s + l.qty * l.harga, 0)
export const nilaiPersediaan = (list) => list.reduce((s, b) => s + nilaiBarang(b), 0)

/**
 * Terapkan satu mutasi pada barang. input: {jenis, tanggal, qty, hargaSatuan?, dokumen, keterangan}
 * @returns {{barang:object, mutasi:object}}
 */
export function terapkanMutasi(barang, input) {
  const def = JENIS_MUTASI[input.jenis]
  if (!def) throw new PersediaanError(`Jenis mutasi tidak dikenal: ${input.jenis}`)
  if (!barang) throw new PersediaanError('Pilih barang persediaan')
  if (!input.tanggal) throw new PersediaanError('Tanggal wajib diisi')
  if (barang.tglTerakhir && input.tanggal < barang.tglTerakhir) {
    throw new PersediaanError(`Mutasi harus kronologis: tanggal tidak boleh sebelum mutasi terakhir (${barang.tglTerakhir})`)
  }
  if (!input.dokumen?.jenis || !input.dokumen?.nomor) throw new PersediaanError('Dokumen sumber (jenis dan nomor) wajib diisi')
  const qty = Number(input.qty)
  if (!(qty > 0) || !Number.isInteger(qty)) throw new PersediaanError('Kuantitas harus bilangan bulat lebih dari 0')

  let lapisan = (barang.lapisan || []).map((l) => ({ ...l }))
  let nilai = 0
  let rincian = []
  if (def.arah === 'masuk') {
    const harga = input.jenis === 'selisih_lebih' && (input.hargaSatuan === undefined || input.hargaSatuan === '')
      ? (lapisan.at(-1)?.harga ?? 0)
      : Number(input.hargaSatuan)
    if (!(harga >= 0)) throw new PersediaanError('Harga satuan tidak valid')
    lapisan.push({ tanggal: input.tanggal, qty, harga })
    nilai = qty * harga
    rincian = [{ qty, harga }]
  } else {
    const saldo = lapisan.reduce((s, l) => s + l.qty, 0)
    if (qty > saldo) throw new PersediaanError(`Saldo tidak cukup: tersedia ${saldo} ${barang.satuan || ''}`.trim())
    let sisa = qty
    for (const l of lapisan) {
      if (!sisa) break
      const ambil = Math.min(sisa, l.qty)
      l.qty -= ambil
      sisa -= ambil
      nilai += ambil * l.harga
      rincian.push({ qty: ambil, harga: l.harga })
    }
    lapisan = lapisan.filter((l) => l.qty > 0)
  }
  const saldoQty = lapisan.reduce((s, l) => s + l.qty, 0)
  return {
    barang: { ...barang, lapisan, saldoQty, tglTerakhir: input.tanggal },
    mutasi: {
      jenis: input.jenis,
      namaJenis: def.nama,
      arah: def.arah,
      tanggal: input.tanggal,
      kode: barang.kode,
      nama: barang.nama,
      satuan: barang.satuan || '',
      qty,
      nilai,
      rincian, // lapisan harga yang dipakai (FIFO) — jejak audit
      saldoQty,
      saldoNilai: nilaiBarang({ lapisan }),
      dokumen: input.dokumen,
      keterangan: input.keterangan || '',
    },
  }
}

/** Selisih opname fisik → daftar input mutasi (selisih_lebih / selisih_kurang). fisik: {barangId: qty} */
export function selisihOpname(barangList, fisik, { tanggal, dokumen }) {
  const out = []
  for (const b of barangList) {
    if (fisik[b.id] === undefined || fisik[b.id] === '') continue
    const f = Number(fisik[b.id])
    if (!(f >= 0) || !Number.isInteger(f)) throw new PersediaanError(`Jumlah fisik ${b.nama} tidak valid`)
    const d = f - (b.saldoQty || 0)
    if (d) out.push({ barangId: b.id, input: { jenis: d > 0 ? 'selisih_lebih' : 'selisih_kurang', tanggal, qty: Math.abs(d), dokumen, keterangan: 'Hasil opname fisik' } })
  }
  return out
}

/** Kartu persediaan satu barang: mutasi urut tanggal beserta saldo berjalan. */
export function kartuPersediaan(mutasi) {
  return [...mutasi].sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0))
}

/**
 * LBKP persediaan per barang untuk periode [mulai, akhir]: saldo awal, masuk, keluar, saldo akhir (kuantitas & nilai).
 */
export function lbkpPersediaan(barangList, mutasi, mulai, akhir) {
  const baris = new Map(barangList.map((b) => [b.id, { id: b.id, kode: b.kode, nama: b.nama, satuan: b.satuan, awalQty: 0, awal: 0, masukQty: 0, masuk: 0, keluarQty: 0, keluar: 0 }]))
  for (const m of mutasi) {
    if (m.tanggal > akhir) continue
    const r = baris.get(m.barangId)
    if (!r) continue
    const tanda = m.arah === 'masuk' ? 1 : -1
    if (m.tanggal < mulai) { r.awalQty += tanda * m.qty; r.awal += tanda * m.nilai } else if (tanda > 0) { r.masukQty += m.qty; r.masuk += m.nilai } else { r.keluarQty += m.qty; r.keluar += m.nilai }
  }
  return [...baris.values()].map((r) => ({ ...r, akhirQty: r.awalQty + r.masukQty - r.keluarQty, akhir: r.awal + r.masuk - r.keluar }))
    .sort((a, b) => a.kode.localeCompare(b.kode) || a.nama.localeCompare(b.nama))
}
