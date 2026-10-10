// Obat tensi: jadwal minum, minggu pertama obat baru, dan keluhan yang perlu dicek.
// Semua murni fungsi supaya mudah dites.

import { addDays, diffDays, type ISODate } from './date'
import type { Verdict } from './safety'
import type { DailyLog, MedDose, Profile } from './types'

/** "06:00 Amlodipin + Captopril, 18.00 Captopril" → [{time:'06:00', label:'Amlodipin + Captopril'}, ...] */
export function parseMedSchedule(text: string): MedDose[] {
  const out: MedDose[] = []
  for (const part of text.split(/[,;\n]/)) {
    const m = part.trim().match(/^(\d{1,2})[.:](\d{2})\s*(.*)$/)
    if (!m) continue
    const h = Number(m[1]), min = Number(m[2])
    if (h > 23 || min > 59) continue
    const time = `${String(h).padStart(2, '0')}:${m[2]}`
    if (out.some((d) => d.time === time)) continue
    out.push({ time, ...(m[3].trim() ? { label: m[3].trim() } : {}) })
  }
  return out.sort((a, b) => a.time.localeCompare(b.time))
}

export function formatMedSchedule(doses: MedDose[] = []): string {
  return doses.map((d) => (d.label ? `${d.time} ${d.label}` : d.time)).join(', ')
}

export const NEW_MED_DAYS = 7

/** Hari terakhir masa "minggu pertama obat baru", atau undefined bila sudah lewat / tidak ada. */
export function newMedUntil(profile: Pick<Profile, 'medName' | 'medStart'>, date: ISODate): ISODate | undefined {
  if (!profile.medName || !profile.medStart) return undefined
  const d = diffDays(profile.medStart, date)
  return d >= 0 && d <= NEW_MED_DAYS ? addDays(profile.medStart, NEW_MED_DAYS) : undefined
}

/** Dosis yang jamnya sudah lewat tapi belum ditandai diminum. */
export function overdueDoses(schedule: MedDose[], taken: string[] = [], now: string): MedDose[] {
  return schedule.filter((d) => d.time <= now && !taken.includes(d.time))
}

/** Pusing atau batuk kering saat minum obat tensi. */
export function symptomVerdict(d?: Pick<DailyLog, 'dizzy' | 'dryCough'>): Verdict {
  if (d?.dizzy) {
    return {
      level: 'red', title: 'Pusing: jangan latihan hari ini',
      advice: ['Pusing bisa tanda tensi turun terlalu rendah karena obat.', 'Duduk atau berbaring, minum air, jalan santai saja kalau sudah enak. Kabari dokter kalau berulang.'],
    }
  }
  if (d?.dryCough) {
    return {
      level: 'yellow', title: 'Batuk kering: latihan versi ringan',
      advice: ['Batuk kering bisa efek samping obat tensi. Sampaikan ke dokter saat kontrol, jangan berhenti obat sendiri.'],
    }
  }
  return { level: 'unknown', title: 'Tidak ada keluhan', advice: [] }
}

/** Entri harian berisi data cek pagi (bukan cuma tanda minum obat). */
export function hasCheckin(d?: DailyLog): boolean {
  if (!d) return false
  return d.restingHr != null || d.sleepHours != null || d.sys != null || !!d.painAreas?.length || !!d.dizzy || !!d.dryCough
    || d.symptoms != null || d.notes != null || d.medDoses == null
}
