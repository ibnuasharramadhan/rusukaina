import { describe, expect, it } from 'vitest'
import { extraExercises, GYM, moveFor } from '../data/gym'
import { LEN, matchMove, MOVES, sideBody, type MoveId, type SidePose } from '../data/moves'
import { gymProgram, planFor, setActivePlan } from '../data/plan'
import { IBNU_GYM, IBNU_PROFILE } from '../data/presets/ibnu'
import type { GymLog } from '../lib/types'

const reach = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('animasi gerakan', () => {
  it('setiap pose bisa dicapai tanpa lengan/kaki yang molor', () => {
    for (const [id, m] of Object.entries(MOVES)) {
      if (m.view !== 'side') continue
      for (const p of [m.a, m.b] as SidePose[]) {
        const b = sideBody(p)
        for (const h of [p.hand, p.hand2 ?? p.hand]) expect(reach(b.shoulder, h), `${id} tangan`).toBeLessThanOrEqual(LEN.upper + LEN.fore + 1.5)
        for (const f of [p.foot, p.foot2 ?? p.foot]) expect(reach(p.hip, f), `${id} kaki`).toBeLessThanOrEqual(LEN.thigh + LEN.shin + 1.5)
      }
    }
  })
  it('semua gerakan di program umum dan program Ibnu punya animasi', () => {
    for (const e of [...GYM.A, ...GYM.B, ...IBNU_GYM.A, ...IBNU_GYM.B]) expect(moveFor(e), e.name).toBeDefined()
  })
  it('nama yang diketik sendiri tetap dikenali', () => {
    const cases: [string, MoveId][] = [
      ['Pectoral fly', 'pecFly'], ['Chest press', 'chestPress'], ['Shoulder press', 'shoulderPress'],
      ['Lateral raise (dumbel)', 'lateralRaise'], ['Triceps kickback (dumbel)', 'kickback'], ['Cable triceps pushdown', 'pushdown'],
      ['Lying leg curl', 'legCurl'], ['Leg extension', 'legExtension'], ['Wall sit + jinjit', 'wallSit'], ['Seated dumbbell shoulder press', 'shoulderPress'],
      ['Split squat / reverse lunge', 'splitSquat'], ['Goblet squat', 'gobletSquat'], ['Push-up', 'pushup'],
    ]
    for (const [name, id] of cases) expect(matchMove(name), name).toBe(id)
    expect(matchMove('Jalan tumit (heel walk)')).toBeUndefined()
  })
})

describe('program gym per rencana', () => {
  it('Ibnu memakai program sendiri, Gym B tubuh atas + punggung', () => {
    setActivePlan(planFor(IBNU_PROFILE))
    expect(gymProgram('B').map((e) => e.name)).toEqual(['Lat pulldown', 'Seated row', 'Shoulder press', 'Pectoral fly', 'Lateral raise', 'Triceps kickback', 'Cable pushdown'])
    expect(gymProgram('A')[0].name).toBe('Leg press')
  })
  it('latihan tambahan dihitung terhadap program yang aktif', () => {
    const g: GymLog = { id: 'g', date: '2026-11-05', workout: 'B', createdAt: 0, updatedAt: 0, exercises: [
      { exercise: 'Shoulder press', weightKg: 30, setsDone: 3 }, { exercise: 'Push-up', setsDone: 3 },
    ] }
    expect(extraExercises(g, 'B', IBNU_GYM.B).map((e) => e.exercise)).toEqual(['Push-up'])
    expect(extraExercises(g, 'B').map((e) => e.exercise)).toEqual(['Shoulder press'])
  })
})
