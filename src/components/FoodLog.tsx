import { useEffect, useRef, useState } from 'react'
import { formatDate, today } from '../lib/date'
import { deleteFood, saveFood, uid } from '../lib/db'
import { analyzeFood, compressImage, getAiSettings, type AiFood, type AiSettings } from '../lib/foodAi'
import { dailyBalance, DEFICIT, favorites, FOODS, MEAL_LABEL, mealForHour, MEALS, portionText, scaleFood, searchFoods, type Balance, type FoodItem } from '../lib/nutrition'
import { href } from '../lib/router'
import { useData } from '../lib/store'
import type { FoodEntry, MealSlot } from '../lib/types'
import { Icon } from './icons'
import { Card, Field, num, Segmented } from './ui'

const fmt = (n: number) => Math.round(n).toLocaleString('id-ID')
const g = (n: number) => String(Math.round(n)).replace('.', ',')

export function useBalance(date: string): Balance {
  const data = useData()
  return dailyBalance(date, data)
}

/** Neraca kalori: masuk vs keluar dan sisa jatah makan hari itu. */
export function EnergySummary({ date, compact }: { date: string; compact?: boolean }) {
  const b = useBalance(date)
  const target = b.target
  const left = target != null ? target - b.in.kcal : undefined
  const pct = target ? Math.min(1, b.in.kcal / target) : 0
  const over = left != null && left < 0
  return (
    <div className="energy">
      <div className="energy-top">
        <div>
          <span className="stat-l">Masuk</span>
          <div className="energy-v"><span className="num">{fmt(b.in.kcal)}</span>{target != null && <small> / {fmt(target)} kkal</small>}{target == null && <small> kkal</small>}</div>
        </div>
        {left != null && (
          <div className={`energy-left ${over ? 'over' : ''}`}>
            <span className="num">{fmt(Math.abs(left))}</span>
            <small>{over ? 'kkal lewat target' : 'kkal sisa'}</small>
          </div>
        )}
      </div>
      {target != null && (
        <div className="energy-bar" role="img" aria-label={`${fmt(b.in.kcal)} dari ${fmt(target)} kkal`}>
          <div className={`energy-fill ${over ? 'over' : ''}`} style={{ width: `${pct * 100}%` }} />
        </div>
      )}
      {b.out ? (
        <p className="small muted">
          Keluar ±{fmt(b.out.total)} kkal: tubuh &amp; aktivitas harian {fmt(b.out.base)}{b.out.exercise > 0 && <> + olahraga {fmt(b.out.exercise)}{b.out.estimated ? ' (perkiraan)' : ''}</>}.
          {' '}Target = keluar − {DEFICIT} supaya turun ±0,5 kg/minggu.
        </p>
      ) : (
        <p className="small">Isi tinggi badan, jenis kelamin, dan berat di <a className="link" href={href('progres')}>Progres › Komposisi tubuh</a> supaya kalori keluar dan target bisa dihitung.</p>
      )}
      {!compact && (
        <div className="macros">
          <Macro label="Protein" v={b.in.proteinG} target={b.proteinTarget} />
          <Macro label="Karbo" v={b.in.carbsG} />
          <Macro label="Lemak" v={b.in.fatG} />
        </div>
      )}
    </div>
  )
}

function Macro({ label, v, target }: { label: string; v: number; target?: number }) {
  return (
    <div className="macro">
      <span className="stat-l">{label}</span>
      <span><b className="num">{g(v)}</b>{target ? <small> / {target} g</small> : <small> g</small>}</span>
    </div>
  )
}

