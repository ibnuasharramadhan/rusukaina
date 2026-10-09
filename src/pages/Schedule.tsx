import { useState } from 'react'
import { Icon } from '../components/icons'
import { KindIcon, PageHeader } from '../components/ui'
import { celebrate } from '../lib/motion'
import { plan, RUN_RULES } from '../data/plan'
import { formatDate, today } from '../lib/date'
import { setMark } from '../lib/db'
import { href } from '../lib/router'
import { statusOf, weekStats } from '../lib/stats'
import { useData } from '../lib/store'
import type { SessionStatus } from '../lib/types'

const STATUS_LABEL: Record<SessionStatus, string> = { done: '', skipped: '–', swapped: '↺' }

export function Schedule() {
  const { runs, walks, gym, marks, refresh } = useData()
  const t = today()
  const { weeks, schedule, priorityNote } = plan()
  const current = weeks.find((w) => t >= w.start && t <= w.end)?.no ?? (t < weeks[0].start ? 1 : weeks.length)
  const [open, setOpen] = useState<number>(current)
  const [menu, setMenu] = useState<string | null>(null)
  const markMap = new Map(marks.map((m) => [m.date, m]))
  const stats = weekStats(runs, gym, marks, walks)

  async function mark(date: string, status: SessionStatus | null) {
    if (status === 'done') celebrate()
    await setMark(status ? { date, status, updatedAt: 0 } : { date, status: null })
    setMenu(null)
    await refresh()
  }

  return (
    <div className="page">
      <PageHeader eyebrow={`Minggu ${current} dari ${weeks.length}`} title="Jadwal">
        <p className="lede">{priorityNote}</p>
        <p className="lede">{RUN_RULES}</p>
      </PageHeader>
      {weeks.map((w) => {
        const st = stats.find((s) => s.no === w.no)!
        const isOpen = open === w.no
        const days = schedule.filter((s) => s.date >= w.start && s.date <= w.end)
        return (
          <section key={w.no} className={`card week ${w.no === current ? 'current' : ''}`}>
            <button className="week-h" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? 0 : w.no)}>
              <span className="week-no num">{w.no}</span>
              <div className="grow">
                <div>
                  <b>{formatDate(w.start)} – {formatDate(w.end)}</b>
                  {w.deload && <span className="tag">Deload</span>}
                  {w.no === current && <span className="tag accent">Sekarang</span>}
                </div>
                <div className="muted small">Long run: {w.longRun}</div>
                <div className="week-bar" aria-hidden><span style={{ width: `${st.planned ? (st.done / st.planned) * 100 : 0}%` }} /></div>
              </div>
              <span className="week-prog" aria-label={`${st.done} dari ${st.planned} sesi`}><span className="num">{st.done}</span>/{st.planned}</span>
              <Icon name="chevron" size={16} className={`week-chev ${isOpen ? 'open' : ''}`} />
            </button>
            {isOpen && (
              <>
                {w.note && <p className="week-note">{w.note}</p>}
                <ul className="days">
                  {days.map((s) => {
                    const status = statusOf(s, markMap, runs, gym, walks)
                    const missed = !status && s.date < t && s.kind !== 'rest'
                    return (
                      <li key={s.date} className={`${s.date === t ? 'is-today' : ''} ${status ?? ''} ${missed ? 'missed' : ''} k-${s.kind}`}>
                        <span className="d">{formatDate(s.date, true)}</span>
                        <KindIcon kind={s.kind} size={16} />
                        <span className="grow">
                          {s.title}
                          {s.detail && <span className="muted small block">{s.detail}</span>}
                        </span>
                        {s.kind !== 'rest' && (
                          <button className={`st ${status ?? ''}`} aria-label="Ubah status" onClick={() => setMenu(menu === s.date ? null : s.date)}>
                            {status === 'done' ? <Icon name="check" size={16} /> : status ? STATUS_LABEL[status] : missed ? '·' : ''}
                          </button>
                        )}
                        {menu === s.date && (
                          <div className="menu" role="menu">
                            <button onClick={() => mark(s.date, 'done')}>Selesai</button>
                            <button onClick={() => mark(s.date, 'swapped')}>Diganti jalan/sesi lain</button>
                            <button onClick={() => mark(s.date, 'skipped')}>Dilewati</button>
                            {(s.kind === 'easy' || s.kind === 'long' || s.kind === 'race') && <a href={href('catat', { tab: 'lari', date: s.date })}>Catat lari…</a>}
                            {(s.kind === 'gymA' || s.kind === 'gymB') && <a href={href('catat', { tab: 'gym', date: s.date, w: s.kind === 'gymA' ? 'A' : 'B' })}>Catat gym…</a>}
                            {s.kind === 'walk' && <a href={href('catat', { tab: 'lari', date: s.date, type: 'walk' })}>Catat jalan…</a>}
                            {markMap.has(s.date) && <button onClick={() => mark(s.date, null)}>Hapus tanda</button>}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
