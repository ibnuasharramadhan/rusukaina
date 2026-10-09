import { useRef, useState } from 'react'
import { Icon } from '../components/icons'
import { Card, Field, num, Segmented } from '../components/ui'
import { generatePlan, peakLongMin } from '../data/generator'
import { addDays, formatDate, today } from '../lib/date'
import { importAll, saveProfile } from '../lib/db'
import { celebrate, originOf } from '../lib/motion'
import { href } from '../lib/router'
import { useData } from '../lib/store'
import type { PlanInput, Profile } from '../lib/types'
import { ageOn } from '../lib/zones'

const DISTANCES = [5, 7, 10, 21.1]
const km = (n: number) => String(n).replace('.', ',')

/** HR maks (Tanaka) dan batas easy (≈67% cadangan HR, Karvonen), sama seperti hitungan untuk Ibnu. */
export function hrDefaults(birthDate: string, rest: number, on = today()) {
  const maxHr = Math.round(208 - 0.7 * ageOn(birthDate, on))
  return { maxHr, easyCap: Math.round(rest + 0.67 * (maxHr - rest)) }
}

/** Kenalan, target, kondisi: tiga langkah untuk menyusun rencana sendiri. */
export function Onboarding() {
  const { profile, needsOnboarding, refresh } = useData()
  const prev = !needsOnboarding && profile.plan?.kind === 'generated' ? profile.plan.input : undefined
  const t = today()
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [f, setF] = useState(() => ({
    name: needsOnboarding ? '' : profile.name,
    birthDate: needsOnboarding ? '' : profile.birthDate,
    rest: needsOnboarding ? '' : String(profile.restingHrBaseline),
    trackBp: needsOnboarding ? false : profile.trackBp,
    medName: needsOnboarding ? '' : profile.medName ?? '',
    raceName: prev?.raceName ?? '',
    raceDate: prev?.raceDate ?? '',
    raceKm: prev?.raceKm ?? 5,
    currentMin: prev?.currentMin ?? 20,
    runsPerWeek: prev?.runsPerWeek ?? 3,
    longDay: prev?.longDay ?? 6,
    gymPerWeek: prev?.gymPerWeek ?? 2,
  }))
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const input: PlanInput | null = f.raceDate && f.raceDate >= addDays(t, 14)
    ? { start: t, raceDate: f.raceDate, raceName: f.raceName.trim() || `Lari ${km(f.raceKm)}K`, raceKm: f.raceKm, currentMin: f.currentMin, runsPerWeek: f.runsPerWeek as 2 | 3, longDay: f.longDay as 0 | 6, gymPerWeek: f.gymPerWeek as 0 | 1 | 2 }
    : null
  const preview = input ? generatePlan(input) : null
  const longs = preview?.weeks.map((w) => w.longMin ?? 0).filter(Boolean) ?? []

  function next() {
    setErr('')
    if (step === 0) {
      const rest = num(f.rest)
      if (!f.name.trim()) return setErr('Isi nama dulu.')
      if (!f.birthDate || f.birthDate > addDays(t, -365 * 12)) return setErr('Isi tanggal lahir.')
      if (!rest || rest < 35 || rest > 100) return setErr('HR istirahat biasanya 45–80. Lihat di jam/band saat baru bangun.')
    }
    if (step === 1 && !input) return setErr(`Pilih tanggal race paling cepat ${formatDate(addDays(t, 14))} (minimal 2 minggu persiapan).`)
    setStep(step + 1)
  }

  async function finish(e: React.MouseEvent) {
    if (!input) return
    const origin = originOf(e)
    const rest = num(f.rest)!
    const p: Profile = {
      name: f.name.trim(), birthDate: f.birthDate, restingHrBaseline: rest, ...hrDefaults(f.birthDate, rest),
      raceDate: input.raceDate, raceName: input.raceName, trackBp: f.trackBp, medName: f.medName.trim() || undefined,
      plan: { kind: 'generated', input },
    }
    await saveProfile(p)
    celebrate(origin)
    location.hash = href('hari-ini')
    await refresh()
  }

  return (
    <div className="page onboarding">
      <header className="page-h">
        <p className="eyebrow">Langkah {step + 1} dari 3</p>
        <h1>{['Kenalan dulu', 'Targetmu', 'Kondisi & jadwal'][step]}</h1>
        <div className="steps" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
      </header>

      {step === 0 && (
        <Card>
          <div className="form">
            <Field label="Nama panggilan"><input value={f.name} onChange={set('name')} autoComplete="given-name" /></Field>
            <Field label="Tanggal lahir"><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
            <Field label="HR istirahat (bpm)" hint="Lihat di jam/band saat baru bangun, sebelum turun dari kasur."><input inputMode="numeric" value={f.rest} onChange={set('rest')} placeholder="60" /></Field>
            <label className="check"><input type="checkbox" checked={f.trackBp} onChange={set('trackBp')} /> Saya punya tensimeter dan ingin memantau tensi</label>
            <Field label="Obat tensi rutin (kosongkan kalau tidak ada)"><input value={f.medName} onChange={set('medName')} placeholder="mis. Amlodipin" /></Field>
            <p className="hint">Punya hipertensi, penyakit jantung, atau pernah nyeri dada saat olahraga? Konsultasikan ke dokter dulu sebelum mulai.</p>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="form">
            <Field label="Nama race"><input value={f.raceName} onChange={set('raceName')} placeholder="mis. Jakarta Running Festival" /></Field>
            <Field label="Tanggal race"><input type="date" value={f.raceDate} min={addDays(t, 14)} onChange={set('raceDate')} /></Field>
            <div className="field">
              <span className="field-l">Jarak</span>
              <Segmented value={String(f.raceKm)} options={DISTANCES.map((d) => ({ value: String(d), label: `${km(d)}K` }))} onChange={(v) => setF({ ...f, raceKm: Number(v) })} />
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <div className="form">
              <div className="field">
                <span className="field-l">Lari nonstop terlama saat ini</span>
                <Segmented value={String(f.currentMin)} options={[10, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `${m}'` }))} onChange={(v) => setF({ ...f, currentMin: Number(v) })} />
              </div>
              <div className="field">
                <span className="field-l">Lari per minggu</span>
                <Segmented value={String(f.runsPerWeek)} options={[{ value: '2', label: '2x' }, { value: '3', label: '3x' }]} onChange={(v) => setF({ ...f, runsPerWeek: Number(v) as 2 | 3 })} />
              </div>
              <div className="field">
                <span className="field-l">Long run di hari</span>
                <Segmented value={String(f.longDay)} options={[{ value: '6', label: 'Sabtu' }, { value: '0', label: 'Minggu' }]} onChange={(v) => setF({ ...f, longDay: Number(v) as 0 | 6 })} />
              </div>
              <div className="field">
                <span className="field-l">Gym per minggu</span>
                <Segmented value={String(f.gymPerWeek)} options={[{ value: '0', label: 'Tidak' }, { value: '1', label: '1x' }, { value: '2', label: '2x' }]} onChange={(v) => setF({ ...f, gymPerWeek: Number(v) as 0 | 1 | 2 })} />
              </div>
            </div>
          </Card>
          {preview && (
            <aside className="note">
              <Icon name="bolt" size={18} />
              <div>
                <p><b>{preview.weeks.length} minggu menuju {input!.raceName}.</b> Long run naik dari {longs[0]}' ke {Math.max(...longs)}', deload tiap minggu ke-4, lalu taper sebelum race.</p>
                {Math.max(...longs) < peakLongMin(f.raceKm) && <p>Waktu persiapan cukup pendek: long run belum sampai {peakLongMin(f.raceKm)}'. Race tetap bisa, dengan target finish nyaman.</p>}
                <p className="small">Semua lari easy, maks {f.runsPerWeek} lari per minggu, tidak pernah 2 hari berturut-turut.</p>
              </div>
            </aside>
          )}
        </>
      )}

      {err && <p className="error" role="alert">{err}</p>}
      <div className="row">
        {step > 0 && <button className="btn ghost" onClick={() => { setErr(''); setStep(step - 1) }}>Kembali</button>}
        {!needsOnboarding && step === 0 && <a className="btn ghost" href={href('info')}>Batal</a>}
        <span className="grow" />
        {step < 2 ? <button className="btn primary" onClick={next}>Lanjut</button> : <button className="btn primary" onClick={finish} disabled={!input}>Mulai latihan</button>}
      </div>
      {needsOnboarding && step === 0 && <Restore onDone={refresh} />}
    </div>
  )
}

/** HP baru tapi sudah punya file cadangan: pulihkan semuanya, termasuk profil. */
function Restore({ onDone }: { onDone: () => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  async function restore(file: File) {
    try {
      await importAll(JSON.parse(await file.text()), { includeProfile: true })
      await onDone()
    } catch (e) {
      setMsg(`Gagal memulihkan: ${(e as Error).message}`)
    }
  }
  return (
    <p className="small muted center">
      Sudah pernah pakai aplikasi ini? <button className="link small" onClick={() => ref.current?.click()}>Pulihkan dari file cadangan</button>
      <input ref={ref} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
      {msg && <span className="error block">{msg}</span>}
    </p>
  )
}
