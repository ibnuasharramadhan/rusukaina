import { useState } from 'react'
import { shoeKm, shoeState } from '../lib/body'
import { deleteShoe, saveShoe, uid } from '../lib/db'
import { useData } from '../lib/store'
import { Card, Field, num } from './ui'

const km = (n: number) => String(n).replace('.', ',')
const STATE_LABEL = { ok: '', soon: 'Hampir waktunya ganti', replace: 'Sudah waktunya ganti' }

/** Daftar sepatu: km tiap sepatu dari lari yang memakainya, dengan pengingat ganti. */
export function ShoesCard() {
  const { shoes, runs, walks, refresh } = useData()
  const all = [...runs, ...walks]
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', startKm: '', limitKm: '700' })
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) return setErr('Isi nama sepatu.')
    const limit = num(f.limitKm) ?? 700
    if (limit < 100 || limit > 2000) return setErr('Batas ganti biasanya 500–800 km.')
    const now = Date.now()
    await saveShoe({ id: uid(), name: f.name.trim(), startKm: num(f.startKm) ?? 0, limitKm: limit, createdAt: now, updatedAt: now })
    await refresh()
    setF({ name: '', startKm: '', limitKm: '700' })
    setErr('')
    setAdding(false)
  }

  const sorted = [...shoes].sort((a, b) => Number(!!a.retired) - Number(!!b.retired) || a.createdAt - b.createdAt)
  return (
    <Card title="Sepatu" action={!adding ? <button className="link small" onClick={() => setAdding(true)}>Tambah</button> : undefined}>
      {!shoes.length && !adding && <p className="small muted">Catat sepatu larimu supaya tahu kapan harus ganti. Sepatu lari umumnya diganti setelah 500–800 km. Setelah ditambahkan, pilih sepatunya saat mencatat lari.</p>}
      <ul className="shoes">
        {sorted.map((s) => {
          const total = shoeKm(s, all)
          const st = shoeState(total, s.limitKm)
          return (
            <li key={s.id} className={`${s.retired ? 'retired' : ''} ${st}`}>
              <div className="shoe-top">
                <b>{s.name}</b>
                <span className="num">{km(total)} <small>/ {s.limitKm} km</small></span>
              </div>
              <div className="shoe-bar"><i style={{ width: `${Math.min(100, (total / s.limitKm) * 100)}%` }} /></div>
              <div className="shoe-foot small">
                <span className={st === 'ok' ? 'muted' : 'warn'}>{s.retired ? 'Pensiun' : STATE_LABEL[st]}</span>
                <span className="grow" />
                <button className="link small" onClick={async () => { await saveShoe({ ...s, retired: !s.retired, updatedAt: Date.now() }); await refresh() }}>{s.retired ? 'Aktifkan' : 'Pensiunkan'}</button>
                {confirmDel === s.id
                  ? <button className="link small danger" onClick={async () => { await deleteShoe(s.id); await refresh(); setConfirmDel('') }}>Yakin hapus?</button>
                  : <button className="link small danger" onClick={() => setConfirmDel(s.id)}>Hapus</button>}
              </div>
            </li>
          )
        })}
      </ul>
      {adding && (
        <form className="form" onSubmit={add}>
          <Field label="Nama sepatu"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mis. Ortuseight Hyperblast" autoFocus /></Field>
          <div className="row2">
            <Field label="Sudah dipakai (km)" hint="Perkiraan, kalau sepatu lama"><input inputMode="decimal" value={f.startKm} onChange={(e) => setF({ ...f, startKm: e.target.value })} placeholder="0" /></Field>
            <Field label="Ganti setelah (km)"><input inputMode="numeric" value={f.limitKm} onChange={(e) => setF({ ...f, limitKm: e.target.value })} /></Field>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="row">
            <button className="btn primary" type="submit">Simpan</button>
            <button className="btn ghost" type="button" onClick={() => { setAdding(false); setErr('') }}>Batal</button>
          </div>
        </form>
      )}
    </Card>
  )
}
