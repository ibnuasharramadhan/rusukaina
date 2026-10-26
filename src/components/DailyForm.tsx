import { useState } from 'react'
import { PAIN_AREAS } from '../lib/body'
import { averageBp, parseReading, type BpReading } from '../lib/bp'
import { saveDaily } from '../lib/db'
import { useData } from '../lib/store'
import type { DailyLog } from '../lib/types'
import { Field, num } from './ui'

const s = (n?: number) => (n == null ? '' : String(n))

/** Isian awal dua pengukuran: dari data mentah kalau ada, kalau tidak dari nilai harian. */
function readingFields(raw: BpReading[] | undefined, sys?: number, dia?: number) {
  const r1 = raw?.[0] ?? (sys != null && dia != null ? { sys, dia } : undefined)
  const r2 = raw?.[1]
  return [s(r1?.sys), s(r1?.dia), s(r2?.sys), s(r2?.dia)] as const
}

/** Form tensi + HR istirahat + tidur untuk satu tanggal. */
export function DailyForm({ date, compact, onSaved }: { date: string; compact?: boolean; onSaved?: () => void }) {
  const { daily, profile, refresh } = useData()
  const bp = profile.trackBp
  const existing = daily.find((d) => d.date === date)
  const [am1s, am1d, am2s, am2d] = readingFields(existing?.bpAm, existing?.sys, existing?.dia)
  const [pm1s, pm1d, pm2s, pm2d] = readingFields(existing?.bpPm, existing?.sysPm, existing?.diaPm)
  const [f, setF] = useState({
    am1s, am1d, am2s, am2d, pm1s, pm1d, pm2s, pm2d, restingHr: s(existing?.restingHr),
    sleepHours: s(existing?.sleepHours),
    medTaken: existing?.medTaken ?? true, symptoms: existing?.symptoms ?? '', notes: existing?.notes ?? '',
    painAreas: existing?.painAreas ?? [], painScore: s(existing?.painScore),
    dizzy: !!existing?.dizzy, dryCough: !!existing?.dryCough,
  })
  const scheduled = !!profile.medSchedule?.length
  const [err, setErr] = useState('')
  // Di kartu Hari ini (compact), pilihan nyeri disembunyikan sampai dibutuhkan.
  const [showPain, setShowPain] = useState(!compact || !!existing?.painAreas?.length)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = [parseReading(f.am1s, f.am1d), parseReading(f.am2s, f.am2d), parseReading(f.pm1s, f.pm1d), parseReading(f.pm2s, f.pm2d)]
    const bad = parsed.find((x) => typeof x === 'string')
    if (bad) return setErr(bad)
    const ok = (xs: typeof parsed) => xs.filter((x): x is BpReading => !!x && typeof x !== 'string')
    const am = ok(parsed.slice(0, 2)), pm = ok(parsed.slice(2))
    const amAvg = averageBp(am), pmAvg = averageBp(pm)
    const hr = num(f.restingHr)
    if (hr != null && (hr < 30 || hr > 130)) return setErr('HR istirahat tidak masuk akal.')
    const pain = num(f.painScore)
    if (pain != null && (pain < 1 || pain > 10)) return setErr('Skala nyeri 1–10.')
    // Tanda minum obat bisa berubah dari kartu "Obat hari ini" setelah form ini dibuka.
    const cur = daily.find((d) => d.date === date)
    const entry: DailyLog = {
      date, sys: amAvg?.sys, dia: amAvg?.dia, restingHr: hr, sleepHours: num(f.sleepHours),
      sysPm: pmAvg?.sys, diaPm: pmAvg?.dia,
      bpAm: am.length > 1 ? am : undefined, bpPm: pm.length > 1 ? pm : undefined,
      medTaken: !profile.medName ? undefined : scheduled ? cur?.medTaken : f.medTaken, medDoses: cur?.medDoses,
      dizzy: profile.medName && f.dizzy ? true : undefined, dryCough: profile.medName && f.dryCough ? true : undefined,
      symptoms: f.symptoms.trim() || undefined, notes: f.notes.trim() || undefined,
      painAreas: f.painAreas.length ? f.painAreas : undefined, painScore: f.painAreas.length ? pain : undefined, updatedAt: Date.now(),
    }
    await saveDaily(entry)
    await refresh()
    setErr('')
    onSaved?.()
  }

  return (
    <form className="form" onSubmit={submit}>
      {bp ? (
        <>
          <BpSet title="Tensi pagi" f={f} keys={['am1s', 'am1d', 'am2s', 'am2d']} set={set} placeholders={['148', '83']} />
          <div className="row2">
            <Field label="HR istirahat"><input inputMode="numeric" value={f.restingHr} onChange={set('restingHr')} placeholder={String(profile.restingHrBaseline)} /></Field>
            <Field label="Tidur (jam)"><input inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} placeholder="7" /></Field>
          </div>
          {!compact && <BpSet title="Tensi malam (sebelum tidur)" f={f} keys={['pm1s', 'pm1d', 'pm2s', 'pm2d']} set={set} />}
        </>
      ) : (
        <div className="row2">
          <Field label="HR istirahat"><input inputMode="numeric" value={f.restingHr} onChange={set('restingHr')} placeholder={String(profile.restingHrBaseline)} /></Field>
          <Field label="Tidur (jam)"><input inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} placeholder="7" /></Field>
        </div>
      )}
      {profile.medName && !scheduled && <label className="check"><input type="checkbox" checked={f.medTaken} onChange={set('medTaken')} /> {profile.medName} sudah diminum</label>}
      {profile.medName && (
        <fieldset className="symptoms">
          <legend className="field-l">Keluhan pagi ini</legend>
          <label className="check"><input type="checkbox" checked={f.dizzy} onChange={set('dizzy')} /> Pusing / kliyengan</label>
          <label className="check"><input type="checkbox" checked={f.dryCough} onChange={set('dryCough')} /> Batuk kering</label>
        </fieldset>
      )}
      {!showPain && <button type="button" className="link small" style={{ justifySelf: 'start' }} onClick={() => setShowPain(true)}>Ada nyeri hari ini?</button>}
      {showPain && <fieldset className="pain">
        <legend className="field-l">Nyeri hari ini (kalau ada)</legend>
        <div className="chips">
          {PAIN_AREAS.map((a) => {
            const on = f.painAreas.includes(a)
            return (
              <button key={a} type="button" className={`pain-chip ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => setF({ ...f, painScore: f.painScore || '3', painAreas: on ? f.painAreas.filter((x) => x !== a) : [...f.painAreas, a] })}>{a}</button>
            )
          })}
        </div>
        {f.painAreas.length > 0 && (
          <Field label="Skala nyeri (1 = terasa sedikit, 10 = sangat sakit)">
            <div className="pain-scale">
              <input type="range" min={1} max={10} value={f.painScore} onChange={set('painScore')} aria-valuetext={`${f.painScore} dari 10`} />
              <span className="num pain-v">{f.painScore}/10</span>
            </div>
          </Field>
        )}
      </fieldset>}
      {!compact && (
        <>
          <Field label="Keluhan (kalau ada)"><input value={f.symptoms} onChange={set('symptoms')} placeholder="pusing, bengkak pergelangan kaki, ..." /></Field>
          <Field label="Catatan"><input value={f.notes} onChange={set('notes')} /></Field>
        </>
      )}
      <p className="hint">{bp
        ? 'Ukur pagi sebelum obat & kopi, duduk tenang 5 menit, 2x dengan jeda 1 menit. Rata-ratanya dihitung otomatis.'
        : 'HR istirahat: lihat di jam/band saat baru bangun.'}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" type="submit">Simpan</button>
    </form>
  )
}

type BpKey = 'am1s' | 'am1d' | 'am2s' | 'am2d' | 'pm1s' | 'pm1d' | 'pm2s' | 'pm2d'

/** Dua pengukuran (ukur 1 wajib bila ada, ukur 2 opsional) + rata-ratanya. */
function BpSet({ title, f, keys, set, placeholders }: {
  title: string
  f: Record<BpKey, string>
  keys: [BpKey, BpKey, BpKey, BpKey]
  set: (k: BpKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholders?: [string, string]
}) {
  const [s1, d1, s2, d2] = keys
  const rs = [parseReading(f[s1], f[d1]), parseReading(f[s2], f[d2])].filter((x): x is BpReading => !!x && typeof x !== 'string')
  const avg = rs.length > 1 ? averageBp(rs) : undefined
  return (
    <fieldset className="bp-set">
      <legend className="field-l">{title}</legend>
      <div className="row2 even">
        <Field label="Sistolik"><input inputMode="numeric" value={f[s1]} onChange={set(s1)} placeholder={placeholders?.[0]} /></Field>
        <Field label="Diastolik"><input inputMode="numeric" value={f[d1]} onChange={set(d1)} placeholder={placeholders?.[1]} /></Field>
      </div>
      <div className="row2 even">
        <Field label="Ukur ke-2: sistolik"><input inputMode="numeric" value={f[s2]} onChange={set(s2)} /></Field>
        <Field label="Ukur ke-2: diastolik"><input inputMode="numeric" value={f[d2]} onChange={set(d2)} /></Field>
      </div>
      {avg && <p className="hint" aria-live="polite">Rata-rata yang disimpan: <b className="num">{avg.sys}/{avg.dia}</b></p>}
    </fieldset>
  )
}
