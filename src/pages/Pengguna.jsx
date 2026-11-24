import { useMemo, useState } from 'react'
import { ArrowRightLeft, BadgeCheck, GraduationCap, Search, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { useCollection } from '../lib/hooks.js'
import { pindahkanAnggota, ubahPeran } from '../lib/db.js'
import { PERAN, PERAN_STAF, cekUbahPeran, isDosenAwal } from '../lib/akses.js'
import { Badge, Button, Card, Field, Modal, PageHeader, Paging, Select, Stat, Table, Td, TombolEkspor, inputCls, usePaging } from '../components/ui.jsx'
import { useKonfirmasi, useToast } from '../components/umpan.jsx'

const staf = (u) => PERAN_STAF.includes(u.role) || isDosenAwal(u.email)

export default function Pengguna() {
  const { profil } = useAuth()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const users = useCollection(['users']).data
  const kelas = useCollection(['kelas']).data
  const satker = useCollection(['satker']).data
  const [cari, setCari] = useState('')
  const [peran, setPeran] = useState('')
  const [kelasId, setKelasId] = useState('')
  const [pindah, setPindah] = useState(null)

  const namaKelas = (id) => kelas.find((k) => k.id === id)?.nama
  const st = (id) => satker.find((s) => s.id === id)
  const list = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return users
      .filter((u) => !peran || (peran === 'pengelola' ? staf(u) : !staf(u)))
      .filter((u) => !kelasId || (kelasId === '-' ? !u.satkerId : u.kelasId === kelasId))
      .filter((u) => !q || `${u.nama} ${u.nim} ${u.email}`.toLowerCase().includes(q))
      .sort((a, b) => Number(staf(b)) - Number(staf(a)) || String(a.nim || a.nama).localeCompare(String(b.nim || b.nama)))
  }, [users, cari, peran, kelasId])
  const paging = usePaging(list, 25)

  async function gantiPeran(u, baru) {
    const salah = cekUbahPeran(profil, u, baru)
    if (salah) return toast.galat(salah)
    const naik = PERAN_STAF.includes(baru)
    if (!(await konfirmasi({
      judul: naik ? `Jadikan ${u.nama} dosen?` : `Jadikan ${u.nama} mahasiswa?`,
      pesan: naik
        ? 'Pengguna ini akan dapat melihat dan mengubah data semua satker, menelaah RKBMN, memutus usulan, menilai skenario, dan mengatur pengguna lain.'
        : 'Akses dosen dicabut. Pengguna kembali berperan mahasiswa dan hanya dapat membuka satker tempat ia menjadi anggota.',
      ya: naik ? 'Jadikan dosen' : 'Cabut akses dosen',
      bahaya: !naik,
    }))) return
    try {
      await ubahPeran(u.id, baru)
      toast.sukses(`${u.nama} sekarang ${PERAN[baru]}.`)
    } catch (e) {
      toast.galat(e)
    }
  }

  const ekspor = () => ({
    judul: 'Daftar Pengguna SIMANTAP', sheet: 'Pengguna', subjudul: [`Per ${new Date().toLocaleDateString('id-ID')}`],
    kolom: [{ label: 'Nama' }, { label: 'NIM/NIP' }, { label: 'Email' }, { label: 'Peran' }, { label: 'Kelas' }, { label: 'Satker' }, { label: 'APIP' }, { label: 'Email terverifikasi' }],
    baris: list.map((u) => [u.nama, u.nim, u.email, staf(u) ? PERAN.pengelola : PERAN.kpb, namaKelas(u.kelasId) || '', st(u.satkerId) ? `${st(u.satkerId).kode} ${st(u.satkerId).nama}` : '', st(u.satkerId)?.apipUids?.includes(u.id) ? 'ya' : '', u.emailTerverifikasi ? 'ya' : 'belum']),
  })

  return (
    <>
      <PageHeader title="Pengguna" desc="Atur peran dosen/mahasiswa dan penempatan satker tanpa membuka Firebase Console. Pengguna baru mendaftar sendiri lewat halaman masuk." />
      <div className="mb-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ShieldCheck} label="Dosen / asisten" value={users.filter(staf).length} />
        <Stat icon={GraduationCap} tone="blue" label="Mahasiswa" value={users.filter((u) => !staf(u)).length} />
        <Stat icon={UserMinus} tone="amber" label="Mahasiswa tanpa satker" value={users.filter((u) => !staf(u) && !u.satkerId).length} sub="Tempatkan di Kelas & Satker atau di sini" />
        <Stat icon={BadgeCheck} tone="violet" label="Email terverifikasi" value={`${users.filter((u) => u.emailTerverifikasi).length}/${users.length}`} />
      </div>
      <Card icon={Users} title={`${list.length} pengguna`} actions={<TombolEkspor nama="Daftar pengguna" laporan={ekspor} />}>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-56 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Cari nama, NIM, atau email…" value={cari} onChange={(e) => setCari(e.target.value)} className={`${inputCls} w-full pl-9`} />
          </label>
          <Select value={peran} onChange={(e) => setPeran(e.target.value)} placeholder="Semua peran" options={[{ value: 'pengelola', label: 'Dosen / asisten' }, { value: 'kpb', label: 'Mahasiswa' }]} className="w-full sm:w-48" />
          <Select value={kelasId} onChange={(e) => setKelasId(e.target.value)} placeholder="Semua kelas" options={[...kelas.map((k) => ({ value: k.id, label: k.nama })), { value: '-', label: 'Tanpa satker' }]} className="w-full sm:w-48" />
        </div>
        <Table head={['Pengguna', 'Peran', 'Kelas / satker', 'Email', '']} empty={list.length ? null : 'Tidak ada pengguna yang cocok.'}>
          {paging.isi.map((u) => {
            const s = st(u.satkerId)
            const awal = isDosenAwal(u.email)
            const saya = u.id === profil?.id
            return (
              <tr key={u.id}>
                <Td>
                  <span className="font-medium text-slate-800">{u.nama}{saya && <span className="text-slate-400"> (Anda)</span>}</span>
                  <span className="block text-xs text-slate-500">{u.nim || '—'} · {u.email}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {staf(u) ? <Badge tone="teal">Dosen</Badge> : <Badge>Mahasiswa</Badge>}
                    {awal && <Badge tone="violet">Dosen awal</Badge>}
                    {s?.apipUids?.includes(u.id) && <Badge tone="amber">APIP</Badge>}
                  </div>
                </Td>
                <Td>{s ? <>{namaKelas(u.kelasId) || '—'}<span className="block text-xs text-slate-500">{s.kode} · {s.nama}</span></> : <span className="text-xs text-slate-400">{staf(u) ? '—' : 'Belum ditempatkan'}</span>}</Td>
                <Td>{u.emailTerverifikasi ? <Badge tone="teal">Terverifikasi</Badge> : <Badge tone="amber">Belum</Badge>}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!staf(u) && <Button size="sm" variant="ghost" onClick={() => setPindah(u)}><ArrowRightLeft size={14} /> Satker</Button>}
                    {staf(u)
                      ? !awal && !saya && <Button size="sm" variant="ghost" onClick={() => gantiPeran(u, 'kpb')}>Jadikan mahasiswa</Button>
                      : <Button size="sm" variant="secondary" onClick={() => gantiPeran(u, 'pengelola')}>Jadikan dosen</Button>}
                  </div>
                </Td>
              </tr>
            )
          })}
        </Table>
        <Paging {...paging} />
        <p className="mt-3 text-xs text-slate-400">Dosen awal ditetapkan di <code>src/lib/akses.js</code> dan <code>firestore.rules</code>, aktif setelah emailnya terverifikasi, dan tidak dapat diturunkan dari panel ini. Menghapus akun Authentication memerlukan Firebase Console.</p>
      </Card>
      <Modal open={!!pindah} onClose={() => setPindah(null)} title={pindah ? `Penempatan satker — ${pindah.nama}` : ''}>
        {pindah && <FormPindah u={pindah} satker={satker} kelas={kelas} selesai={() => setPindah(null)} />}
      </Modal>
    </>
  )
}

