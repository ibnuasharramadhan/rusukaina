import { describe, expect, it } from 'vitest'
import { dayReadiness } from '../lib/body'
import { formatMedSchedule, hasCheckin, newMedUntil, overdueDoses, parseMedSchedule, symptomVerdict } from '../lib/meds'
import { bpVerdict, readiness } from '../lib/safety'
import { coachSummary } from '../lib/stats'
import type { DailyLog, Profile } from '../lib/types'

const profile: Profile = {
  name: 'Rina', birthDate: '1995-01-01', restingHrBaseline: 58, maxHr: 190, easyCap: 145,
  raceDate: '2026-12-05', raceName: 'Race', trackBp: false, medName: 'Obat A + Obat B', medStart: '2026-10-10',
  medSchedule: [{ time: '06:00', label: 'A + B' }, { time: '18:00', label: 'B' }],
}
const day = (p: Partial<DailyLog>): DailyLog => ({ date: '2026-10-12', updatedAt: 1, ...p })

describe('jadwal obat', () => {
  it('membaca jam dan nama, mengurutkan, membuang yang tidak valid', () => {
    expect(parseMedSchedule('18.00 B, 6:00 A + B; 25:00 x, pagi, 06:00 dobel')).toEqual([
      { time: '06:00', label: 'A + B' }, { time: '18:00', label: 'B' },
    ])
    expect(parseMedSchedule('07:30')).toEqual([{ time: '07:30' }])
    expect(formatMedSchedule(parseMedSchedule('06:00 A, 18:00'))).toBe('06:00 A, 18:00')
  })

  it('dosis lewat jam yang belum diminum', () => {
    expect(overdueDoses(profile.medSchedule!, [], '05:59')).toEqual([])
    expect(overdueDoses(profile.medSchedule!, [], '06:00').map((d) => d.time)).toEqual(['06:00'])
    expect(overdueDoses(profile.medSchedule!, ['06:00'], '19:00').map((d) => d.time)).toEqual(['18:00'])
  })
})

describe('minggu pertama obat baru', () => {
  it('berlaku 8 hari: hari mulai sampai +7', () => {
    expect(newMedUntil(profile, '2026-10-09')).toBeUndefined()
    expect(newMedUntil(profile, '2026-10-10')).toBe('2026-10-17')
    expect(newMedUntil(profile, '2026-10-17')).toBe('2026-10-17')
    expect(newMedUntil(profile, '2026-10-18')).toBeUndefined()
    expect(newMedUntil({ ...profile, medName: undefined }, '2026-10-12')).toBeUndefined()
  })

  it('tanpa strides dan beban tidak naik walau semua hijau', () => {
    const r = dayReadiness({ ...profile, medName: undefined }, [day({ restingHr: 58, sleepHours: 7 })], '2026-10-12')
    expect(r.noStrides).toBe(false)
    const m = readiness({ restingHr: 58, sleepHours: 7, baseline: 58, trackBp: false, hypertension: false, newMedication: true })
    expect(m.level).toBe('green')
    expect(m.noStrides).toBe(true)
    expect(m.noLoadIncrease).toBe(true)
  })
})

describe('keluhan obat', () => {
  it('pusing = merah, batuk kering = kuning', () => {
    expect(symptomVerdict({ dizzy: true, dryCough: true }).level).toBe('red')
    expect(symptomVerdict({ dryCough: true }).level).toBe('yellow')
    expect(symptomVerdict({}).level).toBe('unknown')
  })

  it('ikut menentukan kesiapan hari itu', () => {
    const dizzy = dayReadiness(profile, [day({ restingHr: 58, sleepHours: 7, dizzy: true })], '2026-10-12')
    expect(dizzy.level).toBe('red')
    expect(dizzy.canTrain).toBe(false)
    expect(dizzy.headline).toMatch(/Pusing/)
    const cough = dayReadiness(profile, [day({ restingHr: 58, sleepHours: 7, dryCough: true })], '2026-10-12')
    expect(cough.level).toBe('yellow')
    expect(cough.canTrain).toBe(true)
  })

  it('keluhan diabaikan bila tidak ada obat tensi', () => {
    const r = dayReadiness({ ...profile, medName: undefined }, [day({ restingHr: 58, sleepHours: 7, dizzy: true })], '2026-10-12')
    expect(r.level).toBe('green')
  })

  it('tensi kritis tetap jadi judul walau ada pusing', () => {
    const r = readiness({ sys: 185, dia: 100, restingHr: 58, sleepHours: 7, baseline: 58, symptoms: symptomVerdict({ dizzy: true }) })
    expect(r.level).toBe('critical')
    expect(r.headline).toBe(bpVerdict(185, 100).title)
  })
})

describe('catatan harian', () => {
  it('entri yang hanya berisi tanda obat belum dianggap cek pagi', () => {
    expect(hasCheckin(undefined)).toBe(false)
    expect(hasCheckin(day({ medDoses: ['06:00'] }))).toBe(false)
    expect(hasCheckin(day({ medDoses: ['06:00'], restingHr: 60 }))).toBe(true)
    expect(hasCheckin(day({}))).toBe(true)
  })

  it('ringkasan coach menyebut dosis terlewat dan keluhan', () => {
    const txt = coachSummary({
      runs: [], gym: [], until: '2026-10-12', medTimes: ['06:00', '18:00'],
      daily: [day({ date: '2026-10-11', medDoses: ['06:00'], dryCough: true }), day({ medDoses: ['06:00'], dizzy: true })],
    })
    expect(txt).toContain('obat terlewat 18:00, batuk kering')
    expect(txt).toContain('obat 1/2, pusing')
  })
})
