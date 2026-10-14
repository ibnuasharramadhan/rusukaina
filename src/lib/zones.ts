import { addDays, fromISO, type ISODate } from './date'
import type { DailyLog, RunLog } from './types'

export interface Zone {
  id: string
  name: string
  low: number
  high: number | null
  use: string
}

export function ageOn(birth: ISODate, on: ISODate): number {
  const b = fromISO(birth)
  const d = fromISO(on)
  let age = d.getFullYear() - b.getFullYear()
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--
  return age
}

/** Zona Karvonen: HR istirahat + persentase cadangan HR (HRmax − HRrest). */
export function karvonenZones(rest: number, max: number): Zone[] {
  const hrr = max - rest
  const at = (p: number) => Math.round(rest + hrr * p)
  return [
    { id: 'z1', name: 'Z1 Pemulihan', low: at(0.5), high: at(0.6), use: 'Jalan cepat, pendinginan' },
    { id: 'z2', name: 'Z2 Easy (aerobik)', low: at(0.6), high: at(0.7), use: 'Hampir semua lari sampai race' },
    { id: 'z3', name: 'Z3 Tempo ringan', low: at(0.7), high: at(0.8), use: 'Hanya di race day, bagian tengah' },
    { id: 'z4', name: 'Z4 Threshold', low: at(0.8), high: at(0.9), use: 'Belum dipakai di rencana ini' },
    { id: 'z5', name: 'Z5 Maksimal', low: at(0.9), high: null, use: 'Tidak dipakai' },
  ]
}

export function zoneFor(hr: number, zones: Zone[]): Zone | undefined {
  for (let i = zones.length - 1; i >= 0; i--) if (hr >= zones[i].low) return zones[i]
  return undefined
}

/** MAF: 180 − umur, dikurangi 10 karena minum obat rutin. */
export function mafHr(age: number, onMedication: boolean): number {
  return 180 - age - (onMedication ? 10 : 0)
}

/** HR maks dari usia (Tanaka: 208 − 0,7 × usia). Hanya tebakan awal; HR tertinggi yang pernah terukur lebih akurat. */
export function tanakaMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

/** Batas lari easy ≈ 67% cadangan HR (Karvonen). */
export function easyCapFor(rest: number, max: number): number {
  return Math.round(rest + 0.67 * (max - rest))
}

/** Rata-rata HR istirahat dalam `days` hari terakhir; butuh minimal 5 catatan supaya tidak bergantung satu pagi. */
export function recentRestingHr(daily: DailyLog[], until: ISODate, days = 14): { avg: number; n: number } | undefined {
  const from = addDays(until, -(days - 1))
  const vals = daily.filter((d) => d.date >= from && d.date <= until && d.restingHr).map((d) => d.restingHr!)
  if (vals.length < 5) return undefined
  return { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), n: vals.length }
}

/** HR tertinggi yang pernah tercatat saat lari (nilai di atas 220 dianggap salah baca sensor). */
export function observedMaxHr(runs: RunLog[]): { hr: number; date: ISODate } | undefined {
  let best: { hr: number; date: ISODate } | undefined
  for (const r of runs) if (r.maxHr && r.maxHr <= 220 && (!best || r.maxHr > best.hr)) best = { hr: r.maxHr, date: r.date }
  return best
}
