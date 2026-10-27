import { useState } from 'react'
import { BMI_BANDS, WAIST_LIMIT, WHTR_BANDS, bmi, measures, waist, waistTarget, weightForBmi, whtr, type Band, type Reading, type Sex } from '../lib/bodycomp'
import { formatDate, today } from '../lib/date'
import { saveDaily, saveProfile } from '../lib/db'
import { useData } from '../lib/store'
import { ageOn } from '../lib/zones'
import { LineChart } from './charts'
import { Card, Field, num } from './ui'

const dec = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

/** BMI, lingkar perut, dan rasio pinggang-tinggi dari profil + pengukuran terakhir. */
export function BodyCard() {
  const { profile, daily } = useData()
  const { weight, waist: waists } = measures(daily)
  const w = weight.at(-1), wc = waists.at(-1)
  const h = profile.heightCm, sex = profile.sex
  const ready = !!(h && sex && w)

  const b = ready ? bmi(w.value, h) : undefined
  const wr = wc && sex ? waist(wc.value, sex) : undefined
  const ratio = wc && h ? whtr(wc.value, h) : undefined

  return (
    <Card title="Komposisi tubuh" className="body-card">
      {ready ? (
        <>
          <p className="muted small">
            {ageOn(profile.birthDate, today())} th · {sex === 'm' ? 'pria' : 'wanita'} · {h} cm · {dec(w.value)} kg ({formatDate(w.date)})
            {wc && <> · perut {dec(wc.value, wc.value % 1 ? 1 : 0)} cm ({formatDate(wc.date)})</>}
          </p>
          <Metric title="BMI (IMT)" reading={b!} fmt={(v) => dec(v)} scale={[15, 35]} bands={BMI_BANDS}
            note={`Berat ÷ tinggi². Kategori Kemenkes. Batas Asia-Pasifik lebih ketat: ≥ 23 sudah berisiko.`} />
          {wr ? (
            <Metric title="Lingkar perut" unit="cm" reading={wr} fmt={(v) => dec(v, v % 1 ? 1 : 0)} scale={sex === 'm' ? [65, 115] : [55, 105]}
              bands={[{ to: WAIST_LIMIT[sex!], label: 'Di bawah batas', level: 'green' }, { to: Infinity, label: 'Obesitas sentral', level: 'red' }]}
              note={`Batas obesitas sentral ${sex === 'm' ? 'pria' : 'wanita'}: ${WAIST_LIMIT[sex!]} cm (Kemenkes).`} />
          ) : (
            <p className="flag">Belum ada lingkar perut. Ukur dengan pita ukur sejajar pusar, berdiri tegak, di akhir buang napas biasa.</p>
          )}
          {ratio && (
            <Metric title="Rasio pinggang : tinggi" reading={ratio} fmt={(v) => dec(v, 2)} scale={[0.35, 0.75]} bands={WHTR_BANDS}
              note="Lingkar perut ÷ tinggi badan. Sehat bila di bawah 0,5: lingkar perut kurang dari setengah tinggi badan." />
          )}
          <Targets h={h} sex={sex} weightKg={w.value} waistCm={wc?.value} />
          {(weight.length > 1 || waists.length > 1) && (
            <div className="body-trend">
              {weight.length > 1 && <p className="stat-l">Berat badan (kg)</p>}
              {weight.length > 1 && <LineChart height={150} yFormat={(v) => dec(v)} series={[{ name: 'Berat (kg)', color: 'var(--series-1)', points: weight.map((m) => ({ x: m.date, y: m.value })) }]}
                refs={[{ y: weightForBmi(25, h), label: 'BMI 25', tone: 'warn' }]} />}
              {waists.length > 1 && <p className="stat-l">Lingkar perut (cm)</p>}
              {waists.length > 1 && <LineChart height={150} series={[{ name: 'Lingkar perut (cm)', color: 'var(--series-2)', points: waists.map((m) => ({ x: m.date, y: m.value })) }]}
                refs={[{ y: WAIST_LIMIT[sex], label: String(WAIST_LIMIT[sex]), tone: 'bad' }]} />}
            </div>
          )}
          <Why />
        </>
      ) : (
        <p className="small">Isi tinggi badan, jenis kelamin, dan berat badan untuk melihat BMI. Tambahkan lingkar perut untuk penilaian lemak perut.</p>
      )}
      <MeasureForm open={!ready} />
    </Card>
  )
}

function Metric({ title, unit, reading, fmt, scale, bands, note }: {
  title: string; unit?: string; reading: Reading; fmt: (v: number) => string; scale: [number, number]; bands: Band[]; note: string
}) {
  const [lo, hi] = scale
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  let from = lo
  return (
    <div className="body-metric">
      <div className="body-metric-h">
        <span className="stat-l">{title}</span>
        <span className={`badge lv-${reading.band.level}`}>{reading.band.label}</span>
      </div>
      <div className="body-metric-v"><span className="num">{fmt(reading.value)}</span>{unit && <small> {unit}</small>}</div>
      <div className="scale" role="img" aria-label={`${title} ${fmt(reading.value)}${unit ? ` ${unit}` : ''}: ${reading.band.label}`}>
        <div className="scale-bar">
          {bands.map((b) => {
            const start = pos(from), end = pos(b.to)
            from = Math.min(b.to, hi)
            return end > start ? <span key={b.label} className={`scale-seg lv-${b.level}`} style={{ left: `${start}%`, width: `${end - start}%` }} /> : null
          })}
          <span className="scale-mark" style={{ left: `${pos(reading.value)}%` }} />
        </div>
        <div className="scale-ticks" aria-hidden>
          {bands.filter((b) => b.to > lo && b.to < hi).map((b) => <span key={b.label} style={{ left: `${pos(b.to)}%` }}>{fmt(b.tick ?? b.to)}</span>)}
        </div>
      </div>
      <p className="hint">{note}</p>
    </div>
  )
}

