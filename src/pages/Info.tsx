import { useRef, useState } from 'react'
import { StravaCard } from '../components/StravaCard'
import { Card, Field, num, PageHeader } from '../components/ui'
import { COOLDOWN, GYM, GYM_RULES, WARMUP } from '../data/gym'
import { downloadBackup } from '../lib/backup'
import { plan } from '../data/plan'
import { formatDate, today } from '../lib/date'
import { href } from '../lib/router'
import { importAll, saveProfile, wipeAll } from '../lib/db'
import { useInstallPrompt } from '../lib/pwa'
import { STOP_SIGNS } from '../lib/safety'
import { coachSummary } from '../lib/stats'
import { useData } from '../lib/store'
import { ageOn, karvonenZones, mafHr } from '../lib/zones'

export function Info() {
  return (
    <div className="page">
      <PageHeader eyebrow="Zona, aturan, data" title="Info & pengaturan" />
      <PlanCard />
      <StravaCard />
      <Zones />
      <Safety />
      <GymGuide />
      <RaceDay />
      <DataTools />
      <ProfileForm />
      <About />
    </div>
  )
}

function Zones() {
  const { profile } = useData()
  const zones = karvonenZones(profile.restingHrBaseline, profile.maxHr)
  const age = ageOn(profile.birthDate, today())
  return (
    <Card title="Zona HR (Karvonen)">
      <p className="muted small">HR istirahat {profile.restingHrBaseline}, HR maks ~{profile.maxHr}. Batas lari easy: <b>≤{profile.easyCap}</b>. Cek silang MAF (180 − {age}{profile.medName ? ' − 10 karena obat' : ''}) = {mafHr(age, !!profile.medName)}.</p>
      <table className="zones">
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className={z.id}>
              <td><span className="zdot" aria-hidden />{z.name}</td>
              <td className="mono">{z.low}{z.high ? `–${z.high}` : '+'}</td>
              <td className="muted small">{z.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Safety() {
  const { profile } = useData()
  return (
    <Card title={profile.trackBp ? 'Aturan tensi (wajib)' : 'Aturan keamanan'}>
      {profile.trackBp && <table className="rules-t">
        <tbody>
          <tr><td><span className="badge lv-green">✓ &lt; 140/90</span></td><td>Latihan sesuai rencana.</td></tr>
          <tr><td><span className="badge lv-yellow">! 140–159 / 90–99</span></td><td>Boleh latihan, tapi jangan naikkan beban, tanpa strides, patuhi batas HR easy.</td></tr>
          <tr><td><span className="badge lv-red">✕ ≥ 160/100</span></td><td>Jangan latihan, jalan santai, ulang cek.</td></tr>
          <tr><td><span className="badge lv-critical">✕ ≥ 180/110</span></td><td>Jangan latihan, hubungi dokter.</td></tr>
        </tbody>
      </table>}
      <p className="small">HR istirahat naik &gt;7 bpm dari biasanya → ganti jadi jalan santai. Tidur 5–6 jam → gym 1–2 set, lari lebih pendek. Tidur &lt;5 jam → skip, jalan 20'.</p>
      <p className="small"><b>Napas saat angkat beban:</b> hembuskan saat fase berat, tarik saat turun. Jangan menahan napas / mengejan (Valsalva).</p>
      {profile.medName && <p className="small"><b>{profile.medName}:</b> waspada pusing saat berdiri tiba-tiba. Pendinginan bertahap. Jangan ubah dosis sendiri.</p>}
      <p className="small"><b>Berhenti & cari pertolongan:</b> {STOP_SIGNS.join('; ').toLowerCase()}.</p>
      <p className="muted small">Aplikasi ini alat bantu catatan, bukan pengganti dokter.</p>
    </Card>
  )
}

function GymGuide() {
  return (
    <Card title="Panduan gym">
      <ul className="small">{GYM_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="small">{WARMUP}<br />{COOLDOWN}</p>
      <div className="two">
        {(['A', 'B'] as const).map((w) => (
          <div key={w}>
            <h3>Gym {w}</h3>
            <ol className="small">{GYM[w].map((e) => <li key={e.name}>{e.name}, {e.prescription}</li>)}</ol>
          </div>
        ))}
      </div>
    </Card>
  )
}

function RaceDay() {
  const { profile } = useData()
  return (
    <Card title={`Strategi race ${formatDate(profile.raceDate)}`}>
      <ul className="small">{plan().raceTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    </Card>
  )
}

function PlanCard() {
  const { profile } = useData()
  const p = plan()
  const generated = profile.plan?.kind === 'generated'
  return (
    <Card title="Rencana latihan">
      <p className="small">
        <b>{profile.raceName}</b> · {formatDate(profile.raceDate)}. {p.weeks.length} minggu, mulai {formatDate(p.start)}.{' '}
        {generated ? 'Disusun otomatis dari jawabanmu.' : 'Rencana dari coach.'}
      </p>
      <a className="btn small" href={href('mulai')}>Susun ulang rencana</a>
      <p className="hint">Catatan lari, gym, dan harian tetap aman; hanya jadwal yang berubah.{generated ? '' : ' Rencana dari coach akan diganti rencana otomatis.'}</p>
    </Card>
  )
}

function DataTools() {
  const { runs, walks, daily, gym, refresh } = useData()
  const [msg, setMsg] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const summary = coachSummary({ runs, walks, daily, gym, until: today(), days: 7 })

  async function doExport() {
    await downloadBackup()
    await refresh()
    setMsg('File ekspor diunduh.')
  }

  async function doImport(file: File) {
    try {
      const res = await importAll(JSON.parse(await file.text()))
      await refresh()
      setMsg(`Impor selesai: ${res.runs} lari, ${res.daily} catatan harian, ${res.gym} gym, ${res.marks} tanda jadwal.`)
    } catch (e) {
      setMsg(`Gagal impor: ${(e as Error).message}`)
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary)
      setMsg('Ringkasan disalin. Tempel ke chat coach.')
    } catch {
      setMsg('Tidak bisa menyalin otomatis; pilih teks di bawah lalu salin manual.')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'Laporan latihan', text: summary })
    } catch { /* dibatalkan */ }
  }

  return (
    <Card title="Data & sinkron dengan coach">
      <p className="small">Semua data tersimpan di perangkat ini (IndexedDB), tetap jalan tanpa internet. Untuk dikirim ke coach: salin ringkasan 7 hari, atau ekspor file JSON lalu lampirkan di chat.</p>
      <div className="row wrap">
        <button className="btn primary" onClick={copySummary}>Salin ringkasan 7 hari</button>
        {'share' in navigator && <button className="btn" onClick={share}>Bagikan…</button>}
        <button className="btn" onClick={doExport}>Ekspor JSON</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Impor JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
      {msg && <p role="status" className="small">{msg}</p>}
      <details>
        <summary className="small">Pratinjau ringkasan</summary>
        <pre className="summary">{summary}</pre>
      </details>
      <div className="danger-zone">
        {confirmWipe ? (
          <>
            <span className="small">Hapus semua data di perangkat ini? Ekspor dulu kalau perlu.</span>
            <button className="btn danger" onClick={async () => { await wipeAll(); await refresh(); setConfirmWipe(false); setMsg('Semua data dihapus.') }}>Ya, hapus</button>
            <button className="btn ghost" onClick={() => setConfirmWipe(false)}>Batal</button>
          </>
        ) : (
          <button className="link danger" onClick={() => setConfirmWipe(true)}>Hapus semua data…</button>
        )}
      </div>
    </Card>
  )
}

function ProfileForm() {
  const { profile, refresh } = useData()
  const [f, setF] = useState({
    name: profile.name, birthDate: profile.birthDate, rest: String(profile.restingHrBaseline), max: String(profile.maxHr), cap: String(profile.easyCap),
    trackBp: profile.trackBp, medName: profile.medName ?? '',
  })
  const [ok, setOk] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setOk(false) }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await saveProfile({
      ...profile, name: f.name.trim() || profile.name, birthDate: f.birthDate || profile.birthDate,
      restingHrBaseline: num(f.rest) ?? profile.restingHrBaseline, maxHr: num(f.max) ?? profile.maxHr, easyCap: num(f.cap) ?? profile.easyCap,
      trackBp: f.trackBp, medName: f.medName.trim() || undefined,
    })
    await refresh()
    setOk(true)
  }
  return (
    <Card title="Profil">
      <form className="form" onSubmit={submit}>
        <div className="row3">
          <Field label="Nama"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Tanggal lahir"><input type="date" value={f.birthDate} onChange={set('birthDate')} /></Field>
        </div>
        <div className="row3">
          <Field label="HR istirahat normal"><input inputMode="numeric" value={f.rest} onChange={set('rest')} /></Field>
          <Field label="HR maks"><input inputMode="numeric" value={f.max} onChange={set('max')} /></Field>
          <Field label="Batas HR easy"><input inputMode="numeric" value={f.cap} onChange={set('cap')} /></Field>
        </div>
        <p className="hint">Ubah angka ini hanya setelah diskusi dengan coach/dokter. Zona HR dihitung ulang otomatis.</p>
        <label className="check"><input type="checkbox" checked={f.trackBp} onChange={set('trackBp')} /> Saya punya tensimeter (tampilkan input & grafik tensi)</label>
        <Field label="Obat tensi rutin (kosongkan kalau tidak ada)"><input value={f.medName} onChange={set('medName')} /></Field>
        <div className="row"><button className="btn primary">Simpan profil</button>{ok && <span role="status">✓ Tersimpan</span>}</div>
      </form>
    </Card>
  )
}

function About() {
  const { canInstall, install, installed } = useInstallPrompt()
  return (
    <Card title="Tentang aplikasi">
      <p className="small">PWA offline-first: bisa dipasang di layar utama tanpa Play Store / App Store. Rencana disusun dari jawaban onboarding, atau dari coach.</p>
      {installed ? <p className="small">✓ Sudah terpasang.</p> : canInstall ? (
        <button className="btn primary" onClick={install}>Pasang aplikasi</button>
      ) : (
        <p className="small muted">Pasang: Android/Chrome → menu ⋮ › Tambahkan ke layar utama. iPhone/Safari → Bagikan › Tambah ke Layar Utama.</p>
      )}
      <p className="muted small">Versi {__APP_VERSION__}</p>
    </Card>
  )
}
