// "Minggu ini": tiga cincin konsentris (sesi, lari, gym) ala cincin aktivitas,
// plus strip 7 hari Senin–Minggu. Cincin menggambar diri saat muncul.

import { plan as activePlan } from '../data/plan'
import { addDays, dayName, mondayOf, type ISODate } from '../lib/date'
import { statusOf } from '../lib/stats'
import type { GymLog, RunLog, SessionMark } from '../lib/types'
import { KIND, CountUp } from './ui'

const RUN = new Set(['easy', 'long', 'race'])
const GYM = new Set(['gymA', 'gymB'])

export function WeekRings({ t, runs, walks, gym, marks }: { t: ISODate; runs: RunLog[]; walks: RunLog[]; gym: GymLog[]; marks: SessionMark[] }) {
  const mon = mondayOf(t)
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const markMap = new Map(marks.map((m) => [m.date, m]))
  const plan = activePlan().schedule.filter((s) => s.date >= days[0] && s.date <= days[6])
  if (!plan.length) return null
  const training = plan.filter((s) => s.kind !== 'rest')
  const done = training.filter((s) => statusOf(s, markMap, runs, gym, walks) === 'done').length
  const runsDone = new Set(runs.filter((r) => r.date >= days[0] && r.date <= days[6]).map((r) => r.date)).size
  const gymDone = gym.filter((g) => g.date >= days[0] && g.date <= days[6]).length
  const rings = [
    { key: 'sesi', label: 'Sesi', value: done, goal: training.length, cls: 'r-sesi' },
    { key: 'lari', label: 'Lari', value: runsDone, goal: plan.filter((s) => RUN.has(s.kind)).length, cls: 'r-lari' },
    { key: 'gym', label: 'Gym', value: gymDone, goal: plan.filter((s) => GYM.has(s.kind)).length, cls: 'r-gym' },
  ].filter((r) => r.goal > 0 || r.value > 0)

  return (
    <section className="card week-rings" aria-label="Minggu ini">
      <div className="wr-top">
        <svg className="rings" viewBox="0 0 120 120" aria-hidden>
          {rings.map((r, i) => {
            const R = 52 - i * 15
            const p = r.goal ? Math.min(1, r.value / r.goal) : 0
            return (
              <g key={r.key} className={r.cls}>
                <circle cx="60" cy="60" r={R} className="track" />
                {p > 0 && <circle cx="60" cy="60" r={R} className="fill" pathLength={1} strokeDasharray={`${p} 1`} style={{ animationDelay: `${150 + i * 140}ms` }} />}
                {p >= 1 && <circle cx="60" cy="60" r={R} className="glow" style={{ animationDelay: `${900 + i * 140}ms` }} />}
              </g>
            )
          })}
        </svg>
        <div className="wr-legend">
          <p className="eyebrow">Minggu ini</p>
          {rings.map((r) => (
            <div key={r.key} className={`wr-row ${r.cls}`}>
              <i />
              <span className="wr-l">{r.label}</span>
              <span className="num wr-v"><CountUp value={r.value} /><small>/{r.goal}</small></span>
            </div>
          ))}
        </div>
      </div>
      <ol className="strip">
        {days.map((d, i) => {
          const s = plan.find((x) => x.date === d)
          const st = s ? statusOf(s, markMap, runs, gym, walks) : null
          const tone = s ? KIND[s.kind].tone : 'rest'
          const past = d < t
          return (
            <li key={d} className={`t-${tone} ${st ?? ''} ${d === t ? 'today' : ''} ${past && !st && s?.kind !== 'rest' ? 'missed' : ''}`}
              style={{ animationDelay: `${300 + i * 45}ms` }} title={s?.title}>
              <span className="dn">{dayName(d, true)}</span>
              <span className="dot" />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
