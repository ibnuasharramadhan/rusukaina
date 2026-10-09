// Rencana aktif. Tiap profil punya rencananya sendiri: preset dari coach
// (Ibnu) atau disusun generator dari jawaban onboarding. Semua layar membaca
// lewat plan(), sessionOn() dan weekOf() di sini.

import type { ISODate } from '../lib/date'
import type { PlannedSession, PlanWeek, Profile } from '../lib/types'
import { generatePlan } from './generator'
import { IBNU_PLAN, IBNU_PROFILE } from './presets/ibnu'

export interface WeekSpec extends PlanWeek {
  longMin?: number
  longKm?: number
  midMin?: number
  strides?: number
}

export interface Plan {
  id: string
  start: ISODate
  end: ISODate
  weeks: WeekSpec[]
  schedule: PlannedSession[]
  priorityNote: string
  raceTips: string[]
}

/** Profil lama (sebelum ada onboarding) adalah profil Ibnu. */
export const LEGACY_PROFILE = IBNU_PROFILE

let active: Plan = IBNU_PLAN

export function planFor(profile: Profile): Plan {
  const src = profile.plan ?? { kind: 'preset', id: 'ibnu-ui7k' }
  return src.kind === 'generated' ? generatePlan(src.input) : IBNU_PLAN
}

export function setActivePlan(p: Plan) {
  active = p
}

export function plan(): Plan {
  return active
}

export function sessionOn(date: ISODate): PlannedSession | undefined {
  return active.schedule.find((s) => s.date === date)
}

export function weekOf(date: ISODate): WeekSpec | undefined {
  return active.weeks.find((w) => date >= w.start && date <= w.end)
}

export const MAX_RUNS_PER_WEEK = 3

export const RUN_RULES =
  'Aturan lari: maks 3 lari per minggu, tidak lari 2 hari berturut-turut, dan hari gym/libur tidak diganti lari.'
