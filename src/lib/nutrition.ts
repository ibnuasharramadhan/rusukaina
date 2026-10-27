import { ageOn } from './zones'
import { addDays, type ISODate } from './date'
import type { DailyLog, FoodEntry, GymLog, MealSlot, Profile, RunLog } from './types'

export const MEAL_LABEL: Record<MealSlot, string> = { pagi: 'Sarapan', siang: 'Makan siang', malam: 'Makan malam', camilan: 'Camilan & minuman' }
export const MEALS: MealSlot[] = ['pagi', 'siang', 'malam', 'camilan']

/** Slot makan menurut jam sekarang. */
export function mealForHour(h: number): MealSlot {
  if (h >= 4 && h < 10) return 'pagi'
  if (h >= 10 && h < 15) return 'siang'
  if (h >= 17 && h < 22) return 'malam'
  return 'camilan'
}

export interface FoodItem {
  name: string
  /** Porsi acuan, mis. "1 piring (150 g)". */
  portion: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  /** Kata lain untuk pencarian. */
  alias?: string
}

/**
 * Makanan sehari-hari Indonesia, angka per porsi acuan. Perkiraan dari Tabel
 * Komposisi Pangan Indonesia, daftar bahan makanan penukar Kemenkes, dan label
 * kemasan umum. Porsi warung bisa berbeda jauh, jadi anggap ini titik awal.
 */
