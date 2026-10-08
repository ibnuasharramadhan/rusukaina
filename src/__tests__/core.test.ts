import { describe, expect, it } from 'vitest'
import { PLAN_END, SCHEDULE, sessionOn, WEEKS } from '../data/plan'
import { addDays, dayName, mondayOf } from '../lib/date'
import { formatPace, metersPerBeat, paceSecPerKm, parseDuration } from '../lib/pace'
import { bpLevel, readiness, restingHrVerdict, runFlags } from '../lib/safety'
import { adherence, backupDue, coachSummary, raceResult, runRuleWarnings, statusOf, weekStats } from '../lib/stats'
import { karvonenZones, mafHr, ageOn } from '../lib/zones'
import type { RunLog } from '../lib/types'

describe('pace', () => {
  it('parse durasi', () => {
    expect(parseDuration('36:02')).toBe(2162)
    expect(parseDuration('1:05:30')).toBe(3930)
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('5:75')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
  })
  it('lari 1 Okt = pace 7:00', () => {
    expect(formatPace(paceSecPerKm(5.15, 2162))).toBe('7:00')
  })
  it('pembulatan 59,6 detik tidak jadi ":60"', () => {
    expect(formatPace(479.6)).toBe('8:00')
  })
  it('meter per detak', () => {
    expect(metersPerBeat(5.15, 2162, 148)).toBeCloseTo(0.966, 2)
  })
})

describe('aturan tensi (rencana bagian 6)', () => {
  it.each([
    [138, 85, 'green'],
    [148, 83, 'yellow'],
    [130, 92, 'yellow'],
    [160, 80, 'red'],
    [150, 100, 'red'],
    [182, 95, 'critical'],
    [150, 111, 'critical'],
  ])('%i/%i -> %s', (s, d, lv) => expect(bpLevel(s, d)).toBe(lv))

  it('kuning: boleh latihan tapi tanpa strides & tanpa naik beban', () => {
    const r = readiness({ sys: 148, dia: 83, restingHr: 58, baseline: 58 })
    expect(r.canTrain).toBe(true)
    expect(r.noStrides).toBe(true)
    expect(r.noLoadIncrease).toBe(true)
  })
  it('merah: tidak latihan', () => {
    expect(readiness({ sys: 165, dia: 90, baseline: 58 }).canTrain).toBe(false)
  })
})

describe('HR istirahat & tidur', () => {
  it('≥65 (baseline 58 + 7) = ganti jalan santai', () => {
    expect(restingHrVerdict(64, 58).level).toBe('green')
    expect(restingHrVerdict(65, 58).level).toBe('red')
    expect(readiness({ sys: 125, dia: 80, restingHr: 66, baseline: 58 }).canTrain).toBe(false)
  })
  it('tidur 5–6 jam = latihan lebih ringan, <5 jam = skip', () => {
    const short = readiness({ sys: 125, dia: 80, restingHr: 58, sleepHours: 5.5, baseline: 58 })
    expect(short).toMatchObject({ level: 'yellow', canTrain: true, headline: 'Kurang tidur: latihan lebih ringan' })
    expect(readiness({ sys: 125, dia: 80, restingHr: 58, sleepHours: 4.5, baseline: 58 }).canTrain).toBe(false)
    expect(readiness({ sys: 125, dia: 80, restingHr: 58, sleepHours: 7, baseline: 58 }).canTrain).toBe(true)
  })
  it('flag lari easy terlalu cepat', () => {
    expect(runFlags({ avgHr: 148, maxHr: 159, type: 'treadmill' }, 145)).toHaveLength(1)
    expect(runFlags({ avgHr: 140, maxHr: 150, type: 'outdoor' }, 145)).toHaveLength(0)
    expect(runFlags({ avgHr: 160, type: 'race' }, 145)).toHaveLength(0)
  })
})

