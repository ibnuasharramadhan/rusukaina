import { MAX_RUNS_PER_WEEK, plan, sessionOn, weekOf } from '../data/plan'
import { addDays, formatDate, type ISODate } from './date'
import { formatDuration, formatPace, paceSecPerKm } from './pace'
import { bpLevel } from './safety'
import type { DailyLog, GymLog, PlannedSession, RunLog, SessionMark, SessionStatus } from './types'

export interface WeekStat {
  no: number
  start: ISODate
  km: number
  runs: number
  gym: number
  planned: number
  done: number
}

const isTraining = (s: PlannedSession) => s.kind !== 'rest'

/** Status sesi: tanda manual menang; kalau tidak ada, lari/gym yang tercatat di tanggal itu dihitung selesai. */
export function statusOf(s: PlannedSession, marks: Map<string, SessionMark>, runs: RunLog[], gym: GymLog[]): SessionStatus | null {
  const m = marks.get(s.date)
  if (m) return m.status
  // Rencana sengaja fleksibel (mis. Rabu boleh ganti Gym B), jadi latihan apa pun yang tercatat di hari itu dihitung selesai.
  if (s.kind !== 'rest' && (runs.some((r) => r.date === s.date) || gym.some((g) => g.date === s.date))) return 'done'
  return null
}

/** Peringatan kalau lari di `date` melanggar aturan lari (maks 3/minggu, tidak 2 hari berturut-turut, tidak di hari gym/libur). */
export function runRuleWarnings(date: ISODate, runs: RunLog[]): string[] {
  const out: string[] = []
  const others = runs.filter((r) => r.date !== date)
  const plan = sessionOn(date)
  if (plan && !['easy', 'long', 'race'].includes(plan.kind)) out.push('Hari ini jadwalnya bukan lari. Hari gym/libur tidak diganti lari.')
  if (others.some((r) => r.date === addDays(date, -1) || r.date === addDays(date, 1))) out.push('Ada lari di hari sebelum/sesudahnya. Jangan lari 2 hari berturut-turut.')
  const w = weekOf(date)
  if (w && !plan?.extraRunOk) {
    const n = new Set(others.filter((r) => r.date >= w.start && r.date <= w.end).map((r) => r.date)).size
    if (n >= MAX_RUNS_PER_WEEK) out.push(`Sudah ${n} lari minggu ini. Maks ${MAX_RUNS_PER_WEEK} lari per minggu.`)
  }
  return out
}

/** Sesi latihan yang sudah lewat (sampai `until`) dan berapa yang selesai. */
export function adherence(runs: RunLog[], gym: GymLog[], marks: SessionMark[], until: ISODate): { planned: number; done: number } {
  const markMap = new Map(marks.map((m) => [m.date, m]))
  const past = plan().schedule.filter((s) => isTraining(s) && s.date <= until)
  return { planned: past.length, done: past.filter((s) => statusOf(s, markMap, runs, gym) === 'done').length }
}

export function weekStats(runs: RunLog[], gym: GymLog[], marks: SessionMark[]): WeekStat[] {
  const markMap = new Map(marks.map((m) => [m.date, m]))
  return plan().weeks.map((w) => {
    const inWeek = (d: ISODate) => d >= w.start && d <= w.end
    const wr = runs.filter((r) => inWeek(r.date))
    const sessions = plan().schedule.filter((s) => inWeek(s.date) && isTraining(s))
    return {
      no: w.no,
      start: w.start,
      km: Math.round(wr.reduce((a, r) => a + r.distanceKm, 0) * 100) / 100,
      runs: wr.length,
      gym: gym.filter((g) => inWeek(g.date)).length,
      planned: sessions.length,
      done: sessions.filter((s) => statusOf(s, markMap, runs, gym) === 'done').length,
    }
  })
}

/** Pengingat cadangan: belum pernah ekspor, atau ekspor terakhir sudah lebih dari `days` hari. */
export function backupDue(lastExportAt: number | undefined, now: number, days = 7): boolean {
  return lastExportAt == null || now - lastExportAt > days * 86_400_000
}

