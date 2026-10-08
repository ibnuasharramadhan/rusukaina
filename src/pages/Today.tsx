import { useState } from 'react'
import { DailyForm } from '../components/DailyForm'
import { Icon } from '../components/icons'
import { Card, KIND, KindIcon, LEVEL_LABEL } from '../components/ui'
import { PLAN_END, PLAN_START, SCHEDULE, sessionOn, weekOf } from '../data/plan'
import { downloadBackup } from '../lib/backup'
import { addDays, diffDays, formatDate, toISO, today } from '../lib/date'
import { setMark } from '../lib/db'
import { formatDuration, formatPace, paceSecPerKm } from '../lib/pace'
import { href } from '../lib/router'
import { bpLevel, readiness, restingHrVerdict, runFlags, sleepVerdict, STOP_SIGNS, type Level, type Readiness } from '../lib/safety'
import { backupDue, raceResult, runRuleWarnings, statusOf } from '../lib/stats'
import { useData } from '../lib/store'
import type { DailyLog, PlannedSession, RunLog } from '../lib/types'

const km = (n: number) => String(n).replace('.', ',')

export function Today() {
  const { profile, daily, runs, gym, marks, lastExportAt, refresh } = useData()
  const t = today()
  const d = daily.find((x) => x.date === t)
  const [editing, setEditing] = useState(false)
  const r = readiness({ sys: d?.sys, dia: d?.dia, restingHr: d?.restingHr, sleepHours: d?.sleepHours, baseline: profile.restingHrBaseline, trackBp: profile.trackBp })
  const session = sessionOn(t)
  const week = weekOf(t)
  const daysToRace = diffDays(t, profile.raceDate)
  const markMap = new Map(marks.map((m) => [m.date, m]))
  const status = session ? statusOf(session, markMap, runs, gym) : null
  const lastRun = runs[runs.length - 1]
  const upcoming = SCHEDULE.filter((s) => s.date > t && s.kind !== 'rest').slice(0, 3)
  const daysAfterRace = diffDays(profile.raceDate, t)
  const result = raceResult(runs, profile.raceDate)
  // Hasil race tampil sampai 2 minggu setelahnya; di hari H, kartu sesi sudah punya tombol "Catat lari".
  const showRace = daysAfterRace >= 0 && daysAfterRace <= 14 && (!!result || daysAfterRace > 0)
  const hasData = runs.length + daily.length + gym.length > 0
  const planDays = diffDays(PLAN_START, PLAN_END)
  const planPct = Math.min(1, Math.max(0, diffDays(PLAN_START, t) / planDays))

  async function mark(st: 'done' | 'skipped' | null) {
    await setMark(st ? { date: t, status: st, updatedAt: 0 } : { date: t, status: null })
    await refresh()
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">{formatDate(t, true)}{week ? ` · Minggu ${week.no}/10` : ''}</p>
            <h1>Halo, {profile.name}</h1>
          </div>
          {daysToRace >= 0 && (
            <div className="countdown" aria-label={`${daysToRace} hari menuju ${profile.raceName}`}>
              <span className="num">{daysToRace}</span>
              <span className="countdown-l">hari lagi</span>
            </div>
          )}
        </div>
        {daysToRace >= 0 && (
          <div className="plan-bar" aria-hidden>
            <div className="plan-track"><div className="plan-fill" style={{ width: `${planPct * 100}%` }} /></div>
            <div className="plan-ends"><span>{formatDate(PLAN_START)}</span><span><Icon name="flag" size={12} /> {profile.raceName} · {formatDate(profile.raceDate)}</span></div>
          </div>
        )}
      </header>

      {!d || editing ? (
        <Card title="Cek kesiapan" className="ready lv-unknown">
          <p className="small muted">Isi sebelum latihan. Aplikasi akan menyesuaikan sesi hari ini.</p>
          <DailyForm date={t} compact onSaved={() => setEditing(false)} />
        </Card>
      ) : (
        <ReadinessCard d={d} r={r} baseline={profile.restingHrBaseline} trackBp={profile.trackBp} onEdit={() => setEditing(true)} />
      )}

      {session ? (
        <TodaySession session={session} easyCap={profile.easyCap} canTrain={r.level === 'unknown' || r.canTrain} noStrides={r.noStrides} status={status} onMark={mark} ruleWarnings={runRuleWarnings(t, runs)} />
      ) : (
        <Card title="Hari ini">
          <p>{t < PLAN_START ? `Program mulai ${formatDate(PLAN_START)}.` : t > PLAN_END ? 'Program menuju UI Ultra sudah selesai. Saatnya rencana berikutnya bersama coach.' : 'Tidak ada sesi.'}</p>
        </Card>
      )}

      {showRace && <RaceResultCard name={profile.raceName} date={profile.raceDate} result={result} />}

      {week?.note && (
        <aside className="note">
          <Icon name="bolt" size={18} />
          <p><b>Fokus minggu {week.no}.</b> {week.note}</p>
        </aside>
      )}

      {lastRun && (
        <Card title="Lari terakhir" action={<a className="link" href={href('progres')}>Progres <Icon name="chevron" size={14} /></a>}>
          <p className="small muted run-meta">{formatDate(lastRun.date, true)} · {lastRun.type}</p>
          <div className="big-stats">
            <BigStat value={km(lastRun.distanceKm)} unit="km" />
            <BigStat value={formatPace(paceSecPerKm(lastRun.distanceKm, lastRun.durationSec))} unit="/km" />
            <BigStat value={formatDuration(lastRun.durationSec)} unit="waktu" />
            {lastRun.avgHr && <BigStat value={lastRun.avgHr} unit={lastRun.maxHr ? `bpm · maks ${lastRun.maxHr}` : 'bpm'} tone={lastRun.avgHr > profile.easyCap ? 'warn' : undefined} />}
          </div>
          {runFlags(lastRun, profile.easyCap).map((f) => <p key={f} className="flag"><Icon name="alert" size={16} /> {f}</p>)}
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card title="Berikutnya" action={<a className="link" href={href('jadwal')}>Jadwal <Icon name="chevron" size={14} /></a>}>
          <ol className="timeline">
            {upcoming.map((s) => (
              <li key={s.date}>
                <KindIcon kind={s.kind} />
                <span className="grow">
                  <span className="tl-when">{s.date === addDays(t, 1) ? 'Besok' : formatDate(s.date, true)}</span>
                  <span className="tl-title">{s.title}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {hasData && backupDue(lastExportAt, Date.now()) && (
        <aside className="note backup">
          <Icon name="download" size={18} />
          <div className="grow">
            <p>
              <b>{lastExportAt ? `Cadangan terakhir ${diffDays(toISO(new Date(lastExportAt)), t)} hari lalu.` : 'Data belum pernah dicadangkan.'}</b>{' '}
              Semua catatan hanya ada di HP ini.
            </p>
            <button className="btn small" onClick={async () => { await downloadBackup(); await refresh() }}>Unduh cadangan</button>
          </div>
        </aside>
      )}

      <details className="card stop">
        <summary><Icon name="alert" size={18} /> Berhenti & cari pertolongan kalau muncul…</summary>
        <ul>{STOP_SIGNS.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
    </div>
  )
}

function BigStat({ value, unit, tone }: { value: React.ReactNode; unit: string; tone?: 'warn' }) {
  return (
    <div className={`big-stat ${tone ?? ''}`}>
      <span className="num">{value}</span>
      <span className="unit">{unit}</span>
    </div>
  )
}

/** Cincin 2–3 bagian: (tensi), HR istirahat, tidur. Tiap bagian berwarna sesuai statusnya sendiri. */
function ReadinessRing({ levels, overall }: { levels: Level[]; overall: Level }) {
  const R = 40
  const C = 2 * Math.PI * R
  const gap = 6
  const seg = C / levels.length
  return (
    <div className={`ring lv-${overall}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        {levels.map((lv, i) => (
          <circle key={i} className={`ring-seg lv-${lv}`} cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${seg - gap} ${C - seg + gap}`} strokeDashoffset={-i * seg - gap / 2}
            style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </svg>
      <span className="ring-label">{LEVEL_LABEL[overall]}</span>
    </div>
  )
}

function ReadinessCard({ d, r, baseline, trackBp, onEdit }: { d: DailyLog; r: Readiness; baseline: number; trackBp: boolean; onEdit: () => void }) {
  const bp = bpLevel(d.sys, d.dia)
  const hr = restingHrVerdict(d.restingHr, baseline).level
  const sl = sleepVerdict(d.sleepHours).level
  const metrics: { label: string; icon: 'drop' | 'heart' | 'bed'; value: string; level: Level }[] = [
    ...(trackBp ? [{ label: 'Tensi', icon: 'drop' as const, value: d.sys && d.dia ? `${d.sys}/${d.dia}` : '–', level: bp }] : []),
    { label: 'HR istirahat', icon: 'heart', value: d.restingHr ? String(d.restingHr) : '–', level: hr },
    { label: 'Tidur', icon: 'bed', value: d.sleepHours != null ? `${km(d.sleepHours)} j` : '–', level: sl },
  ]
  return (
    <section className={`card ready lv-${r.level}`} aria-label="Kesiapan latihan">
      <div className="ready-top">
        <ReadinessRing levels={metrics.map((m) => m.level)} overall={r.level} />
        <div className="grow">
          <p className="eyebrow">Kesiapan hari ini</p>
          <h2 className="ready-title">{r.headline}</h2>
          <button className="link small" onClick={onEdit}>Ubah data pagi</button>
        </div>
      </div>
      <div className="metrics">
        {metrics.map((m) => (
          <div key={m.label} className={`metric lv-${m.level}`}>
            <span className="metric-l"><Icon name={m.icon} size={14} /> {m.label}</span>
            <span className="metric-v">{m.value}</span>
          </div>
        ))}
      </div>
      <details className="why">
        <summary>Kenapa?</summary>
        <ul className="advice">{r.verdicts.flatMap((v) => v.advice).map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
    </section>
  )
}

function TodaySession({ session, easyCap, canTrain, noStrides, status, onMark, ruleWarnings }: {
  session: PlannedSession; easyCap: number; canTrain: boolean; noStrides: boolean; status: string | null; onMark: (s: 'done' | 'skipped' | null) => void; ruleWarnings: string[]
}) {
  const isGym = session.kind === 'gymA' || session.kind === 'gymB'
  const isRun = session.kind === 'easy' || session.kind === 'long' || session.kind === 'race'
  const blocked = !canTrain && session.kind !== 'rest'
  return (
    <section className={`card session t-${KIND[session.kind].tone} ${status ? `is-${status}` : ''}`} aria-label="Sesi hari ini">
      <div className="session-top">
        <span className="chip"><Icon name={KIND[session.kind].icon} size={14} /> {KIND[session.kind].label}</span>
        {status && <span className={`pill ${status}`}>{status === 'done' ? <><Icon name="check" size={14} /> Selesai</> : status === 'skipped' ? 'Dilewati' : 'Diganti'}</span>}
      </div>
      <h2 className={`session-title ${blocked ? 'struck' : ''}`}>{session.title}</h2>
      {(session.minutes || session.km) && !blocked && (
        <div className="session-targets">
          {session.minutes && <span><span className="num">{session.minutes}</span> menit</span>}
          {session.km && <span><span className="num">{km(session.km)}</span> km</span>}
          {isRun && <span><Icon name="heart" size={14} /> ≤{easyCap}</span>}
        </div>
      )}
      {session.detail && <p className="muted small">{session.detail}</p>}
      {blocked && <p className="swap">Hari ini diganti: <b>jalan santai saja</b>.</p>}
      {canTrain && noStrides && session.strides && <p className="swap">Tensi belum terpantau di bawah 140/90: lewati strides, lari easy saja.</p>}
      {isRun && !status && ruleWarnings.map((w) => <p key={w} className="swap">{w}</p>)}
      {isRun && canTrain && !status && <p className="hint">Easy = masih bisa ngobrol kalimat penuh. Kalau HR lewat {easyCap}, jalan sampai ~130.</p>}
      {status ? (
        <button className="link small" onClick={() => onMark(null)}>Batalkan tanda</button>
      ) : (
        session.kind !== 'rest' && (
          <div className="row wrap actions">
            {isRun && <a className="btn primary" href={href('catat', { tab: 'lari', date: session.date })}>Catat lari</a>}
            {isGym && <a className="btn primary" href={href('catat', { tab: 'gym', date: session.date, w: session.kind === 'gymA' ? 'A' : 'B' })}>Mulai Gym {session.kind === 'gymA' ? 'A' : 'B'}</a>}
            <button className="btn" onClick={() => onMark('done')}>Tandai selesai</button>
            <button className="btn ghost" onClick={() => onMark('skipped')}>Lewati</button>
          </div>
        )
      )}
    </section>
  )
}

function RaceResultCard({ name, date, result }: { name: string; date: string; result?: RunLog }) {
  if (!result) {
    return (
      <Card title={`Hasil ${name}`}>
        <p>Hasil race belum dicatat.</p>
        <div className="row">
          <a className="btn primary" href={href('catat', { tab: 'lari', date })}>Catat hasil race</a>
        </div>
      </Card>
    )
  }
  return (
    <section className="card race-result">
      <div className="session-top">
        <span className="chip"><Icon name="flag" size={14} /> Finish</span>
        <a className="link small" href={href('catat', { tab: 'lari', id: result.id })}>Ubah</a>
      </div>
      <h2 className="session-title">{name}</h2>
      <div className="big-stats">
        <BigStat value={formatDuration(result.durationSec)} unit={`${km(result.distanceKm)} km`} />
        <BigStat value={formatPace(paceSecPerKm(result.distanceKm, result.durationSec))} unit="/km" />
        {result.avgHr && <BigStat value={result.avgHr} unit={result.maxHr ? `bpm · maks ${result.maxHr}` : 'bpm'} />}
      </div>
      {result.notes && <p className="small">{result.notes}</p>}
    </section>
  )
}
