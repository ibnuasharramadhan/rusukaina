import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { activityKcal, bmrMifflin, dailyBalance, favorites, mealForHour, portionText, scaleFood, searchFoods, weightOn } from '../lib/nutrition'
import { parseAiResult } from '../lib/foodAi'
import { exportAll, importAll, listFoods, listRuns, resetConnection, saveFood, wipeAll } from '../lib/db'
import type { FoodEntry, Profile, RunLog } from '../lib/types'

const profile: Profile = { name: 'Rina', birthDate: '1996-03-10', restingHrBaseline: 62, maxHr: 186, easyCap: 145, raceDate: '2026-12-13', raceName: 'Jakarta 10K', trackBp: false, sex: 'f', heightCm: 160 }
const food = (p: Partial<FoodEntry>): FoodEntry => ({ id: Math.random().toString(36), date: '2026-10-27', meal: 'siang', name: 'Nasi putih', kcal: 260, source: 'daftar', createdAt: 1, updatedAt: 1, ...p })
const run = (p: Partial<RunLog>): RunLog => ({ id: 'r', date: '2026-10-27', type: 'treadmill', distanceKm: 5, durationSec: 2100, createdAt: 1, updatedAt: 1, ...p })

describe('gizi', () => {
  it('BMR Mifflin-St Jeor', () => {
    expect(bmrMifflin(70, 170, 30, 'm')).toBe(1618)
    expect(bmrMifflin(60, 160, 30, 'f')).toBe(1289)
  })

  it('cari makanan: semua kata, termasuk alias', () => {
    expect(searchFoods('nasi').map((f) => f.name)).toContain('Nasi goreng')
    expect(searchFoods('indomie').length).toBe(2)
    expect(searchFoods('es teh')[0].name).toBe('Teh manis')
    expect(searchFoods('  ')).toEqual([])
  })

  it('porsi dikali', () => {
    expect(scaleFood({ kcal: 260, proteinG: 4.5, carbsG: 57, fatG: 0.5 }, 1.5)).toEqual({ kcal: 390, proteinG: 6.8, carbsG: 85.5, fatG: 0.8 })
    expect(portionText('1 piring', 1)).toBe('1 piring')
    expect(portionText('1 piring', 0.5)).toBe('0,5 × 1 piring')
  })

  it('slot makan dari jam', () => {
    expect(mealForHour(7)).toBe('pagi')
    expect(mealForHour(12)).toBe('siang')
    expect(mealForHour(16)).toBe('camilan')
    expect(mealForHour(19)).toBe('malam')
    expect(mealForHour(23)).toBe('camilan')
  })

  it('kalori olahraga: dari jam bila ada, kalau tidak diperkirakan', () => {
    expect(activityKcal(run({ kcal: 410 }), 70)).toBe(410)
    expect(activityKcal(run({}), 70)).toBe(350)
    expect(activityKcal(run({ type: 'walk', distanceKm: 3 }), 70)).toBe(105)
  })

  it('berat terakhir sampai tanggal itu', () => {
    const daily = [{ date: '2026-10-20', weightKg: 62, updatedAt: 1 }, { date: '2026-10-26', weightKg: 61.5, updatedAt: 1 }]
    expect(weightOn(daily, '2026-10-27')).toBe(61.5)
    expect(weightOn(daily, '2026-10-22')).toBe(62)
    expect(weightOn(daily, '2026-10-01')).toBe(62)
    expect(weightOn([], '2026-10-01')).toBeUndefined()
  })

  it('neraca harian: masuk, keluar, target defisit 500', () => {
    const daily = [{ date: '2026-10-26', weightKg: 60, updatedAt: 1 }]
    const foods = [food({ kcal: 260, proteinG: 4.5 }), food({ name: 'Ayam bakar', kcal: 200, proteinG: 24 }), food({ date: '2026-10-26', kcal: 999 })]
    const b = dailyBalance('2026-10-27', { profile, daily, foods, runs: [run({ kcal: 300 })], walks: [], gym: [] })
    expect(b.in).toMatchObject({ kcal: 460, proteinG: 28.5 })
    // BMR 1289 (umur 30) × 1,2 = 1547, + lari 300
    expect(b.out).toMatchObject({ bmr: 1289, base: 1547, exercise: 300, total: 1847, estimated: false })
    expect(b.target).toBe(1347)
    expect(b.proteinTarget).toBe(72)
  })

  it('target tidak di bawah batas aman; tanpa profil lengkap tidak ada target', () => {
    const daily = [{ date: '2026-10-26', weightKg: 45, updatedAt: 1 }]
    expect(dailyBalance('2026-10-27', { profile, daily, foods: [], runs: [], walks: [], gym: [] }).target).toBe(1200)
    const b = dailyBalance('2026-10-27', { profile: { ...profile, heightCm: undefined }, daily, foods: [], runs: [], walks: [], gym: [] })
    expect(b.out).toBeUndefined()
    expect(b.target).toBeUndefined()
  })

  it('favorit: paling sering dalam 60 hari, angka dari catatan terbaru', () => {
    const foods = [
      food({ name: 'Oatmeal', kcal: 150, date: '2026-10-25', updatedAt: 1 }),
      food({ name: 'oatmeal', kcal: 160, date: '2026-10-26', updatedAt: 2 }),
      food({ name: 'Oatmeal', kcal: 150, date: '2026-10-24', updatedAt: 0 }),
      food({ name: 'Martabak manis', date: '2026-10-20' }),
      food({ name: 'Bubur', date: '2026-07-01' }),
    ]
    const favs = favorites(foods, '2026-10-27')
    expect(favs.map((f) => f.name)).toEqual(['oatmeal', 'Martabak manis'])
    expect(favs[0]).toMatchObject({ kcal: 160, count: 3 })
  })

  it('jawaban AI dirapikan', () => {
    const r = parseAiResult('```json\n{"items":[{"name":" Nasi ","portion":"1 piring","kcal":259.6,"proteinG":4.44,"carbsG":-3,"fatG":"x"},{"name":""}],"note":" "}\n```')
    expect(r).toEqual({ items: [{ name: 'Nasi', portion: '1 piring', kcal: 260, proteinG: 4.4, carbsG: 0, fatG: 0 }], note: undefined })
  })
})

