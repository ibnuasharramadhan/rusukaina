import { describe, expect, it } from 'vitest'
import { extraExercises, gymSummary } from '../data/gym'
import type { GymLog } from '../lib/types'

const g: GymLog = {
  id: 'g', date: '2026-10-20', workout: 'A', createdAt: 0, updatedAt: 0,
  exercises: [
    { exercise: 'Goblet squat', setsDone: 0 },
    { exercise: 'Chest press machine', weightKg: 20, setsDone: 3 },
    { exercise: 'Shoulder press', weightKg: 20, setsDone: 3 },
  ],
}

describe('latihan di luar program', () => {
  it('diambil dari sesi yang diubah, hanya untuk program yang sama', () => {
    expect(extraExercises(g, 'A')).toEqual([{ exercise: 'Shoulder press', weightKg: 20, setsDone: 3 }])
    expect(extraExercises(g, 'B')).toEqual([])
    expect(extraExercises(undefined, 'A')).toEqual([])
  })
  it('ringkasan riwayat menyebut latihan yang dikerjakan', () => {
    expect(gymSummary(g)).toBe('2 latihan: Chest press machine 20 kg, Shoulder press 20 kg')
    expect(gymSummary({ ...g, exercises: [] })).toBe('Belum ada set tercatat')
  })
})
