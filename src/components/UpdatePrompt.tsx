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
      {needRefresh && <button className="btn small primary" onClick={() => reloadToNewVersion(updateServiceWorker)}>Muat ulang</button>}
      <button className="btn small ghost" onClick={() => { setNeedRefresh(false); setOfflineReady(false) }}>Tutup</button>
    </div>
  )
}

/**
 * Workbox hanya me-reload halaman yang sudah dikontrol service worker. Halaman yang
 * dibuka pertama kali setelah instal belum dikontrol, jadi tombol tidak bereaksi.
 * Di sini reload dilakukan sendiri setelah versi baru aktif (atau paling lambat 3 detik).
 */
async function reloadToNewVersion(update: (reload?: boolean) => Promise<void>) {
  let done = false
  const reload = () => { if (!done) { done = true; window.location.reload() } }
  const waiting = (await navigator.serviceWorker?.getRegistration())?.waiting
  waiting?.addEventListener('statechange', () => { if (waiting.state === 'activated') reload() })
  setTimeout(reload, 3000)
  await update(true)
}
