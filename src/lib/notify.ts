// Notifikasi jadwal latihan hari ini, tanpa server.
// Aplikasi menyimpan jadwal beberapa minggu ke depan di Cache Storage; service worker
// (public/notif-sw.js) dibangunkan browser lewat Periodic Background Sync kira-kira
// sekali sehari, lalu menampilkan sesi hari itu. Jamnya ditentukan browser, bukan kita.

import { addDays, type ISODate } from './date'
import type { PlannedSession } from './types'

export const NOTIF_CACHE = 'rusukaina-notif'
export const NOTIF_FILE = 'jadwal.json'
export const NOTIF_TAG = 'jadwal-hari-ini'
/** Notifikasi tidak dikirim sebelum jam ini (waktu HP). */
export const NOTIF_FROM_HOUR = 5

export interface NotifEntry { title: string; body: string }
export interface NotifData {
  enabled: boolean
  fromHour: number
  sessions: Record<ISODate, NotifEntry>
  /** Diisi service worker: tanggal terakhir notifikasi dikirim. */
  lastShown?: ISODate
}

export function notifText(s: PlannedSession): NotifEntry {
  if (s.kind === 'rest') return { title: 'Hari ini libur', body: 'Istirahat juga bagian dari latihan.' }
  const parts = [s.detail ?? (s.minutes ? `${s.minutes} menit.` : ''), 'Isi cek pagi dulu di Rusukaina.'].filter(Boolean)
  return { title: `Hari ini: ${s.title}`, body: parts.join(' ') }
}

/** Jadwal `days` hari mulai `from`, dalam bentuk siap tampil. */
export function notifSessions(schedule: PlannedSession[], from: ISODate, days = 42): Record<ISODate, NotifEntry> {
  const until = addDays(from, days - 1)
  const out: Record<ISODate, NotifEntry> = {}
  for (const s of schedule) if (s.date >= from && s.date <= until) out[s.date] = notifText(s)
  return out
}

type PeriodicSyncReg = ServiceWorkerRegistration & {
  periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void>; unregister: (tag: string) => Promise<void> }
}

export type NotifSupport = 'ok' | 'no-notification' | 'no-periodic-sync'

export async function notifSupport(): Promise<NotifSupport> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'no-notification'
  const reg = (await navigator.serviceWorker.getRegistration()) as PeriodicSyncReg | undefined
  return reg?.periodicSync ? 'ok' : 'no-periodic-sync'
}

async function readData(): Promise<NotifData | undefined> {
  if (typeof caches === 'undefined') return undefined
  const res = await (await caches.open(NOTIF_CACHE)).match(NOTIF_FILE)
  return res ? ((await res.json()) as NotifData) : undefined
}

async function writeData(d: NotifData) {
  if (typeof caches === 'undefined') return
  await (await caches.open(NOTIF_CACHE)).put(NOTIF_FILE, new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } }))
}

export async function notifEnabled(): Promise<boolean> {
  return !!(await readData())?.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/** Dipanggil tiap aplikasi dibuka: perbarui jadwal yang dibaca service worker. */
export async function syncNotifSchedule(schedule: PlannedSession[], today: ISODate) {
  const d = await readData()
  if (!d?.enabled) return
  await writeData({ ...d, sessions: notifSessions(schedule, today) })
}

export async function enableNotif(schedule: PlannedSession[], today: ISODate): Promise<string | null> {
  if ((await notifSupport()) === 'no-notification') return 'Browser ini tidak mendukung notifikasi.'
  if ((await Notification.requestPermission()) !== 'granted') return 'Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.'
  const reg = (await navigator.serviceWorker.ready) as PeriodicSyncReg
  if (!reg.periodicSync) return 'Browser ini belum mendukung pengingat di latar belakang (Periodic Background Sync).'
  try {
    await reg.periodicSync.register(NOTIF_TAG, { minInterval: 12 * 60 * 60 * 1000 })
  } catch {
    return 'Browser menolak pengingat latar belakang. Pastikan Rusukaina dipasang ke layar utama, lalu coba lagi.'
  }
  const prev = await readData()
  await writeData({ enabled: true, fromHour: NOTIF_FROM_HOUR, sessions: notifSessions(schedule, today), lastShown: prev?.lastShown })
  return null
}

export async function disableNotif() {
  const d = await readData()
  if (d) await writeData({ ...d, enabled: false })
  const reg = (await navigator.serviceWorker.getRegistration()) as PeriodicSyncReg | undefined
  await reg?.periodicSync?.unregister(NOTIF_TAG).catch(() => {})
}

/** Tampilkan notifikasi hari ini sekarang, untuk mengecek izin dan tampilannya. */
export async function showTestNotif(s: PlannedSession | undefined) {
  const reg = await navigator.serviceWorker.ready
  const n = s ? notifText(s) : { title: 'Rusukaina', body: 'Tidak ada sesi hari ini.' }
  await reg.showNotification(n.title, { body: n.body, tag: NOTIF_TAG, icon: 'pwa-192.png', badge: 'pwa-192.png' })
}