export const FOODS: FoodItem[] = [
  { name: 'Nasi putih', portion: '1 piring (150 g)', kcal: 260, proteinG: 4.5, carbsG: 57, fatG: 0.5 },
  { name: 'Nasi merah', portion: '1 piring (150 g)', kcal: 220, proteinG: 5, carbsG: 46, fatG: 1.5 },
  { name: 'Nasi uduk', portion: '1 piring (150 g)', kcal: 300, proteinG: 5, carbsG: 50, fatG: 9 },
  { name: 'Nasi goreng', portion: '1 piring', kcal: 450, proteinG: 12, carbsG: 60, fatG: 17 },
  { name: 'Bubur ayam', portion: '1 mangkuk', kcal: 370, proteinG: 15, carbsG: 50, fatG: 12 },
  { name: 'Mie instan goreng', portion: '1 bungkus', kcal: 380, proteinG: 8, carbsG: 54, fatG: 14, alias: 'indomie' },
  { name: 'Mie instan kuah', portion: '1 bungkus', kcal: 350, proteinG: 8, carbsG: 50, fatG: 13, alias: 'indomie' },
  { name: 'Mie ayam', portion: '1 mangkuk', kcal: 450, proteinG: 18, carbsG: 60, fatG: 15 },
  { name: 'Bakso kuah dengan mie', portion: '1 mangkuk', kcal: 400, proteinG: 20, carbsG: 45, fatG: 15 },
  { name: 'Soto ayam (tanpa nasi)', portion: '1 mangkuk', kcal: 250, proteinG: 20, carbsG: 10, fatG: 14 },
  { name: 'Gado-gado', portion: '1 piring', kcal: 400, proteinG: 15, carbsG: 30, fatG: 25, alias: 'pecel ketoprak' },
  { name: 'Sate ayam + bumbu kacang', portion: '10 tusuk', kcal: 400, proteinG: 30, carbsG: 15, fatG: 25 },
  { name: 'Pecel lele (tanpa nasi)', portion: '1 ekor + sambal', kcal: 350, proteinG: 22, carbsG: 8, fatG: 25 },
  { name: 'Ayam goreng', portion: '1 potong paha', kcal: 260, proteinG: 20, carbsG: 5, fatG: 18 },
  { name: 'Ayam bakar', portion: '1 potong paha', kcal: 200, proteinG: 24, carbsG: 4, fatG: 10 },
  { name: 'Dada ayam rebus/panggang', portion: '100 g', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  { name: 'Ikan goreng', portion: '1 ekor sedang', kcal: 200, proteinG: 20, carbsG: 2, fatG: 12, alias: 'kembung bandeng nila' },
  { name: 'Rendang', portion: '1 potong (50 g)', kcal: 190, proteinG: 14, carbsG: 4, fatG: 13, alias: 'daging sapi padang' },
  { name: 'Telur rebus', portion: '1 butir', kcal: 75, proteinG: 6.5, carbsG: 0.5, fatG: 5 },
  { name: 'Telur dadar/ceplok', portion: '1 butir', kcal: 110, proteinG: 7, carbsG: 1, fatG: 9, alias: 'goreng mata sapi' },
  { name: 'Tempe goreng', portion: '2 potong (50 g)', kcal: 175, proteinG: 10, carbsG: 8, fatG: 12 },
  { name: 'Tahu goreng', portion: '2 potong (100 g)', kcal: 115, proteinG: 7, carbsG: 3, fatG: 8 },
  { name: 'Gorengan', portion: '1 buah', kcal: 140, proteinG: 2, carbsG: 15, fatG: 8, alias: 'bakwan tahu isi pisang goreng risol' },
  { name: 'Sayur bening/sop', portion: '1 mangkuk', kcal: 60, proteinG: 2, carbsG: 10, fatG: 1, alias: 'bayam sayur asem' },
  { name: 'Sayur lodeh/santan', portion: '1 mangkuk', kcal: 150, proteinG: 4, carbsG: 10, fatG: 10, alias: 'opor gulai' },
  { name: 'Tumis sayur', portion: '1 piring kecil', kcal: 100, proteinG: 3, carbsG: 6, fatG: 7, alias: 'kangkung capcay buncis' },
  { name: 'Sambal', portion: '1 sdm', kcal: 30, proteinG: 0.5, carbsG: 2, fatG: 2.5 },
  { name: 'Kerupuk', portion: '1 buah besar', kcal: 60, proteinG: 0.5, carbsG: 8, fatG: 3 },
  { name: 'Roti tawar', portion: '1 lembar', kcal: 70, proteinG: 2.5, carbsG: 13, fatG: 1 },
  { name: 'Oatmeal', portion: '40 g kering', kcal: 150, proteinG: 5, carbsG: 27, fatG: 3, alias: 'havermut' },
  { name: 'Pisang', portion: '1 buah sedang', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
  { name: 'Apel', portion: '1 buah sedang', kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 },
  { name: 'Pepaya', portion: '1 potong (100 g)', kcal: 45, proteinG: 0.5, carbsG: 11, fatG: 0.3, alias: 'buah semangka melon' },
  { name: 'Susu UHT full cream', portion: '200 ml', kcal: 130, proteinG: 6, carbsG: 10, fatG: 7 },
  { name: 'Kopi susu gula aren', portion: '1 gelas', kcal: 200, proteinG: 4, carbsG: 30, fatG: 7, alias: 'es kopi' },
  { name: 'Teh manis', portion: '1 gelas', kcal: 90, proteinG: 0, carbsG: 22, fatG: 0, alias: 'es teh' },
  { name: 'Kopi hitam tanpa gula', portion: '1 gelas', kcal: 5, proteinG: 0.3, carbsG: 0, fatG: 0 },
  { name: 'Martabak manis', portion: '1 potong', kcal: 250, proteinG: 5, carbsG: 32, fatG: 12, alias: 'terang bulan' },
  { name: 'Whey protein', portion: '1 scoop (30 g)', kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N} ]/gu, ' ')

/** Cari di daftar: setiap kata harus ada di nama atau alias. */
export function searchFoods(q: string, list = FOODS): FoodItem[] {
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return list.filter((f) => { const hay = norm(`${f.name} ${f.alias ?? ''}`); return words.every((w) => hay.includes(w)) })
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Kalikan gizi dengan jumlah porsi. */
export function scaleFood(f: Pick<FoodItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>, qty: number) {
  return { kcal: Math.round(f.kcal * qty), proteinG: r1(f.proteinG * qty), carbsG: r1(f.carbsG * qty), fatG: r1(f.fatG * qty) }
}

/** Teks porsi: "1,5 × 1 piring (150 g)". */
export function portionText(portion: string, qty: number) {
  return qty === 1 ? portion : `${String(qty).replace('.', ',')} × ${portion}`
}

export interface Favorite { name: string; portion?: string; kcal: number; proteinG?: number; carbsG?: number; fatG?: number; count: number }

/** Makanan yang paling sering dicatat dalam 60 hari terakhir, untuk ditambah sekali ketuk. */
export function favorites(foods: FoodEntry[], until: ISODate, limit = 8): Favorite[] {
  const since = addDays(until, -60)
  const map = new Map<string, Favorite & { last: number }>()
  for (const f of foods) {
    if (f.date < since || f.date > until) continue
    const key = `${f.name.trim().toLowerCase()}|${f.portion ?? ''}`
    const cur = map.get(key)
    const at = f.updatedAt
    if (!cur || at >= cur.last) map.set(key, { name: f.name, portion: f.portion, kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, count: (cur?.count ?? 0) + 1, last: at })
    else cur.count++
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit)
    .map(({ last: _last, ...f }) => f)
}

// ---------- Energi keluar

/** BMR Mifflin-St Jeor (kkal/hari). */
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: 'm' | 'f') {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161))
}