/** Lari tipe race yang dicatat di hari race. */
export function raceResult(runs: RunLog[], raceDate: ISODate): RunLog | undefined {
  return runs.find((r) => r.type === 'race' && r.date === raceDate)
}

/** Rata-rata tensi dari N hari terakhir yang tercatat (pagi). */
export function bpAverage(daily: DailyLog[], days: number, until: ISODate): { sys: number; dia: number; n: number } | null {
  const from = addDays(until, -(days - 1))
  const rows = daily.filter((d) => d.date >= from && d.date <= until && d.sys && d.dia)
  if (!rows.length) return null
  const sys = Math.round(rows.reduce((a, d) => a + d.sys!, 0) / rows.length)
  const dia = Math.round(rows.reduce((a, d) => a + d.dia!, 0) / rows.length)
  return { sys, dia, n: rows.length }
}

/**
 * Ringkasan teks untuk ditempel ke chat coach. Sengaja plain text supaya
 * terbaca di mana saja (chat, WhatsApp, catatan).
 */
export function coachSummary(input: { runs: RunLog[]; daily: DailyLog[]; gym: GymLog[]; until: ISODate; days?: number }): string {
  const days = input.days ?? 7
  const from = addDays(input.until, -(days - 1))
  const inRange = (d: ISODate) => d >= from && d <= input.until
  const lines: string[] = [`Laporan latihan ${formatDate(from)} – ${formatDate(input.until)}`]

  const runs = input.runs.filter((r) => inRange(r.date))
  lines.push('', `LARI (${runs.length}x, ${runs.reduce((a, r) => a + r.distanceKm, 0).toFixed(2).replace('.', ',')} km)`)
  for (const r of runs) {
    const hr = r.avgHr ? `, HR ${r.avgHr}${r.maxHr ? `/${r.maxHr}` : ''}` : ''
    lines.push(`- ${formatDate(r.date, true)}: ${r.type}, ${String(r.distanceKm).replace('.', ',')} km, ${formatDuration(r.durationSec)}, pace ${formatPace(paceSecPerKm(r.distanceKm, r.durationSec))}${hr}${r.notes ? `. ${r.notes}` : ''}`)
  }

  const gym = input.gym.filter((g) => inRange(g.date))
  lines.push('', `GYM (${gym.length}x)`)
  for (const g of gym) {
    const ex = g.exercises.filter((e) => e.setsDone > 0).map((e) => `${e.exercise}${e.weightKg ? ` ${e.weightKg}kg` : ''} ${e.setsDone}set${e.easy ? ' (ringan)' : ''}`)
    lines.push(`- ${formatDate(g.date, true)}: Gym ${g.workout}${g.rpe ? `, RPE ${g.rpe}` : ''}. ${ex.join('; ')}${g.notes ? `. ${g.notes}` : ''}`)
  }

  const daily = input.daily.filter((d) => inRange(d.date))
  lines.push('', 'TENSI & HR ISTIRAHAT')
  for (const d of daily) {
    const parts = [
      d.sys && d.dia ? `${d.sys}/${d.dia}${bpLevel(d.sys, d.dia) !== 'green' ? ' (!)' : ''}` : null,
      d.sysPm && d.diaPm ? `malam ${d.sysPm}/${d.diaPm}` : null,
      d.restingHr ? `HR ${d.restingHr}` : null,
      d.sleepHours != null ? `tidur ${d.sleepHours} j` : null,
      d.medTaken === false ? 'obat terlewat' : null,
      d.symptoms ? `keluhan: ${d.symptoms}` : null,
    ].filter(Boolean)
    lines.push(`- ${formatDate(d.date, true)}: ${parts.join(', ')}`)
  }
  const avg = bpAverage(input.daily, days, input.until)
  if (avg) lines.push(`Rata-rata tensi: ${avg.sys}/${avg.dia} (${avg.n} hari)`)
  return lines.join('\n')
}