describe('zona HR sama dengan tabel di rencana', () => {
  it('Karvonen rest 58, max 188', () => {
    const z = karvonenZones(58, 188)
    expect(z.map((x) => [x.low, x.high])).toEqual([[123, 136], [136, 149], [149, 162], [162, 175], [175, null]])
  })
  it('MAF = 142 di umur 28', () => {
    expect(mafHr(28, true)).toBe(142)
    expect(ageOn('1998-12-25', '2026-12-24')).toBe(27)
    expect(ageOn('1998-12-25', '2026-12-25')).toBe(28)
  })
})

describe('jadwal', () => {
  it('10 minggu, 1 Okt sampai 5 Des tanpa celah', () => {
    expect(WEEKS).toHaveLength(10)
    expect(SCHEDULE[0].date).toBe('2026-10-01')
    expect(SCHEDULE[SCHEDULE.length - 1].date).toBe(PLAN_END)
    for (let i = 1; i < SCHEDULE.length; i++) expect(SCHEDULE[i].date).toBe(addDays(SCHEDULE[i - 1].date, 1))
    for (const w of WEEKS.slice(1)) expect(dayName(w.start)).toBe('Senin')
  })
  it('race hari Sabtu 5 Des', () => {
    expect(sessionOn('2026-12-05')?.kind).toBe('race')
    expect(dayName('2026-12-05')).toBe('Sabtu')
  })
  it('pola mingguan: Sen Gym A, Rab lari, Kam Gym B, Sab long run', () => {
    expect(sessionOn('2026-10-19')?.kind).toBe('gymA')
    expect(sessionOn('2026-10-14')?.kind).toBe('easy')
    expect(sessionOn('2026-10-15')?.kind).toBe('gymB')
    expect(sessionOn('2026-10-17')?.title).toContain("45'")
    expect(sessionOn('2026-11-28')?.title).toContain("65'")
  })
  it('strides hanya minggu 7, 8, dan 10', () => {
    const withStrides = new Set(SCHEDULE.filter((s) => s.strides).map((s) => WEEKS.find((w) => s.date >= w.start && s.date <= w.end)!.no))
    expect([...withStrides].sort((a, b) => a - b)).toEqual([7, 8, 10])
  })
  it('mondayOf', () => {
    expect(mondayOf('2026-10-04')).toBe('2026-09-28')
    expect(mondayOf('2026-10-05')).toBe('2026-10-05')
  })
})

const run = (p: Partial<RunLog>): RunLog => ({
  id: p.date!, type: 'treadmill', distanceKm: 5, durationSec: 2400, createdAt: 0, updatedAt: 0, ...p,
} as RunLog)

describe('statistik', () => {
  it('lari tercatat = sesi selesai', () => {
    const runs = [run({ date: '2026-10-03' })]
    expect(statusOf(sessionOn('2026-10-03')!, new Map(), runs, [])).toBe('done')
    expect(statusOf(sessionOn('2026-10-05')!, new Map(), runs, [])).toBeNull()
    const ws = weekStats(runs, [], [])
    expect(ws[0].km).toBe(5)
    expect(ws[0].done).toBe(1)
  })
  it('tanda manual menang', () => {
    const marks = new Map([['2026-10-03', { date: '2026-10-03', status: 'skipped' as const, updatedAt: 0 }]])
    expect(statusOf(sessionOn('2026-10-03')!, marks, [run({ date: '2026-10-03' })], [])).toBe('skipped')
  })
  it('ringkasan coach', () => {
    const txt = coachSummary({
      runs: [run({ date: '2026-10-01', distanceKm: 5.15, durationSec: 2162, avgHr: 148, maxHr: 159 })],
      daily: [{ date: '2026-09-29', sys: 148, dia: 83, restingHr: 58, updatedAt: 0 }],
      gym: [], until: '2026-10-02',
    })
    expect(txt).toContain('5,15 km')
    expect(txt).toContain('pace 7:00')
    expect(txt).toContain('148/83 (!)')
    expect(txt).toContain('Rata-rata tensi: 148/83')
  })
})

