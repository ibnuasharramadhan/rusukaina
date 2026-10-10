// Nyeri dan sepatu. Aturan nyeri dibuat konservatif: nyeri ringan dipantau,
// nyeri sedang = lari diganti latihan ringan, nyeri berat atau nyeri yang
// berulang di tempat yang sama = istirahat lari dan periksakan.

import { addDays, type ISODate } from './date'
import { newMedUntil, symptomVerdict } from './meds'
import { readiness, type Readiness, type Verdict } from './safety'
import type { DailyLog, Profile, RunLog, Shoe } from './types'

/** Kesiapan satu hari dari profil + catatan harian (tensi, HR, tidur, nyeri, keluhan obat). */
export function dayReadiness(profile: Profile, daily: DailyLog[], date: ISODate): Readiness {
  const d = daily.find((x) => x.date === date)
  return readiness({
    sys: d?.sys, dia: d?.dia, restingHr: d?.restingHr, sleepHours: d?.sleepHours, baseline: profile.restingHrBaseline,
    trackBp: profile.trackBp, hypertension: !!profile.medName, pain: painVerdict(daily, date),
    symptoms: profile.medName ? symptomVerdict(d) : undefined, newMedication: !!newMedUntil(profile, date),
  })
}

export const PAIN_AREAS = ['Lutut', 'Tulang kering', 'Betis', 'Achilles', 'Telapak kaki', 'Pergelangan kaki', 'Paha belakang', 'Pinggul', 'Punggung bawah']

/** Area yang muncul ≥ 3 hari dalam 7 hari terakhir (termasuk hari ini). */
export function recurringPain(daily: DailyLog[], date: ISODate): string[] {
  const from = addDays(date, -6)
  const count = new Map<string, number>()
  for (const d of daily) {
    if (d.date < from || d.date > date) continue
    for (const a of d.painAreas ?? []) count.set(a, (count.get(a) ?? 0) + 1)
  }
  return [...count].filter(([, n]) => n >= 3).map(([a]) => a)
}

export function painVerdict(daily: DailyLog[], date: ISODate): Verdict {
  const d = daily.find((x) => x.date === date)
  const areas = d?.painAreas ?? []
  const score = d?.painScore
  const where = areas.length ? areas.join(', ').toLowerCase() : 'badan'
  const recurring = recurringPain(daily, date).filter((a) => areas.includes(a))
  if (!areas.length && !score) return { level: 'unknown', title: 'Tidak ada nyeri tercatat', advice: [] }
  if (score != null && score >= 6) {
    return {
      level: 'red', title: 'Nyeri berat: jangan lari hari ini',
      advice: [`Nyeri ${where} skala ${score}/10.`, 'Istirahatkan lari. Kalau tidak membaik dalam 2–3 hari, atau bengkak/sulit menapak, periksakan ke dokter atau fisioterapis.'],
    }
  }
  if (recurring.length) {
    return {
      level: 'red', title: `Nyeri ${recurring.join(', ').toLowerCase()} berulang: istirahatkan lari`,
      advice: [`Nyeri di tempat yang sama muncul 3 hari atau lebih dalam seminggu.`, 'Ganti lari dengan jalan santai atau gym tanpa beban di area itu, dan periksakan ke dokter atau fisioterapis.'],
    }
  }
  if (score != null && score >= 4) {
    return {
      level: 'yellow', title: 'Nyeri sedang: latihan lebih ringan',
      advice: [`Nyeri ${where} skala ${score}/10.`, 'Lari diganti jalan atau dipendekkan. Berhenti kalau nyeri bertambah saat bergerak.'],
    }
  }
  return {
    level: 'green', title: 'Nyeri ringan: pantau',
    advice: [`Nyeri ${where}${score ? ` skala ${score}/10` : ''}. Boleh latihan; berhenti kalau nyeri naik atau cara lari berubah.`],
  }
}

/** Total km sepatu: jarak awal + semua lari/jalan yang memakainya. */
export function shoeKm(shoe: Shoe, activities: RunLog[]): number {
  const km = activities.filter((r) => r.shoeId === shoe.id).reduce((s, r) => s + r.distanceKm, shoe.startKm)
  return Math.round(km * 10) / 10
}

export type ShoeState = 'ok' | 'soon' | 'replace'

export function shoeState(km: number, limitKm: number): ShoeState {
  if (km >= limitKm) return 'replace'
  if (km >= limitKm * 0.9) return 'soon'
  return 'ok'
}

/** Sepatu default untuk lari baru: yang terakhir dipakai, kalau masih aktif. */
export function defaultShoeId(shoes: Shoe[], activities: RunLog[]): string | undefined {
  const active = shoes.filter((s) => !s.retired)
  const last = [...activities].reverse().find((r) => r.shoeId && active.some((s) => s.id === r.shoeId))
  return last?.shoeId ?? (active.length === 1 ? active[0].id : undefined)
}