function FormPindah({ u, satker, kelas, selesai }) {
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const [tujuan, setTujuan] = useState(u.satkerId || '')
  const [apip, setApip] = useState(!!satker.find((s) => s.id === u.satkerId)?.apipUids?.includes(u.id))
  const opsi = [...satker].sort((a, b) => a.kode.localeCompare(b.kode)).map((s) => ({ value: s.id, label: `${s.kode} · ${s.nama} (${kelas.find((k) => k.id === s.kelasId)?.nama || '—'})` }))

  async function simpan() {
    const baru = satker.find((s) => s.id === tujuan) || null
    if (!baru && !(await konfirmasi({ judul: `Keluarkan ${u.nama} dari satker?`, pesan: 'Mahasiswa tidak lagi dapat membuka data satker mana pun sampai ditempatkan kembali. Data satker tidak berubah.', ya: 'Keluarkan', bahaya: true }))) return
    try {
      await pindahkanAnggota(u, baru, { apip })
      toast.sukses(baru ? `${u.nama} ditempatkan di ${baru.kode}.` : `${u.nama} dikeluarkan dari satker.`)
      selesai()
    } catch (e) {
      toast.galat(e)
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Satker tujuan"><Select value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="— keluarkan dari satker —" options={opsi} /></Field>
      {tujuan && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={apip} onChange={(e) => setApip(e.target.checked)} /> Berperan sebagai APIP satker (mereviu RKBMN)</label>}
      <div className="flex gap-2">
        <Button onClick={simpan}>{tujuan ? 'Simpan penempatan' : 'Keluarkan dari satker'}</Button>
        <Button variant="ghost" onClick={selesai}>Batal</Button>
      </div>
    </div>
  )
}