/** Tab Catat › Makan. */
export function FoodSection({ params }: { params: URLSearchParams }) {
  const { foods, refresh } = useData()
  const [date, setDate] = useState(params.get('date') ?? today())
  const [meal, setMeal] = useState<MealSlot>(() => mealForHour(new Date().getHours()))
  const [msg, setMsg] = useState('')
  const dayFoods = foods.filter((f) => f.date === date)

  async function add(items: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt' | 'updatedAt'>[]) {
    const now = Date.now()
    for (const [i, it] of items.entries()) await saveFood({ ...it, id: uid(), date, meal, createdAt: now + i, updatedAt: now + i })
    await refresh()
    setMsg(`${items.length === 1 ? items[0].name : `${items.length} makanan`} masuk ke ${MEAL_LABEL[meal].toLowerCase()}.`)
  }

  return (
    <>
      <Card title={date === today() ? 'Makan hari ini' : `Makan ${formatDate(date, true)}`}>
        <Field label="Tanggal"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></Field>
        <EnergySummary date={date} />
        {!dayFoods.length && <p className="muted small">Belum ada makanan dicatat.</p>}
        {MEALS.map((m) => {
          const list = dayFoods.filter((f) => f.meal === m)
          if (!list.length) return null
          return (
            <div key={m} className="meal">
              <p className="meal-h"><span>{MEAL_LABEL[m]}</span><span className="num">{fmt(list.reduce((s, f) => s + f.kcal, 0))} kkal</span></p>
              <ul className="history">
                {list.map((f) => (
                  <li key={f.id}>
                    <div className="grow">
                      {f.name}{f.source === 'ai' && <span className="ai-tag" title="Perkiraan AI">AI</span>}
                      <div className="muted small">{[f.portion, `${fmt(f.kcal)} kkal`, f.proteinG != null && `P ${g(f.proteinG)} g`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button className="link danger" aria-label={`Hapus ${f.name}`} onClick={async () => { await deleteFood(f.id); await refresh() }}>Hapus</button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </Card>
      <Card title="Tambah makanan">
        <Field label="Untuk">
          <Segmented<MealSlot> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: m === 'camilan' ? 'Camilan' : m[0].toUpperCase() + m.slice(1) }))} />
        </Field>
        <p role="status" className="saved-msg">{msg && `✓ ${msg}`}</p>
        <AiPanel onSave={(items) => add(items.map((x) => ({ ...x, portion: x.portion || undefined, source: 'ai' as const })))} />
        <Favorites date={date} onPick={(f) => add([{ name: f.name, portion: f.portion, kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, source: 'manual' }])} />
        <FoodSearch onPick={(f, qty) => add([{ name: f.name, portion: portionText(f.portion, qty), ...scaleFood(f, qty), source: 'daftar' }])} />
        <ManualForm onSave={(x) => add([x])} />
      </Card>
    </>
  )
}

function Favorites({ date, onPick }: { date: string; onPick: (f: ReturnType<typeof favorites>[number]) => void }) {
  const { foods } = useData()
  const favs = favorites(foods, date)
  if (!favs.length) return null
  return (
    <div className="food-block">
      <p className="stat-l">Sering dimakan</p>
      <div className="chips">
        {favs.map((f) => (
          <button key={`${f.name}|${f.portion}`} type="button" className="pain-chip" onClick={() => onPick(f)} aria-label={`Tambah ${f.name}${f.portion ? `, ${f.portion}` : ''}, ${f.kcal} kkal`}>
            + {f.name} <small className="muted">{fmt(f.kcal)}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

const QTY = [0.5, 1, 1.5, 2]

function FoodSearch({ onPick }: { onPick: (f: FoodItem, qty: number) => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<FoodItem | null>(null)
  const [qty, setQty] = useState(1)
  const results = q.trim() ? searchFoods(q).slice(0, 8) : []
  return (
    <div className="food-block">
      <Field label="Cari di daftar makanan" hint={`${FOODS.length} makanan sehari-hari, angka perkiraan per porsi`}>
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setSel(null) }} placeholder="mis. nasi, tempe, kopi" />
      </Field>
      {q.trim() && !results.length && <p className="small muted">Tidak ada di daftar. Pakai foto AI atau isi sendiri.</p>}
      {!!results.length && (
        <ul className="food-results">
          {results.map((f) => (
            <li key={f.name}>
              <button type="button" className={sel === f ? 'on' : ''} aria-pressed={sel === f} onClick={() => { setSel(f); setQty(1) }}>
                <span className="grow">{f.name}<span className="muted small"> · {f.portion}</span></span>
                <span className="num small">{f.kcal}</span>
              </button>
              {sel === f && (
                <div className="food-qty">
                  <div className="seg" role="group" aria-label="Jumlah porsi">
                    {QTY.map((n) => <button key={n} type="button" className={n === qty ? 'on' : ''} aria-pressed={n === qty} onClick={() => setQty(n)}>{String(n).replace('.', ',')}×</button>)}
                  </div>
                  <button type="button" className="btn small primary" onClick={() => { onPick(f, qty); setQ(''); setSel(null) }}>Tambah {scaleFood(f, qty).kcal} kkal</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ManualForm({ onSave }: { onSave: (x: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'createdAt' | 'updatedAt'>) => Promise<void> }) {
  const empty = { name: '', portion: '', kcal: '', p: '', c: '', f: '' }
  const [f, setF] = useState(empty)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kcal = num(f.kcal)
    if (!f.name.trim()) return setErr('Isi nama makanan.')
    if (kcal == null || kcal < 0 || kcal > 5000) return setErr('Isi kalori (kkal), lihat label kemasan.')
    setErr('')
    await onSave({ name: f.name.trim(), portion: f.portion.trim() || undefined, kcal: Math.round(kcal), proteinG: num(f.p), carbsG: num(f.c), fatG: num(f.f), source: 'manual' })
    setF(empty)
  }
  return (
    <details className="food-block">
      <summary className="small">Isi sendiri (dari label kemasan)</summary>
      <form className="form" onSubmit={submit}>
        <div className="row2 even">
          <Field label="Nama"><input value={f.name} onChange={set('name')} placeholder="mis. Roti sobek" /></Field>
          <Field label="Porsi"><input value={f.portion} onChange={set('portion')} placeholder="mis. 2 potong" /></Field>
        </div>
        <div className="row2 even">
          <Field label="Kalori (kkal)"><input inputMode="numeric" value={f.kcal} onChange={set('kcal')} /></Field>
          <Field label="Protein (g)"><input inputMode="decimal" value={f.p} onChange={set('p')} /></Field>
        </div>
        <div className="row2 even">
          <Field label="Karbohidrat (g)"><input inputMode="decimal" value={f.c} onChange={set('c')} /></Field>
          <Field label="Lemak (g)"><input inputMode="decimal" value={f.f} onChange={set('f')} /></Field>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="row"><button className="btn">Tambah</button></div>
      </form>
    </details>
  )
}

type Draft = Omit<AiFood, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'> & { kcal: string; proteinG: string; carbsG: string; fatG: string }
const toDraft = (x: AiFood): Draft => ({ name: x.name, portion: x.portion, kcal: String(x.kcal), proteinG: String(x.proteinG).replace('.', ','), carbsG: String(x.carbsG).replace('.', ','), fatG: String(x.fatG).replace('.', ',') })

/** Foto atau tulis makanan, AI memperkirakan isinya, pengguna mengoreksi sebelum menyimpan. */
function AiPanel({ onSave }: { onSave: (items: AiFood[]) => Promise<void> }) {
  const [settings, setSettings] = useState<AiSettings | undefined | null>(null)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<{ url: string; file: File } | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyMsg, setBusyMsg] = useState('')
  const [err, setErr] = useState('')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [note, setNote] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getAiSettings().then(setSettings) }, [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  if (settings === null) return null
  if (!settings) {
    return (
      <div className="food-block ai-setup">
        <p className="small"><Icon name="spark" size={16} /> <b>Foto makanan, AI yang menghitung.</b> Pasang API key Gemini gratis sekali saja di <a className="link" href={href('info')}>Info › Analisa foto makanan</a>.</p>
      </div>
    )
  }

  async function run() {
    setBusy(true); setBusyMsg(''); setErr(''); setNote('')
    try {
      const image = photo ? await compressImage(photo.file) : undefined
      const res = await analyzeFood(settings!, { image, text }, { onStatus: setBusyMsg })
      if (!res.items.length) throw new Error('AI tidak menemukan makanan. Coba foto lebih dekat atau tulis makanannya.')
      setDrafts(res.items.map(toDraft))
      setNote(res.note ?? '')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setDrafts(null); setText(''); setPhoto(null); setNote(''); setErr('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    const items = drafts!.filter((d) => d.name.trim()).map((d) => ({
      name: d.name.trim(), portion: d.portion.trim(), kcal: Math.round(num(d.kcal) ?? 0),
      proteinG: num(d.proteinG) ?? 0, carbsG: num(d.carbsG) ?? 0, fatG: num(d.fatG) ?? 0,
    }))
    if (!items.length) return setErr('Tidak ada item untuk disimpan.')
    await onSave(items)
    reset()
  }

  const upd = (i: number, k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDrafts(drafts!.map((d, j) => (j === i ? { ...d, [k]: e.target.value } : d)))
  const total = drafts?.reduce((s, d) => s + (num(d.kcal) ?? 0), 0) ?? 0

  return (
    <div className="food-block ai-panel">
      {!drafts ? (
        <>
          <div className="ai-row">
            <button type="button" className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="camera" size={18} /> {photo ? 'Ganti foto' : 'Foto makanan'}
            </button>
            {photo && <img src={photo.url} alt="Foto makanan yang dipilih" className="ai-thumb" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden aria-label="Pilih foto makanan"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) setPhoto({ url: URL.createObjectURL(file), file }) }} />
          <Field label={photo ? 'Keterangan (opsional)' : 'Atau tulis yang kamu makan'} hint={photo ? 'Membantu AI, mis. "nasi setengah, ayam pop"' : 'mis. "nasi padang rendang + sayur nangka, es teh manis"'}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={photo ? 'nasi ½ porsi, sambal hijau' : 'nasi goreng + telur ceplok'} />
          </Field>
          <div className="row">
            <button type="button" className="btn" onClick={run} disabled={busy || (!photo && !text.trim())}>
              <Icon name="spark" size={16} /> {busy ? busyMsg || 'AI sedang menghitung…' : 'Hitung dengan AI'}
            </button>
            {(photo || text) && !busy && <button type="button" className="link" onClick={reset}>Batal</button>}
          </div>
        </>
      ) : (
        <>
          <p className="stat-l">Hasil AI · cek dan koreksi dulu</p>
          {note && <p className="flag"><Icon name="alert" size={16} /> {note}</p>}
          <ul className="ai-items">
            {drafts.map((d, i) => (
              <li key={i}>
                <div className="row2 even">
                  <Field label="Nama"><input value={d.name} onChange={upd(i, 'name')} /></Field>
                  <Field label="Porsi"><input value={d.portion} onChange={upd(i, 'portion')} /></Field>
                </div>
                <div className="ai-nums">
                  <Field label="kkal"><input inputMode="numeric" value={d.kcal} onChange={upd(i, 'kcal')} /></Field>
                  <Field label="Protein"><input inputMode="decimal" value={d.proteinG} onChange={upd(i, 'proteinG')} /></Field>
                  <Field label="Karbo"><input inputMode="decimal" value={d.carbsG} onChange={upd(i, 'carbsG')} /></Field>
                  <Field label="Lemak"><input inputMode="decimal" value={d.fatG} onChange={upd(i, 'fatG')} /></Field>
                </div>
                <button type="button" className="link small danger" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>Buang item ini</button>
              </li>
            ))}
          </ul>
          <p className="hint">Foto AI bisa meleset 15–25%, terutama minyak dan ukuran porsi. Kalau tahu porsinya, perbaiki angkanya.</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={save} disabled={!drafts.length}>Simpan {drafts.length} item · {fmt(total)} kkal</button>
            <button type="button" className="link" onClick={reset}>Batal</button>
          </div>
        </>
      )}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  )
}
