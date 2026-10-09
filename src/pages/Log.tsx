import { useEffect, useMemo, useRef, useState } from 'react'
import { DailyForm } from '../components/DailyForm'
import { ShareSheet } from '../components/ShareSheet'
import { Icon } from '../components/icons'
import { Card, Field, LevelBadge, num, PageHeader, Segmented } from '../components/ui'
import { GYM, GYM_RULES } from '../data/gym'
import { sessionOn } from '../data/plan'
import { importActivityFiles } from '../lib/activityFile'
import { defaultShoeId, painVerdict } from '../lib/body'
import { formatDate, today } from '../lib/date'
import { deleteDaily, deleteGym, deleteRun, saveGym, saveRun, uid } from '../lib/db'
import { formatDuration, formatPace, paceSecPerKm, parseDuration } from '../lib/pace'
import { href } from '../lib/router'
import { NO_BP_NOTE, readiness, runFlags } from '../lib/safety'
import { runRuleWarnings } from '../lib/stats'
import { celebrate } from '../lib/motion'
import { useData } from '../lib/store'
import type { GymLog, GymSet, RunLog, RunType } from '../lib/types'
import { karvonenZones, zoneFor } from '../lib/zones'

type Tab = 'lari' | 'gym' | 'harian'

const TYPE_LABEL: Record<RunType, string> = { treadmill: 'treadmill', outdoor: 'luar', race: 'race', walk: 'jalan kaki' }

export function Log({ params }: { params: URLSearchParams }) {
  const { profile } = useData()
  const tab = (params.get('tab') as Tab) || 'lari'
  const setTab = (t: Tab) => { location.hash = href('catat', { tab: t }) }
  return (
    <div className="page">
      <PageHeader eyebrow={profile.trackBp ? 'Lari, gym, tensi' : 'Lari, gym, HR'} title="Catat" />
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'lari', label: 'Lari/jalan' }, { value: 'gym', label: 'Gym' }, { value: 'harian', label: profile.trackBp ? 'Tensi & HR' : 'HR & tidur' },
      ]} />
      {tab === 'lari' && <RunSection key={params.toString()} params={params} />}
      {tab === 'gym' && <GymSection key={params.toString()} params={params} />}
      {tab === 'harian' && <DailySection key={params.toString()} params={params} />}
    </div>
  )
}

// ---------- Lari

