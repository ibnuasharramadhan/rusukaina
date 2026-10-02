import { useState } from 'react'
import { DailyForm } from '../components/DailyForm'
import { Card, KIND_ICON, LevelBadge, Stat } from '../components/ui'
import { PLAN_END, PLAN_START, SCHEDULE, sessionOn, weekOf } from '../data/plan'
import { downloadBackup } from '../lib/backup'
import { addDays, diffDays, formatDate, toISO, today } from '../lib/date'
import { setMark } from '../lib/db'
import { formatDuration, formatPace, paceSecPerKm } from '../lib/pace'
import { href } from '../lib/router'
import { readiness, runFlags, STOP_SIGNS } from '../lib/safety'
import { backupDue, raceResult, statusOf } from '../lib/stats'
import { useData } from '../lib/store'
import type { PlannedSession, RunLog } from '../lib/types'

export function Today() {
  const { profile, daily, runs, gym, marks, lastExportAt, refresh } = useData()
  const t = today()
  const d = daily.find((x) => x.date === t)
  const [editing, setEditing] = useState(false)
  const r = readiness({ sys: d?.sys, dia: d?.dia, restingHr: d?.restingHr, sleepHours: d?.sleepHours, baseline: profile.restingHrBaseline })
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

  async function mark(st: 'done' | 'skipped' | null) {
    await setMark(st ? { date: t, status: st, updatedAt: 0 } : { date: t, status: null })
    await refresh()
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="muted">{formatDate(t, true)}{week ? ` · Minggu ${week.no} dari 10` : ''}</p>
          <h1>Halo, {profile.name}</h1>
        </div>
        {daysToRace >= 0 && (
          <div className="countdown" aria-label={`${daysToRace} hari menuju ${profile.raceName}`}>
            <span className="big">{daysToRace}</span>
            <span>hari ke {profile.raceName}</span>
          </div>
        )}
      </header>

      <Card
        title="Cek kesiapan"
        action={d && !editing ? <button className="link" onClick={() => setEditing(true)}>Ubah</button> : undefined}
        className={`ready lv-${r.level}`}
      >
        {!d || editing ? (
          <DailyForm date={t} compact onSaved={() => setEditing(false)} />
        ) : (
          <>
            <div className="ready-h"><LevelBadge level={r.level} /> <strong>{r.headline}</strong></div>
            <ul className="advice">
              {r.verdicts.flatMap((v) => v.advice).map((a) => <li key={a}>{a}</li>)}
            </ul>
          </>
        )}
      </Card>

      {session ? (
        <TodaySession session={session} canTrain={r.level === 'unknown' || r.canTrain} noStrides={r.noStrides} status={status} onMark={mark} />
      ) : (
        <Card title="Hari ini">
          <p>{t < PLAN_START ? `Program mulai ${formatDate(PLAN_START)}.` : t > PLAN_END ? 'Program menuju UI Ultra sudah selesai. Saatnya rencana berikutnya bersama coach.' : 'Tidak ada sesi.'}</p>
        </Card>
      )}

      {showRace && <RaceResultCard name={profile.raceName} date={profile.raceDate} result={result} />}

      {week?.note && <Card title={`Catatan minggu ${week.no}`}><p>{week.note}</p></Card>}

      {lastRun && (
        <Card title="Lari terakhir" action={<a className="link" href={href('progres')}>Progres</a>}>
          <div className="stats">
            <Stat label={formatDate(lastRun.date, true)} value={`${String(lastRun.distanceKm).replace('.', ',')} km`} sub={formatDuration(lastRun.durationSec)} />
            <Stat label="Pace" value={formatPace(paceSecPerKm(lastRun.distanceKm, lastRun.durationSec))} sub="/km" />
            <Stat label="HR rata/maks" value={lastRun.avgHr ?? '–'} sub={lastRun.maxHr ? `maks ${lastRun.maxHr}` : undefined} />
          </div>
          {runFlags(lastRun, profile.easyCap).map((f) => <p key={f} className="flag">⚠︎ {f}</p>)}
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card title="Berikutnya" action={<a className="link" href={href('jadwal')}>Jadwal</a>}>
          <ul className="list">
            {upcoming.map((s) => (
              <li key={s.date}><span className="ico" aria-hidden>{KIND_ICON[s.kind]}</span><span className="grow">{s.title}</span><span className="muted">{s.date === addDays(t, 1) ? 'Besok' : formatDate(s.date, true)}</span></li>
            ))}
          </ul>
        </Card>
      )}

      {hasData && backupDue(lastExportAt, Date.now()) && (
        <Card title="Cadangan data" className="backup">
          <p className="small">
            {lastExportAt ? `Cadangan terakhir ${diffDays(toISO(new Date(lastExportAt)), t)} hari lalu.` : 'Belum pernah dicadangkan.'}{' '}
            Data hanya tersimpan di HP ini; unduh cadangan supaya aman kalau HP hilang atau rusak.
          </p>
          <div className="row">
            <button className="btn primary" onClick={async () => { await downloadBackup(); await refresh() }}>Unduh cadangan</button>
          </div>
        </Card>
      )}

      <details className="card stop">
        <summary>Berhenti & cari pertolongan kalau muncul…</summary>
        <ul>{STOP_SIGNS.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
    </div>
  )
}

function TodaySession({ session, canTrain, noStrides, status, onMark }: {
  session: PlannedSession; canTrain: boolean; noStrides: boolean; status: string | null; onMark: (s: 'done' | 'skipped' | null) => void
}) {
  const isGym = session.kind === 'gymA' || session.kind === 'gymB'
  const isRun = session.kind === 'easy' || session.kind === 'long' || session.kind === 'race'
  return (
    <Card title="Sesi hari ini" className="session">
      <div className="session-h">
        <span className="ico big" aria-hidden>{KIND_ICON[session.kind]}</span>
        <div>
          <h3 className={!canTrain && session.kind !== 'rest' ? 'struck' : ''}>{session.title}</h3>
          {session.detail && <p className="muted">{session.detail}</p>}
        </div>
      </div>
      {!canTrain && session.kind !== 'rest' && <p className="swap">Hari ini diganti: <b>jalan santai saja</b>.</p>}
      {canTrain && noStrides && session.strides && <p className="swap">Tensi belum di bawah 140/90: lewati strides, lari easy saja.</p>}
      {isRun && canTrain && <p className="hint">Easy = masih bisa ngobrol kalimat penuh. HR ≤145; kalau lewat, jalan sampai ~130.</p>}
      {status ? (
        <div className="row">
          <span className={`pill ${status}`}>{status === 'done' ? '✓ Selesai' : status === 'skipped' ? 'Dilewati' : 'Diganti'}</span>
          <button className="link" onClick={() => onMark(null)}>Batalkan</button>
        </div>
      ) : (
        session.kind !== 'rest' && (
          <div className="row wrap">
            {isRun && <a className="btn primary" href={href('catat', { tab: 'lari', date: session.date })}>Catat lari</a>}
            {isGym && <a className="btn primary" href={href('catat', { tab: 'gym', date: session.date, w: session.kind === 'gymA' ? 'A' : 'B' })}>Mulai Gym {session.kind === 'gymA' ? 'A' : 'B'}</a>}
            <button className="btn" onClick={() => onMark('done')}>Tandai selesai</button>
            <button className="btn ghost" onClick={() => onMark('skipped')}>Lewati</button>
          </div>
        )
      )}
    </Card>
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
    <Card title={`🏁 Hasil ${name}`} action={<a className="link" href={href('catat', { tab: 'lari', id: result.id })}>Ubah</a>}>
      <div className="stats">
        <Stat label="Waktu" value={formatDuration(result.durationSec)} sub={`${String(result.distanceKm).replace('.', ',')} km`} />
        <Stat label="Pace" value={formatPace(paceSecPerKm(result.distanceKm, result.durationSec))} sub="/km" />
        <Stat label="HR rata/maks" value={result.avgHr ?? '–'} sub={result.maxHr ? `maks ${result.maxHr}` : undefined} />
      </div>
      {result.notes && <p className="small">{result.notes}</p>}
    </Card>
  )
}
