// Field Kartu Identitas Barang (KIB) per jenis — PMK 181/2016 (KIB Tanah, Gedung dan Bangunan,
// Bangunan Air, Alat Angkutan Bermotor, Alat Besar, Senjata Api).
export const KIB = {
  tanah: {
    nama: 'KIB Tanah',
    field: [
      { k: 'luas', l: 'Luas (m²)', t: 'number' },
      { k: 'alamat', l: 'Alamat' },
      { k: 'sertifikat', l: 'Nomor sertifikat' },
      { k: 'tglSertifikat', l: 'Tanggal sertifikat', t: 'date' },
      { k: 'penggunaan', l: 'Penggunaan tanah' },
    ],
  },
  gedung: {
    nama: 'KIB Gedung dan Bangunan',
    field: [
      { k: 'luasBangunan', l: 'Luas bangunan (m²)', t: 'number' },
      { k: 'jumlahLantai', l: 'Jumlah lantai', t: 'number' },
      { k: 'alamat', l: 'Alamat' },
      { k: 'imb', l: 'Nomor IMB/PBG' },
      { k: 'statusTanah', l: 'Kode/NUP tanah di bawahnya' },
    ],
  },
  bangunan_air: {
    nama: 'KIB Bangunan Air',
    field: [
      { k: 'luas', l: 'Luas/panjang', t: 'number' },
      { k: 'alamat', l: 'Lokasi' },
      { k: 'konstruksi', l: 'Jenis konstruksi' },
    ],
  },
  aab: {
    nama: 'KIB Alat Angkutan Bermotor',
    field: [
      { k: 'nopol', l: 'Nomor polisi' },
      { k: 'noRangka', l: 'Nomor rangka' },
      { k: 'noMesin', l: 'Nomor mesin' },
      { k: 'bpkb', l: 'Nomor BPKB' },
      { k: 'tahunPembuatan', l: 'Tahun pembuatan', t: 'number' },
    ],
  },
  alat_besar: {
    nama: 'KIB Alat Besar',
    field: [
      { k: 'noSeri', l: 'Nomor seri' },
      { k: 'kapasitas', l: 'Kapasitas' },
      { k: 'tahunPembuatan', l: 'Tahun pembuatan', t: 'number' },
    ],
  },
}