function RunSection({ params }: { params: URLSearchParams }) {
  const { runs, walks, shoes, profile, refresh, strava, stravaBusy, syncStrava } = useData()
  const all = [...runs, ...walks].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  const editing = all.find((r) => r.id === params.get('id'))
  const initialDate = editing?.date ?? params.get('date') ?? today()
  const planned = sessionOn(initialDate)
  const [f, setF] = useState(() => ({
    date: initialDate,
    time: editing?.time ?? '',
    type: editing?.type ?? (params.get('type') === 'walk' || planned?.kind === 'walk' ? 'walk' : planned?.kind === 'race' ? 'race' : 'treadmill') as RunType,
    distance: editing ? String(editing.distanceKm) : '',
    duration: editing ? formatDuration(editing.durationSec) : '',
    avgHr: editing?.avgHr ? String(editing.avgHr) : '',
    maxHr: editing?.maxHr ? String(editing.maxHr) : '',
    cadence: editing?.cadence ? String(editing.cadence) : '',
    rpe: editing?.rpe ? String(editing.rpe) : '',
    splits: editing?.splits ?? '',
    notes: editing?.notes ?? '',
    shoeId: editing ? editing.shoeId ?? '' : defaultShoeId(shoes, all) ?? '',
  }))
  const shoeOptions = shoes.filter((x) => !x.retired || x.id === f.shoeId)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState<RunLog | null>(null)
  const [sharing, setSharing] = useState<RunLog | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const dist = num(f.distance)
  const dur = parseDuration(f.duration)
  const pace = dist && dur ? paceSecPerKm(dist, dur) : null
  const zones = karvonenZones(profile.restingHrBaseline, profile.maxHr)
  const avg = num(f.avgHr)
  const zone = avg ? zoneFor(avg, zones) : undefined
  const isWalk = f.type === 'walk'
  const ruleWarnings = isWalk ? [] : runRuleWarnings(f.date, runs)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dist || dist <= 0 || dist > 100) return setErr('Isi jarak dalam km, misalnya 5,15.')
    if (!dur) return setErr('Isi durasi seperti 36:02 atau 1:05:30.')
    const now = Date.now()
    const run: RunLog = {
      id: editing?.id ?? uid(), date: f.date, time: f.time || undefined, type: f.type,
      distanceKm: dist, durationSec: dur, avgHr: avg, maxHr: num(f.maxHr), cadence: num(f.cadence), rpe: num(f.rpe),
      splits: f.splits.trim() || undefined, notes: f.notes.trim() || undefined, shoeId: f.shoeId || undefined,
      createdAt: editing?.createdAt ?? now, updatedAt: now,
    }
    await saveRun(run)
    if (!editing) celebrate()
    await refresh()
    setErr('')
    setSaved(run)
    if (!editing) setF({ ...f, distance: '', duration: '', avgHr: '', maxHr: '', cadence: '', rpe: '', splits: '', notes: '', shoeId: f.shoeId })
  }

  return (
    <>
      <Card title={editing ? (isWalk ? 'Ubah jalan' : 'Ubah lari') : isWalk ? 'Jalan kaki baru' : 'Lari baru'}>
        {planned && <p className="muted small">Rencana {formatDate(f.date, true)}: {planned.title}</p>}
        {ruleWarnings.map((w) => <p key={w} className="swap">{w}</p>)}
        <form className="form" onSubmit={submit}>
          <div className="row-when">
            <Field label="Tanggal"><input type="date" value={f.date} onChange={set('date')} required /></Field>
            <Field label="Jam"><input type="time" value={f.time} onChange={set('time')} /></Field>
            <Field label="Jenis">
              <select value={f.type} onChange={set('type')}>
                <option value="treadmill">Treadmill</option>
                <option value="outdoor">Luar</option>
                <option value="race">Race</option>
                <option value="walk">Jalan kaki</option>
              </select>
            </Field>
          </div>
          <div className="row3">
            <Field label="Jarak (km)"><input inputMode="decimal" value={f.distance} onChange={set('distance')} placeholder="5,15" /></Field>
            <Field label="Durasi" hint="mm:ss / j:mm:ss"><input inputMode="numeric" value={f.duration} onChange={set('duration')} placeholder="36:02" /></Field>
            <Field label="Pace"><output className="out">{formatPace(pace)}</output></Field>
          </div>
          <div className="row3">
            <Field label="HR rata-rata" hint={zone ? zone.name : undefined}><input inputMode="numeric" value={f.avgHr} onChange={set('avgHr')} placeholder="140" /></Field>
            <Field label="HR maks"><input inputMode="numeric" value={f.maxHr} onChange={set('maxHr')} /></Field>
            <Field label="Cadence"><input inputMode="numeric" value={f.cadence} onChange={set('cadence')} placeholder="163" /></Field>
          </div>
          <div className="row3">
            <Field label="RPE (1–10)"><input inputMode="numeric" value={f.rpe} onChange={set('rpe')} /></Field>
            <div className="span2"><Field label="Split per km"><input value={f.splits} onChange={set('splits')} placeholder="7:16, 6:46, …" /></Field></div>
          </div>
          {shoeOptions.length > 0 && (
            <Field label="Sepatu">
              <select value={f.shoeId} onChange={set('shoeId')}>
                <option value="">Tidak dicatat</option>
                {shoeOptions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Catatan"><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Rasa napas, cuaca, …" /></Field>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="row">
            <button className="btn primary" type="submit">Simpan</button>
            {editing && <a className="btn ghost" href={href('catat', { tab: 'lari' })}>Batal</a>}
          </div>
        </form>
        {saved && (
          <div className="saved" role="status">
            <b>Tersimpan.</b> {formatPace(paceSecPerKm(saved.distanceKm, saved.durationSec))}/km
            {runFlags(saved, profile.easyCap).map((x) => <p key={x} className="flag"><Icon name="alert" size={16} /> {x}</p>)}
            {!runFlags(saved, profile.easyCap).length && saved.avgHr && <p>HR terjaga di zona easy. Mantap.</p>}
            <button className="btn small" onClick={() => setSharing(saved)}><Icon name="share" size={16} /> Bagikan hasil</button>
          </div>
        )}
      </Card>
      <Card title="Riwayat lari & jalan" action={strava ? <button className="link small" onClick={syncStrava} disabled={stravaBusy}>{stravaBusy ? 'Menyinkronkan…' : 'Sinkron Strava'}</button> : undefined}>
        <FileImport existing={all} onDone={refresh} />
        {!all.length && <p className="muted">Belum ada lari tercatat.</p>}
        <ul className="history">
          {[...all].reverse().map((r) => (
            <li key={r.id}>
              <div className="grow">
                <b>{formatDate(r.date, true)}</b> · {TYPE_LABEL[r.type]} · {String(r.distanceKm).replace('.', ',')} km · {formatDuration(r.durationSec)}
                <div className="muted small">
                  Pace {formatPace(paceSecPerKm(r.distanceKm, r.durationSec))} · HR {r.avgHr ?? '–'}/{r.maxHr ?? '–'}
                  {r.avgHr && r.avgHr > profile.easyCap && r.type !== 'race' && r.type !== 'walk' ? ' · di atas batas easy' : ''}
                </div>
              </div>
              <button className="icon-btn" aria-label="Bagikan" title="Bagikan" onClick={() => setSharing(r)}><Icon name="share" size={18} /></button>
              <a className="link" href={href('catat', { tab: 'lari', id: r.id })}>Ubah</a>
              <DeleteBtn onConfirm={async () => { await deleteRun(r.id); await refresh() }} />
            </li>
          ))}
        </ul>
      </Card>
      {sharing && <ShareSheet run={sharing} onClose={() => setSharing(null)} />}
    </>
  )
}

/** Impor lari/jalan dari file ekspor jam (GPX, TCX, FIT), bisa beberapa sekaligus. */
function FileImport({ existing, onDone }: { existing: RunLog[]; onDone: () => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string[]>([])
  async function run(files: File[], origin: { x: number; y: number } | undefined) {
    setBusy(true)
    const res = await importActivityFiles(files, existing, saveRun)
    setBusy(false)
    if (ref.current) ref.current.value = ''
    await onDone()
    if (res.added.length && origin) celebrate(origin)
    setMsg([
      res.added.length ? `${res.added.length} aktivitas masuk: ${res.added.map((r) => `${formatDate(r.date, true)} ${TYPE_LABEL[r.type]} ${String(r.distanceKm).replace('.', ',')} km`).join('; ')}.` : 'Tidak ada aktivitas baru.',
      ...res.skipped.map((s) => `${s.name}: ${s.reason.replace(/\.$/, '')}.`),
    ])
  }
  return (
    <div className="file-import">
      <p className="small muted">Punya file dari jam (Garmin, Coros, Huawei, dll.)? Impor file <b>.gpx</b>, <b>.tcx</b>, atau <b>.fit</b>; jarak, durasi, HR, dan split terisi otomatis.</p>
      <button className="btn small" disabled={busy} onClick={() => ref.current?.click()}>
        <Icon name="plus" size={16} /> {busy ? 'Membaca file…' : 'Impor file jam'}
      </button>
      <input ref={ref} type="file" multiple accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml" hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          const b = ref.current?.previousElementSibling?.getBoundingClientRect()
          if (files.length) run(files, b && { x: b.left + b.width / 2, y: b.top + b.height / 2 })
        }} />
      {msg.length > 0 && <div role="status" className="small">{msg.map((m) => <p key={m}>{m}</p>)}</div>}
    </div>
  )
}

// ---------- Gym

function lastSetsFor(gym: GymLog[], workout: 'A' | 'B', exercise: string, before: string): GymSet[] {
  return gym
    .filter((g) => g.workout === workout && g.date < before)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((g) => g.exercises.find((e) => e.exercise === exercise))
    .filter((e): e is GymSet => !!e && e.setsDone > 0)
}

function GymSection({ params }: { params: URLSearchParams }) {
  const { gym, daily, profile, refresh } = useData()
  const editing = gym.find((g) => g.id === params.get('id'))
  const [date, setDate] = useState(editing?.date ?? params.get('date') ?? today())
  const [workout, setWorkout] = useState<'A' | 'B'>(editing?.workout ?? (params.get('w') as 'A' | 'B') ?? (sessionOn(today())?.kind === 'gymB' ? 'B' : 'A'))
  const [rpe, setRpe] = useState(editing?.rpe ? String(editing.rpe) : '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const saved = params.get('saved') === '1'
  const d = daily.find((x) => x.date === date)
  const ready = readiness({ sys: d?.sys, dia: d?.dia, restingHr: d?.restingHr, sleepHours: d?.sleepHours, baseline: profile.restingHrBaseline, trackBp: profile.trackBp, hypertension: !!profile.medName, pain: painVerdict(daily, date) })

  const initialSets = useMemo(() => GYM[workout].map((ex): GymSet => {
    const prev = editing?.workout === workout ? editing.exercises.find((e) => e.exercise === ex.name) : undefined
    if (prev) return { ...prev }
    const last = lastSetsFor(gym, workout, ex.name, date)[0]
    return { exercise: ex.name, weightKg: last?.weightKg, setsDone: 0, easy: false }
  }), [workout, editing, gym, date])
  const [sets, setSets] = useState<GymSet[]>(initialSets)
  useEffect(() => setSets(initialSets), [initialSets])

  const upd = (i: number, patch: Partial<GymSet>) => setSets(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  async function submit() {
    const now = Date.now()
    const id = editing?.id ?? uid()
    if (!editing) celebrate()
    await saveGym({
      id, date, workout, exercises: sets, rpe: num(rpe), notes: notes.trim() || undefined,
      createdAt: editing?.createdAt ?? now, updatedAt: now,
    })
    await refresh()
    // Pindah ke mode ubah supaya simpan berikutnya tidak membuat entri ganda.
    location.hash = href('catat', { tab: 'gym', id, saved: '1' })
  }

  return (
    <>
      <Card title={editing ? 'Ubah sesi gym' : 'Sesi gym'}>
        <div className="row2">
          <Field label="Tanggal"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Program">
            <Segmented value={workout} onChange={setWorkout} options={[{ value: 'A', label: 'Gym A' }, { value: 'B', label: 'Gym B' }]} />
          </Field>
        </div>
        {ready.level !== 'unknown' && ready.level !== 'green' && (
          <p className="swap"><LevelBadge level={ready.level} /> {ready.headline}{ready.noLoadIncrease ? '. Jangan naikkan beban hari ini.' : ''}</p>
        )}
        {!profile.trackBp && !!profile.medName && <p className="hint">{NO_BP_NOTE}</p>}
        <RestTimer />
        <ol className="exercises">
          {GYM[workout].map((ex, i) => {
            const s = sets[i]
            if (!s) return null
            const hist = lastSetsFor(gym, workout, ex.name, date)
            const progress = hist.length >= 2 && hist[0].easy && hist[1].easy && !ready.noLoadIncrease
            return (
              <li key={ex.name} className={s.setsDone >= ex.sets ? 'complete' : ''}>
                <div className="ex-h">
                  <b>{ex.name}</b> <span className="muted">{ex.prescription}</span>
                  {ex.cue && <div className="muted small">{ex.cue}</div>}
                  {hist[0] && <div className="muted small">Terakhir: {hist[0].weightKg ? `${hist[0].weightKg} kg` : 'tanpa beban'}, {hist[0].setsDone} set</div>}
                  {progress && <div className="up">↑ 2 sesi terakhir ringan: naikkan 1–2,5 kg</div>}
                </div>
                <div className="ex-c">
                  <label className="kg"><input inputMode="decimal" aria-label="Beban kg" value={s.weightKg ?? ''} onChange={(e) => upd(i, { weightKg: num(e.target.value) })} placeholder="kg" /></label>
                  <div className="sets" role="group" aria-label="Set selesai">
                    {Array.from({ length: ex.sets }, (_, k) => (
                      <button key={k} className={k < s.setsDone ? 'on' : ''} onClick={() => upd(i, { setsDone: k < s.setsDone ? k : k + 1 })} aria-label={`Set ${k + 1}`}>{k + 1}</button>
                    ))}
                  </div>
                  <label className="check small"><input type="checkbox" checked={!!s.easy} onChange={(e) => upd(i, { easy: e.target.checked })} /> ringan</label>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="row2">
          <Field label="RPE sesi (1–10)" hint="Target 6–7"><input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} /></Field>
          <Field label="Catatan"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div className="row">
          <button className="btn primary" onClick={submit}>Simpan sesi</button>
          {saved && <span role="status">✓ Tersimpan</span>}
        </div>
        <details className="rules">
          <summary>Aturan gym</summary>
          <ul>{GYM_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        </details>
      </Card>
      <Card title="Riwayat gym">
        {!gym.length && <p className="muted">Belum ada sesi gym.</p>}
        <ul className="history">
          {[...gym].reverse().map((g) => (
            <li key={g.id}>
              <div className="grow">
                <b>{formatDate(g.date, true)}</b> · Gym {g.workout}{g.rpe ? ` · RPE ${g.rpe}` : ''}
                <div className="muted small">{g.exercises.filter((e) => e.setsDone).length}/{g.exercises.length} latihan</div>
              </div>
              <a className="link" href={href('catat', { tab: 'gym', id: g.id })}>Ubah</a>
              <DeleteBtn onConfirm={async () => { await deleteGym(g.id); await refresh() }} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function RestTimer() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => {
      setLeft(left - 1)
      if (left === 1) navigator.vibrate?.([200, 100, 200])
    }, 1000)
    return () => clearTimeout(t)
  }, [left])
  return (
    <div className="timer">
      <span>Istirahat antar set:</span>
      {left > 0 ? (
        <>
          <b className="mono">{formatDuration(left)}</b>
          <button className="link" onClick={() => setLeft(0)}>Stop</button>
        </>
      ) : (
        <>
          <button className="btn small" onClick={() => setLeft(60)}>60"</button>
          <button className="btn small" onClick={() => setLeft(90)}>90"</button>
        </>
      )}
    </div>
  )
}

// ---------- Harian

function DailySection({ params }: { params: URLSearchParams }) {
  const { daily, profile, refresh } = useData()
  const [date, setDate] = useState(params.get('date') ?? today())
  return (
    <>
      <Card title={profile.trackBp ? 'Tensi, HR istirahat, tidur' : 'HR istirahat & tidur'}>
        <Field label="Tanggal"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <DailyForm key={date} date={date} />
      </Card>
      <Card title="Riwayat">
        {!daily.length && <p className="muted">Belum ada catatan.</p>}
        <ul className="history">
          {[...daily].reverse().map((d) => {
            const r = readiness({ sys: d.sys, dia: d.dia, restingHr: d.restingHr, sleepHours: d.sleepHours, baseline: profile.restingHrBaseline, trackBp: profile.trackBp, hypertension: !!profile.medName, pain: painVerdict(daily, d.date) })
            return (
              <li key={d.date}>
                <div className="grow">
                  <b>{formatDate(d.date, true)}</b>{profile.trackBp && ` · ${d.sys && d.dia ? `${d.sys}/${d.dia}` : '–'}`} · HR {d.restingHr ?? '–'}
                  {d.sleepHours != null && ` · tidur ${d.sleepHours} j`}
                  {!!d.painAreas?.length && ` · nyeri ${d.painAreas.join(', ').toLowerCase()}${d.painScore ? ` ${d.painScore}/10` : ''}`}
                  <div><LevelBadge level={r.level} /></div>
                </div>
                <button className="link" onClick={() => setDate(d.date)}>Ubah</button>
                <DeleteBtn onConfirm={async () => { await deleteDaily(d.date); await refresh() }} />
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}

function DeleteBtn({ onConfirm }: { onConfirm: () => void }) {
  const [ask, setAsk] = useState(false)
  if (!ask) return <button className="link danger" onClick={() => setAsk(true)}>Hapus</button>
  return (
    <span className="confirm">
      <button className="link danger" onClick={onConfirm}>Yakin?</button>
      <button className="link" onClick={() => setAsk(false)}>Batal</button>
    </span>
  )
}
