import { describe, expect, it } from 'vitest'
import { setActivePlan } from '../data/plan'
import { IBNU_PLAN, IBNU_PROFILE } from '../data/presets/ibnu'
import { cardData, parseSplits, shareFileName } from '../lib/shareCard'
import type { RunLog } from '../lib/types'

setActivePlan(IBNU_PLAN)

const run: RunLog = {
  id: 'r', date: '2026-10-08', time: '18:10', type: 'treadmill', distanceKm: 6.34, durationSec: 2657,
  avgHr: 138, maxHr: 150, splits: '7:05, 6:58, 6:55, 7:01, 6:57, 6:56, sisa 0,34 km 2:22', createdAt: 0, updatedAt: 0,
}

describe('kartu share', () => {
  it('split: hanya km penuh', () => {
    expect(parseSplits(run.splits)).toEqual([425, 418, 415, 421, 417, 416])
    expect(parseSplits(undefined)).toEqual([])
    expect(parseSplits('cepat di awal')).toEqual([])
  })

  it('isi kartu: jarak, statistik, badge easy, perjalanan menuju race', () => {
    const d = cardData(run, IBNU_PROFILE)
    expect(d).toMatchObject({ eyebrow: 'LARI TREADMILL', date: 'Kamis, 8 Okt 2026 · 18:10', km: '6,34' })
    expect(d.stats).toEqual([{ label: 'Waktu', value: '44:17' }, { label: 'Pace', value: '6:59/km' }, { label: 'HR rata-rata', value: '138' }])
    expect(d.badge).toMatch(/zona easy/)
    expect(d.journey).toMatch(new RegExp(`^Minggu \\d+ dari \\d+ · ${IBNU_PROFILE.raceName} · \\d+ hari lagi$`))
    expect(d.progress).toBeGreaterThan(0)
    expect(d.progress).toBeLessThan(1)
  })

  it('HR di atas batas easy tidak dapat badge; jalan kaki tanpa HR menampilkan cadence', () => {
    expect(cardData({ ...run, avgHr: IBNU_PROFILE.easyCap + 5 }, IBNU_PROFILE).badge).toBeUndefined()
    const w = cardData({ ...run, type: 'walk', distanceKm: 2, avgHr: undefined, cadence: 110, splits: undefined }, IBNU_PROFILE)
    expect(w.eyebrow).toBe('JALAN KAKI')
    expect(w.km).toBe('2')
    expect(w.stats[2]).toEqual({ label: 'Cadence', value: '110' })
    expect(w.badge).toBeUndefined()
  })

  it('di luar rencana: tanpa baris perjalanan', () => {
    const d = cardData({ ...run, date: '2027-03-01' }, IBNU_PROFILE)
    expect(d.journey).toBeUndefined()
    expect(d.progress).toBeUndefined()
  })

  it('nama file', () => {
    expect(shareFileName(run)).toBe('rusukaina-2026-10-08-6_34km.png')
  })
})
