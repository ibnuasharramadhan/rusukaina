import type { GymLog, GymSet } from '../lib/types'
import { matchMove, type MoveId } from './moves'

export interface Exercise {
  name: string
  prescription: string
  sets: number
  cue?: string
  /** Animasi gerakan; kalau kosong dicari dari nama. */
  move?: MoveId
}

export const GYM_RULES = [
  '2–3 set, 10–15 repetisi, RPE 6–7 (masih sisa 3–4 repetisi sebelum gagal).',
  'Istirahat 60–90" antar set.',
  'Naikkan beban kecil (1–2,5 kg) kalau semua set terasa ringan 2 sesi berturut-turut.',
  'Hembuskan napas saat fase berat, tarik saat turun. Jangan menahan napas / mengejan.',
]

export const WARMUP = "Pemanasan 5': sepeda statis/jalan treadmill + leg swing, hip circle."
export const COOLDOWN = "Pendinginan 3–5': jalan pelan, jangan langsung duduk/berdiri diam."

export const GYM: Record<'A' | 'B', Exercise[]> = {
  A: [
    { name: 'Goblet squat', move: 'gobletSquat', prescription: '3x10–12', sets: 3, cue: 'Dumbbell di dada' },
    { name: 'Romanian deadlift dumbbell', move: 'rdl', prescription: '3x10–12', sets: 3 },
    { name: 'Chest press machine', move: 'chestPress', prescription: '2–3x12', sets: 3 },
    { name: 'Lat pulldown', move: 'latPulldown', prescription: '2–3x12', sets: 3 },
    { name: 'Split squat / reverse lunge', move: 'splitSquat', prescription: '2x10 per kaki', sets: 2 },
    { name: 'Dead bug', move: 'deadBug', prescription: '2x10 per sisi', sets: 2 },
  ],
  B: [
    { name: 'Leg press', move: 'legPress', prescription: '3x12–15', sets: 3, cue: 'Beban sedang' },
    { name: 'Hip thrust / glute bridge', move: 'hipThrust', prescription: '3x12', sets: 3 },
    { name: 'Seated cable row', move: 'seatedRow', prescription: '2–3x12', sets: 3 },
    { name: 'Push-up', move: 'pushup', prescription: '2x8–12', sets: 2, cue: 'Incline kalau perlu' },
    { name: 'Calf raise', move: 'calfRaise', prescription: '3x15', sets: 3, cue: 'Lurus dan tekuk lutut' },
    { name: 'Side plank', move: 'sidePlank', prescription: '2x20–30" per sisi', sets: 2, cue: 'Tetap bernapas' },
  ],
}

/** Latihan yang dicatat tapi tidak ada di program Gym A/B. */
export function extraExercises(g: GymLog | undefined, workout: 'A' | 'B', program: Exercise[] = GYM[workout]): GymSet[] {
  if (!g || g.workout !== workout) return []
  const names = new Set(program.map((e) => e.name))
  return g.exercises.filter((e) => !names.has(e.exercise)).map((e) => ({ ...e }))
}

/** "2 latihan: Chest press machine 20 kg, Shoulder press 20 kg" */
export function gymSummary(g: GymLog): string {
  const done = g.exercises.filter((e) => e.setsDone > 0)
  if (!done.length) return 'Belum ada set tercatat'
  return `${done.length} latihan: ${done.map((e) => `${e.exercise}${e.weightKg ? ` ${String(e.weightKg).replace('.', ',')} kg` : ''}`).join(', ')}`
}

export function moveFor(e: Pick<Exercise, 'name' | 'move'>): MoveId | undefined {
  return e.move ?? matchMove(e.name)
}