function Targets({ h, sex, weightKg, waistCm }: { h: number; sex: Sex; weightKg: number; waistCm?: number }) {
  const normal = weightForBmi(25, h), asia = weightForBmi(23, h)
  const wt = waistTarget(h, sex)
  const lose = Math.max(0, weightKg - normal)
  return (
    <div className="body-targets">
      <p className="stat-l">Target</p>
      <ul>
        <li>Berat normal (BMI ≤ 25): <b>≤ {dec(normal)} kg</b>{lose > 0 ? <>, turun {dec(lose)} kg</> : ' ✓'}. Batas Asia-Pasifik (BMI &lt; 23): {dec(asia)} kg.</li>
        <li>Lingkar perut: <b>&lt; {dec(wt, wt % 1 ? 1 : 0)} cm</b> (di bawah setengah tinggi badan){waistCm != null && (waistCm < wt ? ' ✓' : <>, sekarang {dec(waistCm - wt, (waistCm - wt) % 1 ? 1 : 0)} cm di atasnya</>)}.</li>
        <li>Turun 5–10% berat badan sudah menurunkan tensi dan gula darah. Aman: 0,5 kg per minggu.</li>
      </ul>
    </div>
  )
}

function Why() {
  return (
    <details className="why">
      <summary>Kenapa lingkar perut penting?</summary>
      <ul className="advice">
        <li>BMI hanya membandingkan berat dan tinggi. BMI tidak bisa membedakan otot dan lemak, juga tidak tahu di mana lemak tersimpan.</li>
        <li>Lemak di perut (lemak viseral) paling erat kaitannya dengan hipertensi, diabetes, kolesterol tinggi, dan penyakit jantung. Lingkar perut mengukurnya langsung.</li>
        <li>Jadi BMI tetap dipakai, tapi sekarang dilengkapi lingkar perut. Kemenkes memakai batas obesitas sentral pria ≥ 90 cm dan wanita ≥ 80 cm. Panduan NICE (Inggris, 2022) menyarankan lingkar perut di bawah setengah tinggi badan.</li>
        <li>Ukur seminggu sekali di jam yang sama (pagi, sebelum makan), pita ukur sejajar pusar, di akhir buang napas biasa.</li>
      </ul>
    </details>
  )
}

function MeasureForm({ open }: { open: boolean }) {
  const { profile, daily, refresh } = useData()
  const [f, setF] = useState({ date: today(), weight: '', waist: '', height: profile.heightCm ? String(profile.heightCm) : '', sex: profile.sex ?? '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setMsg('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const wkg = num(f.weight), wcm = num(f.waist), hcm = num(f.height)
    if (hcm != null && (hcm < 120 || hcm > 220)) return setErr('Tinggi badan tidak masuk akal (cm).')
    if (wkg != null && (wkg < 30 || wkg > 250)) return setErr('Berat badan tidak masuk akal (kg).')
    if (wcm != null && (wcm < 50 || wcm > 180)) return setErr('Lingkar perut tidak masuk akal (cm).')
    if (wkg == null && wcm == null && hcm === profile.heightCm && f.sex === (profile.sex ?? '')) return setErr('Isi berat atau lingkar perut.')
    setErr('')
    if (hcm !== profile.heightCm || f.sex !== (profile.sex ?? '')) {
      await saveProfile({ ...profile, heightCm: hcm, sex: f.sex === 'm' || f.sex === 'f' ? f.sex : undefined })
    }
    if (wkg != null || wcm != null) {
      const cur = daily.find((d) => d.date === f.date)
      await saveDaily({ ...(cur ?? { date: f.date }), weightKg: wkg ?? cur?.weightKg, waistCm: wcm ?? cur?.waistCm, updatedAt: Date.now() })
    }
    await refresh()
    setF({ ...f, weight: '', waist: '' })
    setMsg(`Tersimpan untuk ${formatDate(f.date, true)}.`)
  }

  return (
    <details className="body-form" open={open}>
      <summary className="small">Catat berat & lingkar perut</summary>
      <form className="form" onSubmit={submit}>
        <div className="row2 even">
          <Field label="Tanggal"><input type="date" value={f.date} max={today()} onChange={set('date')} /></Field>
          <Field label="Berat badan (kg)"><input inputMode="decimal" value={f.weight} onChange={set('weight')} placeholder="mis. 70,5" /></Field>
        </div>
        <div className="row2 even">
          <Field label="Lingkar perut (cm)"><input inputMode="decimal" value={f.waist} onChange={set('waist')} placeholder="mis. 88" /></Field>
          <Field label="Tinggi badan (cm)"><input inputMode="numeric" value={f.height} onChange={set('height')} placeholder="mis. 165" /></Field>
        </div>
        <Field label="Jenis kelamin">
          <select value={f.sex} onChange={set('sex')}>
            <option value="">Pilih</option>
            <option value="m">Pria</option>
            <option value="f">Wanita</option>
          </select>
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="btn primary">Simpan</button><span role="status" className="small">{msg}</span></div>
      </form>
    </details>
  )
}
