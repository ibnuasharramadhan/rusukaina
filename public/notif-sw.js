// Diimpor oleh service worker Workbox (lihat vite.config.ts, workbox.importScripts).
// Menampilkan jadwal latihan hari ini; data ditulis aplikasi lewat src/lib/notify.ts.
const NOTIF_CACHE = 'rusukaina-notif'
const NOTIF_FILE = 'jadwal.json'
const NOTIF_TAG = 'jadwal-hari-ini'

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function showToday() {
  const cache = await caches.open(NOTIF_CACHE)
  const res = await cache.match(NOTIF_FILE)
  if (!res) return
  const data = await res.json()
  const now = new Date()
  const today = localDate(now)
  if (!data.enabled || data.lastShown === today || now.getHours() < (data.fromHour ?? 5)) return
  const entry = data.sessions && data.sessions[today]
  if (!entry) return
  await self.registration.showNotification(entry.title, { body: entry.body, tag: NOTIF_TAG, icon: 'pwa-192.png', badge: 'pwa-192.png' })
  await cache.put(NOTIF_FILE, new Response(JSON.stringify({ ...data, lastShown: today }), { headers: { 'content-type': 'application/json' } }))
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === NOTIF_TAG) event.waitUntil(showToday())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.length) return wins[0].focus()
    return self.clients.openWindow(self.registration.scope)
  })())
})
