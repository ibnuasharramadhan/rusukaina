import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { renderShareCard, shareFileName } from '../lib/shareCard'
import { useData } from '../lib/store'
import type { RunLog } from '../lib/types'
import { Icon } from './icons'

/** Pratinjau kartu share + tombol bagikan (Web Share dengan file) atau unduh. */
export function ShareSheet({ run, onClose }: { run: RunLog; onClose: () => void }) {
  const { profile } = useData()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let u = ''
    renderShareCard(run, profile).then((b) => { setBlob(b); u = URL.createObjectURL(b); setUrl(u) }, (e) => setErr((e as Error).message))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [run, profile])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const file = blob && new File([blob], shareFileName(run), { type: 'image/png' })
  const canShareFile = !!file && !!navigator.canShare?.({ files: [file] })

  async function share() {
    if (!file) return
    try { await navigator.share({ files: [file] }) } catch { /* dibatalkan */ }
  }
  function download() {
    const a = Object.assign(document.createElement('a'), { href: url, download: shareFileName(run) })
    a.click()
  }

  // Portal ke body: halaman punya stacking context sendiri (animasi), jadi lembar
  // ini harus di luar supaya berada di atas tab bar.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Bagikan hasil" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <b>Bagikan hasil</b>
          <button className="link" onClick={onClose}>Tutup</button>
        </div>
        <div className="share-preview">
          {url ? <img src={url} alt="Kartu ringkasan lari" /> : <p className="muted small">{err || 'Menyiapkan gambar…'}</p>}
        </div>
        <div className="row">
          {canShareFile && <button className="btn primary grow" onClick={share}><Icon name="share" size={18} /> Bagikan</button>}
          <button className={`btn grow ${canShareFile ? '' : 'primary'}`} disabled={!url} onClick={download}><Icon name="download" size={18} /> Unduh</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
