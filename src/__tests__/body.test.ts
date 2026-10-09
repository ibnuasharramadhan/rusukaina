import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultShoeId, painVerdict, recurringPain, shoeKm, shoeState } from '../lib/body'
import { exportAll, importAll, listShoes, resetConnection, saveShoe, wipeAll } from '../lib/db'
import { readiness } from '../lib/safety'
import { coachSummary } from '../lib/stats'
import type { DailyLog, RunLog, Shoe } from '../lib/types'

const day = (date: string, painAreas?: string[], painScore?: number): DailyLog => ({ date, painAreas, painScore, updatedAt: 1 })
const run = (date: string, km: number, shoeId?: string): RunLog => ({ id: date, date, type: 'outdoor', distanceKm: km, durationSec: km * 420, shoeId, createdAt: 1, updatedAt: 1 })
const shoe = (id: string, o: Partial<Shoe> = {}): Shoe => ({ id, name: id, startKm: 0, limitKm: 700, createdAt: 1, updatedAt: 1, ...o })

describe('nyeri', () => {
  it('tanpa nyeri tidak mengubah kesiapan', () => {
    expect(painVerdict([], '2026-10-09').level).toBe('unknown')
    const r = readiness({ restingHr: 58, sleepHours: 7, baseline: 58, trackBp: false, pain: painVerdict([], '2026-10-09') })
    expect(r).toMatchObject({ level: 'green', canTrain: true })
  })

  it('ringan = pantau, sedang = lebih ringan, berat = tidak lari', () => {
    expect(painVerdict([day('2026-10-09', ['Betis'], 2)], '2026-10-09').level).toBe('green')
    const mid = painVerdict([day('2026-10-09', ['Lutut'], 5)], '2026-10-09')
    expect(mid).toMatchObject({ level: 'yellow' })
    expect(mid.advice[0]).toMatch(/lutut skala 5/)
    const bad = painVerdict([day('2026-10-09', ['Achilles'], 7)], '2026-10-09')
    expect(bad.level).toBe('red')
    const r = readiness({ restingHr: 58, sleepHours: 7, baseline: 58, trackBp: false, pain: bad })
    expect(r).toMatchObject({ level: 'red', canTrain: false, headline: bad.title })
  })

  it('nyeri di tempat sama 3 hari dalam seminggu = istirahatkan lari, meski ringan', () => {
    const daily = [day('2026-10-04', ['Tulang kering'], 2), day('2026-10-07', ['Tulang kering', 'Betis'], 2), day('2026-10-09', ['Tulang kering'], 2)]
    expect(recurringPain(daily, '2026-10-09')).toEqual(['Tulang kering'])
    expect(painVerdict(daily, '2026-10-09')).toMatchObject({ level: 'red', title: expect.stringMatching(/tulang kering berulang/) })
    // Lebih dari 7 hari lalu tidak dihitung.
    expect(recurringPain(daily, '2026-10-12')).toEqual([])
  })

  it('nyeri tidak menutupi tensi kritis', () => {
    const r = readiness({ sys: 185, dia: 115, baseline: 58, pain: painVerdict([day('2026-10-09', ['Lutut'], 7)], '2026-10-09') })
    expect(r.level).toBe('critical')
    expect(r.headline).not.toMatch(/Nyeri/)
  })

  it('masuk ringkasan coach', () => {
    const text = coachSummary({ runs: [], daily: [day('2026-10-09', ['Lutut', 'Betis'], 4)], gym: [], until: '2026-10-09' })
    expect(text).toMatch(/nyeri lutut, betis 4\/10/)
  })
})

describe('sepatu', () => {
  it('km = jarak awal + lari yang memakainya; status ganti', () => {
    const s = shoe('a', { startKm: 600 })
    expect(shoeKm(s, [run('2026-10-01', 5.15, 'a'), run('2026-10-03', 6.34, 'a'), run('2026-10-05', 7, 'b')])).toBe(611.5)
    expect(shoeState(500, 700)).toBe('ok')
    expect(shoeState(640, 700)).toBe('soon')
    expect(shoeState(700, 700)).toBe('replace')
  })

  it('sepatu default = terakhir dipakai yang masih aktif, atau satu-satunya', () => {
    expect(defaultShoeId([shoe('a')], [])).toBe('a')
    expect(defaultShoeId([shoe('a'), shoe('b')], [])).toBeUndefined()
    expect(defaultShoeId([shoe('a'), shoe('b')], [run('2026-10-01', 5, 'a'), run('2026-10-03', 5, 'b')])).toBe('b')
    expect(defaultShoeId([shoe('a'), shoe('b', { retired: true })], [run('2026-10-03', 5, 'b')])).toBe('a')
  })
})

describe('sepatu di IndexedDB', () => {
  beforeEach(async () => {
    await resetConnection()
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('latihan'); r.onsuccess = () => res() })
  })

  it('ikut ekspor, dan impor menggabungkan (yang lebih baru menang)', async () => {
    await saveShoe(shoe('a', { name: 'Lama', updatedAt: 5 }))
    const file = await exportAll()
    expect(file.shoes).toHaveLength(1)
    await wipeAll()
    await saveShoe(shoe('b'))
    const res = await importAll({ ...file, shoes: [...file.shoes!, shoe('b', { name: 'Usang', updatedAt: 0 })] })
    expect(res.shoes).toBe(1)
    expect((await listShoes()).map((s) => s.name).sort()).toEqual(['Lama', 'b'])
    // File ekspor lama tanpa sepatu tetap bisa diimpor.
    const { shoes: _, ...old } = file
    await expect(importAll(old)).resolves.toMatchObject({ shoes: 0 })
  })
})