describe('konsistensi', () => {
  it('lari di hari Gym B tetap dihitung, hari mendatang tidak', () => {
    const runs = [run({ date: '2026-10-01' })]
    expect(adherence(runs, [], [], '2026-10-02')).toEqual({ planned: 1, done: 1 })
  })
})

describe('pengingat cadangan', () => {
  const day = 86_400_000
  it('muncul kalau belum pernah ekspor atau sudah lewat 7 hari', () => {
    expect(backupDue(undefined, Date.now())).toBe(true)
    expect(backupDue(0, 8 * day)).toBe(true)
    expect(backupDue(0, 7 * day)).toBe(false)
  })
})

describe('hasil race', () => {
  it('hanya lari tipe race di tanggal race', () => {
    const runs = [run({ date: '2026-12-05', type: 'outdoor' }), run({ id: 'r', date: '2026-12-05', type: 'race', distanceKm: 7 })]
    expect(raceResult(runs, '2026-12-05')?.id).toBe('r')
    expect(raceResult(runs.slice(0, 1), '2026-12-05')).toBeUndefined()
  })
})

describe('tanpa tensimeter', () => {
  it('kesiapan dari HR istirahat & tidur saja, batasan kuning tetap berlaku', () => {
    const r = readiness({ restingHr: 58, sleepHours: 7, baseline: 58, trackBp: false })
    expect(r.level).toBe('green')
    expect(r.canTrain).toBe(true)
    expect(r.noStrides).toBe(true)
    expect(r.noLoadIncrease).toBe(true)
  })
  it('tensi lama diabaikan, HR tinggi tetap memblok', () => {
    expect(readiness({ sys: 170, dia: 100, restingHr: 58, baseline: 58, trackBp: false }).canTrain).toBe(true)
    expect(readiness({ restingHr: 66, baseline: 58, trackBp: false }).canTrain).toBe(false)
    expect(readiness({ restingHr: 58, sleepHours: 4.5, baseline: 58, trackBp: false }).canTrain).toBe(false)
  })
})

describe('revisi jadwal 8 Okt dan aturan lari', () => {
  const run = (date: string): RunLog => ({ id: date, date, type: 'treadmill', distanceKm: 5, durationSec: 2100, createdAt: 0, updatedAt: 0 })

  it('Jumat–Sabtu libur, Minggu easy, Senin Gym B', () => {
    expect(sessionOn('2026-10-09')?.kind).toBe('rest')
    expect(sessionOn('2026-10-10')?.kind).toBe('rest')
    expect(sessionOn('2026-10-11')).toMatchObject({ kind: 'easy', extraRunOk: true })
    expect(sessionOn('2026-10-12')?.kind).toBe('gymB')
    expect(sessionOn('2026-10-17')?.kind).toBe('long')
  })

  it('peringatan lari berturut-turut, lebih dari 3, dan di hari gym/libur', () => {
    const runs = ['2026-10-19', '2026-10-21', '2026-10-24'].map(run) // minggu 4
    expect(runRuleWarnings('2026-10-22', runs).join(' ')).toMatch(/berturut-turut/)
    expect(runRuleWarnings('2026-10-22', runs).join(' ')).toMatch(/Maks 3/)
    expect(runRuleWarnings('2026-10-22', runs).join(' ')).toMatch(/bukan lari/)
    expect(runRuleWarnings('2026-10-24', runs)).toEqual([])
  })

  it('Minggu 11 Okt boleh jadi lari ke-4', () => {
    const runs = ['2026-10-05', '2026-10-07', '2026-10-08'].map(run)
    expect(runRuleWarnings('2026-10-11', runs)).toEqual([])
  })
})

describe('tanpa tensimeter + aturan tidur 3 tingkat', () => {
  it('tidur 5–6 jam tetap boleh latihan ringan', () => {
    expect(readiness({ restingHr: 58, sleepHours: 5.5, baseline: 58, trackBp: false })).toMatchObject({ level: 'yellow', canTrain: true })
  })
})
