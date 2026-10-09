import { describe, expect, it } from 'vitest'
import { generatePlan, peakLongMin, weekLayout } from '../data/generator'
import { addDays, fromISO } from '../lib/date'
import type { PlanInput } from '../lib/types'

const base: PlanInput = {
  start: '2026-10-14', raceDate: '2026-12-13', raceName: 'Jakarta 10K', raceKm: 10,
  currentMin: 20, runsPerWeek: 3, longDay: 6, gymPerWeek: 2,
}
const RUN = new Set(['easy', 'long', 'race'])

describe('generator rencana', () => {
  const combos: Partial<PlanInput>[] = [
    {}, { longDay: 0 }, { runsPerWeek: 2 }, { runsPerWeek: 2, longDay: 0, gymPerWeek: 1 }, { gymPerWeek: 0 },
    { raceKm: 5, currentMin: 10 }, { raceKm: 21.1, currentMin: 45, raceDate: '2027-03-07' },
  ]

  it.each(combos)('aturan lari selalu terpenuhi: %o', (o) => {
    const input = { ...base, ...o }
    const p = generatePlan(input)
    expect(p.schedule[0].date).toBe(input.start)
    expect(p.schedule[p.schedule.length - 1]).toMatchObject({ date: input.raceDate, kind: 'race' })
    // Setiap hari dari mulai sampai race ada tepat satu sesi.
    for (let i = 1; i < p.schedule.length; i++) expect(p.schedule[i].date).toBe(addDays(p.schedule[i - 1].date, 1))
    // Tidak ada lari 2 hari berturut-turut.
    for (let i = 1; i < p.schedule.length; i++) {
      expect(RUN.has(p.schedule[i].kind) && RUN.has(p.schedule[i - 1].kind), p.schedule[i].date).toBe(false)
    }
    // Maks 3 lari per minggu, dan jumlah gym sesuai pilihan (minggu penuh, bukan minggu race).
    for (const w of p.weeks) {
      const days = p.schedule.filter((s) => s.date >= w.start && s.date <= w.end)
      expect(days.filter((s) => RUN.has(s.kind)).length).toBeLessThanOrEqual(3)
      if (days.length === 7 && w.no < p.weeks.length) {
        expect(days.filter((s) => s.kind === 'gymA' || s.kind === 'gymB').length).toBe(input.gymPerWeek)
      }
    }
  })

  it('long run naik maks ±10% (min 5 menit), deload tiap minggu ke-4, taper sebelum race', () => {
    const p = generatePlan(base)
    const longs = p.weeks.map((w) => w.longMin ?? 0)
    expect(longs[0]).toBe(20)
    for (let i = 1; i < longs.length - 2; i++) {
      if (!p.weeks[i].deload && !p.weeks[i - 1].deload) expect(longs[i] - longs[i - 1]).toBeLessThanOrEqual(Math.max(5, Math.ceil(longs[i - 1] * 0.1 / 5) * 5))
    }
    expect(p.weeks[3].deload).toBe(true)
    expect(longs[3]).toBeLessThan(longs[2])
    expect(Math.max(...longs)).toBeLessThanOrEqual(peakLongMin(10))
    expect(p.weeks[p.weeks.length - 2].note).toMatch(/Taper/)
  })

  it('hari race tepat, dan 2 hari sebelumnya tidak lari', () => {
    const p = generatePlan({ ...base, raceDate: '2026-12-12' })
    const race = p.schedule.find((s) => s.kind === 'race')!
    expect(race.date).toBe('2026-12-12')
    expect(fromISO(race.date).getDay()).toBe(6)
    for (const d of [-1, -2]) expect(RUN.has(p.schedule.find((s) => s.date === addDays(race.date, d))!.kind)).toBe(false)
  })

  it('tata letak minggu: long run di hari pilihan, gym di hari tanpa lari', () => {
    expect(weekLayout({ runsPerWeek: 3, longDay: 6, gymPerWeek: 2 })).toEqual({ runs: [2, 4, 6], gym: [1, 3] })
    expect(weekLayout({ runsPerWeek: 2, longDay: 0, gymPerWeek: 2 })).toEqual({ runs: [3, 0], gym: [1, 4] })
  })
})

describe('taper', () => {
  it('long run taper lebih pendek dari long run terpanjang sebelumnya', () => {
    const p = generatePlan(base)
    const longs = p.weeks.map((w) => w.longMin ?? 0)
    const taper = longs[longs.length - 2]
    expect(taper).toBeLessThan(Math.max(...longs.slice(0, -2)))
  })
})
