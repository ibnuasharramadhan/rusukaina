import { useState } from 'react'
import { PAIN_AREAS } from '../lib/body'
import { saveDaily } from '../lib/db'
import { useData } from '../lib/store'
import type { DailyLog } from '../lib/types'
import { Field, num } from './ui'

const s = (n?: number) => (n == null ? '' : String(n))

/** Form tensi + HR istirahat + tidur untuk satu tanggal. */
export function DailyForm({ date, compact, onSaved }: { date: string; compact?: boolean; onSaved?: () => void }) {
  const { daily, profile, refresh } = useData()
  const bp = profile.trackBp
  const existing = daily.find((d) => d.date === date)
  const [f, setF] = useState({
    sys: s(existing?.sys), dia: s(existing?.dia), restingHr: s(existing?.restingHr),
    sleepHours: s(existing?.sleepHours), sysPm: s(existing?.sysPm), diaPm: s(existing?.diaPm),
    medTaken: existing?.medTaken ?? true, symptoms: existing?.symptoms ?? '', notes: existing?.notes ?? '',
    painAreas: existing?.painAreas ?? [], painScore: s(existing?.painScore),
  })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const sys = num(f.sys), dia = num(f.dia)
    if ((sys == null) !== (dia == null)) return setErr('Isi sistolik dan diastolik sekaligus.')
    if (sys != null && dia != null && (sys < 70 || sys > 260 || dia < 40 || dia > 160 || dia >= sys)) return setErr('Angka tensi tidak masuk akal, cek lagi.')
    const hr = num(f.restingHr)
    if (hr != null && (hr < 30 || hr > 130)) return setErr('HR istirahat tidak masuk akal.')
    const pain = num(f.painScore)
    if (pain != null && (pain < 1 || pain > 10)) return setErr('Skala nyeri 1–10.')
    const entry: DailyLog = {
      date, sys, dia, restingHr: hr, sleepHours: num(f.sleepHours),
      sysPm: num(f.sysPm), diaPm: num(f.diaPm), medTaken: profile.medName ? f.medTaken : undefined,
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
          <div className="row3">
            <Field label="Sistolik"><input inputMode="numeric" value={f.sys} onChange={set('sys')} placeholder="148" /></Field>
            <Field label="Diastolik"><input inputMode="numeric" value={f.dia} onChange={set('dia')} placeholder="83" /></Field>
            <Field label="HR istirahat"><input inputMode="numeric" value={f.restingHr} onChange={set('restingHr')} placeholder={String(profile.restingHrBaseline)} /></Field>
          </div>
          <div className="row3">
            <Field label="Tidur (jam)"><input inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} placeholder="7" /></Field>
            {!compact && <Field label="Malam: sistolik"><input inputMode="numeric" value={f.sysPm} onChange={set('sysPm')} /></Field>}
            {!compact && <Field label="Malam: diastolik"><input inputMode="numeric" value={f.diaPm} onChange={set('diaPm')} /></Field>}
          </div>
        </>
      ) : (
        <div className="row2">
          <Field label="HR istirahat"><input inputMode="numeric" value={f.restingHr} onChange={set('restingHr')} placeholder={String(profile.restingHrBaseline)} /></Field>
          <Field label="Tidur (jam)"><input inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} placeholder="7" /></Field>
        </div>
      )}
      {profile.medName && <label className="check"><input type="checkbox" checked={f.medTaken} onChange={set('medTaken')} /> {profile.medName} sudah diminum</label>}
      <fieldset className="pain">
        <legend className="field-l">Nyeri hari ini (kalau ada)</legend>
        <div className="chips">
          {PAIN_AREAS.map((a) => {
            const on = f.painAreas.includes(a)
            return (
              <button key={a} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
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
      </fieldset>
      {!compact && (
        <>
          <Field label="Keluhan (kalau ada)"><input value={f.symptoms} onChange={set('symptoms')} placeholder="pusing, bengkak pergelangan kaki, ..." /></Field>
          <Field label="Catatan"><input value={f.notes} onChange={set('notes')} /></Field>
        </>
      )}
      <p className="hint">{bp
        ? 'Ukur pagi sebelum obat & kopi, duduk tenang 5 menit, 2x dengan jeda 1 menit (isi rata-ratanya).'
        : 'HR istirahat: lihat di jam/band saat baru bangun.'}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary" type="submit">Simpan</button>
    </form>
  )
}
