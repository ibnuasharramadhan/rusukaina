import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Service worker: tampilkan toast saat siap offline atau ada versi baru. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW()
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])
  if (!needRefresh && !offlineReady) return null
  return (
    <div className="toast" role="status">
      <span>{needRefresh ? 'Versi baru tersedia.' : 'Siap dipakai offline.'}</span>
      {needRefresh && <button className="btn small primary" onClick={() => updateServiceWorker(true)}>Muat ulang</button>}
      <button className="btn small ghost" onClick={() => { setNeedRefresh(false); setOfflineReady(false) }}>Tutup</button>
    </div>
  )
}
