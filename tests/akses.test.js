import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOSEN_AWAL, cekUbahPeran, isDosenAwal, isStaf, sinkronProfil } from '../src/lib/akses.js'

test('daftar dosen awal di src/lib/akses.js sama dengan firestore.rules', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  const blok = rules.slice(rules.indexOf('function dosenAwal()'), rules.indexOf('function isStaff()'))
  const daftar = [...blok.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(daftar, [...DOSEN_AWAL].sort())
  assert.ok(DOSEN_AWAL.every((e) => e === e.toLowerCase()), 'email harus huruf kecil')
})

test('dosen awal hanya berlaku setelah email terverifikasi', () => {
  assert.ok(isDosenAwal(' MujiburRohman319@Gmail.com '))
  assert.equal(isStaf({ email: DOSEN_AWAL[0], emailVerified: false }, { role: 'kpb' }), false)
  assert.equal(isStaf({ email: DOSEN_AWAL[0], emailVerified: true }, { role: 'kpb' }), true)
  assert.equal(isStaf({ email: 'lain@x.id', emailVerified: true }, { role: 'kpb' }), false)
  assert.equal(isStaf({ email: 'lain@x.id', emailVerified: false }, { role: 'pengelola' }), true)
})

test('sinkron profil: tandai verifikasi dan naikkan dosen awal', () => {
  assert.deepEqual(sinkronProfil({ email: DOSEN_AWAL[0], emailVerified: true }, { role: 'kpb' }), { emailTerverifikasi: true, role: 'pengelola' })
  assert.deepEqual(sinkronProfil({ email: 'm@x.id', emailVerified: true }, { role: 'kpb' }), { emailTerverifikasi: true })
  assert.equal(sinkronProfil({ email: DOSEN_AWAL[0], emailVerified: false }, { role: 'kpb' }), null)
  assert.equal(sinkronProfil({ email: DOSEN_AWAL[0], emailVerified: true }, { role: 'pengelola', emailTerverifikasi: true }), null)
})

test('ubah peran: tidak menurunkan diri sendiri atau dosen awal', () => {
  const saya = { id: 'u1', role: 'pengelola', email: 'd@x.id' }
  assert.equal(cekUbahPeran(saya, { id: 'u2', role: 'kpb' }, 'pengelola'), null)
  assert.match(cekUbahPeran(saya, saya, 'kpb'), /sendiri/)
  assert.match(cekUbahPeran(saya, { id: 'u3', role: 'pengelola', email: DOSEN_AWAL[0] }, 'kpb'), /Dosen awal/)
  assert.match(cekUbahPeran(saya, { id: 'u2', role: 'kpb' }, 'kpb'), /sudah sama/)
})
