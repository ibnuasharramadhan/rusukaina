import { describe, expect, it } from 'vitest'
import { hrDefaults } from '../pages/Onboarding'
import type { DailyLog, RunLog } from '../lib/types'
import { easyCapFor, observedMaxHr, recentRestingHr, tanakaMaxHr } from '../lib/zones'

const day = (date: string, restingHr?: number): DailyLog => ({ date, restingHr, updatedAt: 1 })
const run = (date: string, maxHr?: number): RunLog => ({ id: date, date, type: 'outdoor', distanceKm: 5, durationSec: 1800, maxHr, createdAt: 1, updatedAt: 1 })

describe('sumber zona HR', () => {
  it('rata-rata HR istirahat 14 hari, minimal 5 catatan', () => {
    const d = ['2026-09-30', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'].map((x, i) => day(x, 58 + i))
    expect(recentRestingHr(d, '2026-10-14')).toBeUndefined() // 30 Sep di luar 14 hari → hanya 4
    expect(recentRestingHr([...d, day('2026-10-14', 62), day('2026-10-09')], '2026-10-14')).toEqual({ avg: 61, n: 5 })
    expect(recentRestingHr([...d, day('2026-10-15', 70)], '2026-10-14')).toBeUndefined()
  })

  it('HR maks tertinggi dari lari, abaikan bacaan sensor yang mustahil', () => {
    expect(observedMaxHr([])).toBeUndefined()
    expect(observedMaxHr([run('2026-10-01', 172), run('2026-10-05', 180), run('2026-10-08', 240), run('2026-10-09')])).toEqual({ hr: 180, date: '2026-10-05' })
  })

  it('rumus usia dan batas easy sama dengan onboarding', () => {
    expect(tanakaMaxHr(27)).toBe(189)
    expect(easyCapFor(58, 188)).toBe(145)
    expect(hrDefaults('1998-12-25', 58, '2026-10-14')).toEqual({ maxHr: 189, easyCap: easyCapFor(58, 189) })
  })
})