describe('makanan di IndexedDB', () => {
  beforeEach(async () => {
    await resetConnection()
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('latihan'); r.onsuccess = () => res() })
  })

  it('ikut ekspor dan impor', async () => {
    await saveFood(food({ id: 'f1' }))
    const file = await exportAll()
    expect(file.foods).toHaveLength(1)
    await wipeAll()
    const res = await importAll(JSON.parse(JSON.stringify(file)))
    expect(res.foods).toBe(1)
    expect((await listFoods())[0].name).toBe('Nasi putih')
  })

  it('HP dengan database versi 1 naik ke versi 2 tanpa kehilangan data', async () => {
    await new Promise<void>((res) => {
      const r = indexedDB.open('latihan', 1)
      r.onupgradeneeded = () => {
        const d = r.result
        d.createObjectStore('runs', { keyPath: 'id' }).createIndex('date', 'date')
        for (const s of ['daily', 'marks']) d.createObjectStore(s, { keyPath: 'date' })
        d.createObjectStore('gym', { keyPath: 'id' }).createIndex('date', 'date')
        d.createObjectStore('meta')
        r.transaction!.objectStore('runs').put(run({ id: 'lama' }))
      }
      r.onsuccess = () => { r.result.close(); res() }
    })
    expect((await listRuns()).map((x) => x.id)).toEqual(['lama'])
    expect(await listFoods()).toEqual([])
  })

  it('file cadangan lama tanpa makanan tetap bisa diimpor', async () => {
    const res = await importAll({ app: 'pwa-latihan', schemaVersion: 1, exportedAt: '', runs: [], daily: [], gym: [], marks: [] })
    expect(res.foods).toBe(0)
  })
})
