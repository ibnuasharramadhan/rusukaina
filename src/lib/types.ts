import type { ISODate } from './date'

export type SessionKind = 'gymA' | 'gymB' | 'easy' | 'long' | 'walk' | 'rest' | 'race'

export interface PlannedSession {
  date: ISODate
  kind: SessionKind
  title: string
  detail?: string
  /** Menit target, kalau ada. */
  minutes?: number
  /** Target jarak (km), kalau rencana menyebutkan. */
  km?: number
  /** Ada strides di sesi ini (dilarang saat tensi kuning). */
  strides?: number
}

export interface PlanWeek {
  no: number
  start: ISODate
  end: ISODate
  longRun: string
  midweek: string
  note?: string
  deload?: boolean
}

export type RunType = 'treadmill' | 'outdoor' | 'race'

export interface RunLog {
  id: string
  date: ISODate
  time?: string // "17:42"
  type: RunType
  distanceKm: number
  durationSec: number
  avgHr?: number
  maxHr?: number
  cadence?: number
  rpe?: number
  splits?: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface DailyLog {
  /** Satu entri per hari; id = tanggal. */
  date: ISODate
  restingHr?: number
  sys?: number
  dia?: number
  /** Pengukuran malam (opsional). */
  sysPm?: number
  diaPm?: number
  sleepHours?: number
  medTaken?: boolean
  symptoms?: string
  notes?: string
  updatedAt: number
}

export interface GymSet {
  exercise: string
  weightKg?: number
  setsDone: number
  /** Semua set terasa ringan (RPE < 6): kandidat naik beban. */
  easy?: boolean
}

export interface GymLog {
  id: string
  date: ISODate
  workout: 'A' | 'B'
  exercises: GymSet[]
  rpe?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export type SessionStatus = 'done' | 'skipped' | 'swapped'

export interface SessionMark {
  date: ISODate
  status: SessionStatus
  note?: string
  updatedAt: number
}

export interface Profile {
  name: string
  birthDate: ISODate
  restingHrBaseline: number
  maxHr: number
  easyCap: number
  raceDate: ISODate
  raceName: string
}

export interface ExportFile {
  app: 'pwa-latihan'
  schemaVersion: 1
  exportedAt: string
  profile: Profile
  runs: RunLog[]
  daily: DailyLog[]
  gym: GymLog[]
  marks: SessionMark[]
}