/** Faktor aktivitas harian di luar olahraga: kerja kantoran banyak duduk. */
export const DAILY_FACTOR = 1.2

/** Perkiraan kalori olahraga bila jam tidak mencatat: lari ±1 kkal/kg/km, jalan ±0,5. */
export function activityKcal(r: RunLog, weightKg: number) {
  if (r.kcal) return r.kcal
  return Math.round((r.type === 'walk' ? 0.5 : 1) * weightKg * r.distanceKm)
}

/** Gym beban ±45 menit, MET 3,5 dikurangi energi istirahat. */
export function gymKcal(g: GymLog, weightKg: number) {
  return g.kcal ?? Math.round((3.5 - 1) * weightKg * 0.75)
}

/** Berat terakhir yang dicatat sampai tanggal itu. */
export function weightOn(daily: DailyLog[], date: ISODate): number | undefined {
  let w: number | undefined
  for (const d of [...daily].sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.date > date) break
    if (d.weightKg) w = d.weightKg
  }
  return w ?? [...daily].sort((a, b) => a.date.localeCompare(b.date)).find((d) => d.weightKg)?.weightKg
}

export interface Totals { kcal: number; proteinG: number; carbsG: number; fatG: number }

export function totals(foods: FoodEntry[]): Totals {
  const t = foods.reduce((s, f) => ({ kcal: s.kcal + f.kcal, proteinG: s.proteinG + (f.proteinG ?? 0), carbsG: s.carbsG + (f.carbsG ?? 0), fatG: s.fatG + (f.fatG ?? 0) }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  return { kcal: Math.round(t.kcal), proteinG: r1(t.proteinG), carbsG: r1(t.carbsG), fatG: r1(t.fatG) }
}

export interface Balance {
  date: ISODate
  in: Totals
  /** Kosong bila profil belum lengkap (tinggi, jenis kelamin, berat). */
  out?: {
    bmr: number
    /** BMR × faktor harian. */
    base: number
    exercise: number
    total: number
    /** Ada kalori olahraga yang diperkirakan (bukan dari jam). */
    estimated: boolean
  }
  /** Target makan: total keluar − 500, tidak di bawah batas aman. */
  target?: number
  /** Target protein (g): 1,2 g/kg, cukup untuk menjaga otot saat defisit. */
  proteinTarget?: number
  weightKg?: number
}

/** Defisit 500 kkal/hari ≈ turun 0,5 kg per minggu. */
export const DEFICIT = 500
export const MIN_INTAKE = { m: 1500, f: 1200 } as const

export function dailyBalance(date: ISODate, data: { profile: Profile; daily: DailyLog[]; foods: FoodEntry[]; runs: RunLog[]; walks: RunLog[]; gym: GymLog[] }): Balance {
  const { profile } = data
  const inT = totals(data.foods.filter((f) => f.date === date))
  const w = weightOn(data.daily, date)
  if (!w || !profile.heightCm || !profile.sex) return { date, in: inT, weightKg: w }
  const bmr = bmrMifflin(w, profile.heightCm, ageOn(profile.birthDate, date), profile.sex)
  const base = Math.round(bmr * DAILY_FACTOR)
  const acts = [...data.runs, ...data.walks].filter((r) => r.date === date)
  const gyms = data.gym.filter((g) => g.date === date)
  const exercise = acts.reduce((s, r) => s + activityKcal(r, w), 0) + gyms.reduce((s, g) => s + gymKcal(g, w), 0)
  const estimated = acts.some((r) => !r.kcal) || gyms.some((g) => !g.kcal)
  const total = base + exercise
  return {
    date, in: inT, weightKg: w,
    out: { bmr, base, exercise, total, estimated },
    target: Math.max(MIN_INTAKE[profile.sex], total - DEFICIT),
    proteinTarget: Math.round(1.2 * w),
  }
}
