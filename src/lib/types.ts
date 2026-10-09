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
  /** Pengecualian yang disetujui coach untuk batas 3 lari/minggu. */
  extraRunOk?: boolean
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

/** 'walk' = jalan kaki: disimpan bersama lari, tapi tidak dihitung sebagai lari. */
export type RunType = 'treadmill' | 'outdoor' | 'race' | 'walk'

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
  /** Sepatu yang dipakai (lihat Shoe). */
  shoeId?: string
  createdAt: number
  updatedAt: number
}

export interface Shoe {
  id: string
  name: string
  /** Jarak yang sudah ditempuh sebelum dicatat di aplikasi. */
  startKm: number
  /** Batas ganti (km), umumnya 500–800. */
  limitKm: number
  retired?: boolean
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
  /** Bagian tubuh yang nyeri hari ini (lihat PAIN_AREAS). */
  painAreas?: string[]
  /** Skala nyeri 1–10 (yang paling sakit). */
  painScore?: number
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
  /** Punya tensimeter: tampilkan input & grafik tensi. Default mati. */
  trackBp: boolean
  /** Nama obat tensi yang diminum rutin (mis. "Amlodipin"); kosong = tidak ada. */
  medName?: string
  /** Sumber rencana. Kosong = profil lama milik Ibnu (preset). */
  plan?: PlanSource
}

/** Rencana dari preset coach, atau disusun otomatis dari jawaban onboarding. */
export type PlanSource = { kind: 'preset'; id: 'ibnu-ui7k' } | { kind: 'generated'; input: PlanInput }

export interface PlanInput {
  /** Hari pertama rencana. */
  start: ISODate
  raceDate: ISODate
  raceName: string
  raceKm: number
  /** Lari nonstop terlama saat ini, dalam menit. */
  currentMin: number
  runsPerWeek: 2 | 3
  /** Hari long run: 6 = Sabtu, 0 = Minggu. */
  longDay: 0 | 6
  gymPerWeek: 0 | 1 | 2
}

export interface ExportFile {
  app: 'pwa-latihan'
  schemaVersion: 1
  exportedAt: string
  profile?: Profile
  runs: RunLog[]
  daily: DailyLog[]
  gym: GymLog[]
  marks: SessionMark[]
  /** Opsional supaya file ekspor lama tetap bisa diimpor. */
  shoes?: Shoe[]
}
