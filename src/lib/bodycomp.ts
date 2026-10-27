import type { ISODate } from './date'
import type { Level } from './safety'
import type { DailyLog } from './types'

export type Sex = 'm' | 'f'

export interface Band { to: number; label: string; level: Level; /** Angka yang ditampilkan di skala (default: to). */ tick?: number }
export interface Reading { value: number; band: Band }

/**
 * IMT/BMI kategori Kemenkes RI (P2PTM): kurus < 18,5; normal 18,5–25,0;
 * gemuk 25,1–27,0; obesitas > 27,0.
 */
export const BMI_BANDS: Band[] = [
  { to: 18.5, label: 'Kurus', level: 'yellow' },
  { to: 25.05, label: 'Normal', level: 'green', tick: 25 },
  { to: 27.05, label: 'Gemuk (overweight)', level: 'yellow', tick: 27 },
  { to: Infinity, label: 'Obesitas', level: 'red' },
]

/** Batas obesitas sentral (lingkar perut) Kemenkes/IDF untuk Asia: pria ≥ 90 cm, wanita ≥ 80 cm. */
export const WAIST_LIMIT: Record<Sex, number> = { m: 90, f: 80 }

/** Rasio lingkar pinggang : tinggi badan (NICE 2022): < 0,5 sehat, 0,5–0,59 meningkat, ≥ 0,6 tinggi. */
export const WHTR_BANDS: Band[] = [
  { to: 0.4, label: 'Rendah', level: 'yellow' },
  { to: 0.5, label: 'Sehat', level: 'green' },
  { to: 0.6, label: 'Risiko meningkat', level: 'yellow' },
  { to: Infinity, label: 'Risiko tinggi', level: 'red' },
]

const bandOf = (bands: Band[], v: number) => bands.find((b) => v < b.to) ?? bands[bands.length - 1]
const round1 = (v: number) => Math.round(v * 10) / 10

export function bmi(weightKg: number, heightCm: number): Reading {
  const value = round1(weightKg / (heightCm / 100) ** 2)
  return { value, band: bandOf(BMI_BANDS, value) }
}

export function waist(waistCm: number, sex: Sex): Reading {
  const limit = WAIST_LIMIT[sex]
  return {
    value: waistCm,
    band: waistCm < limit ? { to: limit, label: 'Di bawah batas', level: 'green' } : { to: Infinity, label: 'Obesitas sentral', level: 'red' },
  }
}

export function whtr(waistCm: number, heightCm: number): Reading {
  const value = Math.round((waistCm / heightCm) * 100) / 100
  return { value, band: bandOf(WHTR_BANDS, value) }
}

/** Berat badan untuk BMI tertentu (mis. batas normal 25,0). */
export function weightForBmi(target: number, heightCm: number): number {
  return round1(target * (heightCm / 100) ** 2)
}

/** Lingkar perut yang disarankan: di bawah setengah tinggi badan dan di bawah batas obesitas sentral. */
export function waistTarget(heightCm: number, sex?: Sex): number {
  const half = round1(heightCm / 2)
  return sex ? Math.min(half, WAIST_LIMIT[sex]) : half
}

export interface Measure { date: ISODate; value: number }

/** Riwayat berat dan lingkar perut dari catatan harian, urut tanggal. */
export function measures(daily: DailyLog[]): { weight: Measure[]; waist: Measure[] } {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  return {
    weight: sorted.flatMap((d) => (d.weightKg ? [{ date: d.date, value: d.weightKg }] : [])),
    waist: sorted.flatMap((d) => (d.waistCm ? [{ date: d.date, value: d.waistCm }] : [])),
  }
}
