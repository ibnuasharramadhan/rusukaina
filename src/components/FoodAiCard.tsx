import { useEffect, useState } from 'react'
import { DEFAULT_MODEL, getAiSettings, KEY_URL, saveAiSettings, type AiSettings } from '../lib/foodAi'
import { Card, Field } from './ui'

/** Pengaturan API key Gemini untuk analisa foto makanan. */
export function FoodAiCard() {
  const [cur, setCur] = useState<AiSettings | undefined | null>(null)
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { getAiSettings().then((s) => { setCur(s); setModel(s?.model && s.model !== DEFAULT_MODEL ? s.model : '') }) }, [])
  if (cur === null) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const k = key.trim() || cur?.key
    if (!k) return setMsg('Tempel API key dulu.')
    const s = { key: k, model: model.trim() || DEFAULT_MODEL }
    await saveAiSettings(s)
    setCur(s); setKey(''); setMsg('Tersimpan. Coba di Catat › Makan › Foto makanan.')
  }
  async function remove() {
    await saveAiSettings(null)
    setCur(undefined); setMsg('API key dihapus dari HP ini.')
  }

  return (
    <Card title="Analisa foto makanan (AI)">
      <p className="small">Foto makanan, lalu Gemini dari Google memperkirakan kalori, protein, karbo, dan lemaknya. Gratis dengan API key milikmu sendiri.</p>
      <ol className="small ai-steps">
        <li>Buka <a className="link" href={KEY_URL} target="_blank" rel="noreferrer">Google AI Studio</a>, masuk dengan akun Google.</li>
        <li>Ketuk <b>Create API key</b>, lalu salin key-nya.</li>
        <li>Tempel di bawah, simpan.</li>
      </ol>
      <form className="form" onSubmit={save}>
        <Field label="API key Gemini" hint={cur ? `Terpasang: …${cur.key.slice(-4)}. Kosongkan bila tidak ingin mengganti.` : undefined}>
          <input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setMsg('') }} placeholder={cur ? '••••••••' : 'AIza…'} />
        </Field>
        <details>
          <summary className="small">Lanjutan</summary>
          <Field label="Model" hint={`Kosong = ${DEFAULT_MODEL}`}><input value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODEL} /></Field>
        </details>
        <div className="row">
          <button className="btn primary">Simpan</button>
          {cur && <button type="button" className="link danger" onClick={remove}>Hapus key</button>}
        </div>
        <p role="status" className="small saved-msg">{msg}</p>
      </form>
      <p className="hint">Key hanya disimpan di HP ini dan tidak ikut file cadangan. Foto dikirim langsung ke Google; di paket gratis Google boleh memakai data untuk melatih modelnya, jadi kirim foto makanan saja. Kuota gratis cukup untuk puluhan foto per hari.</p>
    </Card>
  )
}
