// Sinkron lari dari Strava. Huawei Health bisa sinkron otomatis ke Strava,
// jadi Strava dipakai sebagai jembatan (Huawei Health Kit tidak bisa dipakai PWA).
//
// Alur OAuth: PWA → strava.com/oauth/authorize → kembali dengan ?code= →
// Worker (worker/index.js) menukar code jadi token memakai client_secret →
// token disimpan di IndexedDB perangkat ini. Panggilan API berikutnya langsung
// dari browser ke api.strava.com.

import { plan } from '../data/plan'
import { fromISO } from './date'
import { db, saveRun } from './db'
import { formatPace } from './pace'
import type { RunLog, RunType } from './types'

const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined
const TOKEN_URL = import.meta.env.VITE_STRAVA_TOKEN_URL as string | undefined
const API = 'https://www.strava.com/api/v3'
const STATE_KEY = 'strava-oauth-state'

export const stravaConfigured = !!(CLIENT_ID && TOKEN_URL)

export interface StravaAuth {
  accessToken: string
  refreshToken: string
  /** Detik epoch. */
  expiresAt: number
  athleteName?: string
  /** Detik epoch aktivitas terakhir yang sudah diambil. */
  lastSyncAt?: number
}

/** Bagian aktivitas Strava yang kita pakai (lihat GET /athlete/activities). */
export interface StravaActivity {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  start_date_local: string
  distance: number
  moving_time: number
  elapsed_time: number
  trainer?: boolean
  workout_type?: number | null
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  splits_metric?: { distance: number; moving_time: number }[]
}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun'])

export function isRun(a: StravaActivity): boolean {
  return RUN_TYPES.has(a.sport_type ?? a.type ?? '')
}

function formatSplits(splits: StravaActivity['splits_metric']): string | undefined {
  if (!splits?.length) return undefined
  const parts: string[] = []
  for (const s of splits) {
    if (s.distance >= 950) parts.push(formatPace(s.moving_time / (s.distance / 1000)))
    else if (s.distance > 20) parts.push(`sisa ${(s.distance / 1000).toFixed(2).replace('.', ',')} km ${formatPace(s.moving_time)}`)
  }
  return parts.join(', ') || undefined
}

/** Aktivitas Strava → RunLog aplikasi. Murni, supaya mudah dites. */
export function toRunLog(a: StravaActivity, now = Date.now()): RunLog {
  // start_date_local berformat "2026-10-05T18:08:00Z" tapi nilainya waktu lokal.
  const date = a.start_date_local.slice(0, 10)
  const time = a.start_date_local.slice(11, 16)
  const type: RunType = a.workout_type === 1 ? 'race' : a.trainer || a.sport_type === 'VirtualRun' ? 'treadmill' : 'outdoor'
  const round = (n?: number) => (n ? Math.round(n) : undefined)
  return {
    id: `strava-${a.id}`,
    date,
    time,
    type,
    distanceKm: Math.round(a.distance / 10) / 100,
    durationSec: a.moving_time || a.elapsed_time,
    avgHr: round(a.average_heartrate),
    maxHr: round(a.max_heartrate),
    // Strava menghitung cadence lari per satu kaki; dikali 2 jadi langkah/menit.
    cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : undefined,
    splits: formatSplits(a.splits_metric),
    notes: `Strava: ${a.name}`,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Lari yang sudah dicatat manual / lewat impor di hari yang sama dengan jarak
 * hampir sama dianggap duplikat, supaya tidak tercatat dua kali.
 */
export function isDuplicate(r: RunLog, existing: RunLog[]): boolean {
  return existing.some((e) => e.id === r.id || (e.date === r.date && Math.abs(e.distanceKm - r.distanceKm) <= 0.1))
}

// --- Penyimpanan token

export async function getStravaAuth(): Promise<StravaAuth | undefined> {
  return (await (await db()).get('meta', 'strava')) as StravaAuth | undefined
}
async function saveAuth(a: StravaAuth) {
  await (await db()).put('meta', a, 'strava')
}
export async function disconnectStrava() {
  await (await db()).delete('meta', 'strava')
}

// --- OAuth

function redirectUri() {
  return location.origin + location.pathname
}

export function connectStrava() {
  if (!stravaConfigured) return
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const q = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri(),
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  })
  location.href = `https://www.strava.com/oauth/authorize?${q}`
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Server token membalas ${res.status}`)
  return data as { access_token: string; refresh_token: string; expires_at: number; athlete?: { firstname?: string } }
}

/**
 * Dipanggil sekali saat aplikasi dibuka. Kalau URL berisi ?code= dari Strava,
 * tukar jadi token lalu bersihkan URL. Mengembalikan pesan untuk ditampilkan.
 */
export async function handleStravaRedirect(): Promise<string | null> {
  const q = new URLSearchParams(location.search)
  if (!q.has('code') && !q.has('error')) return null
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  history.replaceState(null, '', `${location.pathname}#/info`)
  // replaceState tidak memicu hashchange; router perlu tahu supaya pindah ke Info.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  if (q.get('error')) return 'Strava tidak jadi dihubungkan.'
  if (!expected || q.get('state') !== expected) return 'Gagal menghubungkan Strava: sesi login tidak cocok, coba lagi.'
  if (!q.get('scope')?.includes('activity:read')) return 'Izin "lihat aktivitas" perlu dicentang di halaman Strava. Coba hubungkan lagi.'
  try {
    const t = await tokenRequest({ code: q.get('code')! })
    await saveAuth({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, athleteName: t.athlete?.firstname })
    return 'Strava terhubung.'
  } catch (e) {
    return `Gagal menghubungkan Strava: ${(e as Error).message}`
  }
}

async function accessToken(auth: StravaAuth): Promise<StravaAuth> {
  if (auth.expiresAt - 120 > Date.now() / 1000) return auth
  const t = await tokenRequest({ refresh_token: auth.refreshToken })
  const next = { ...auth, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at }
  await saveAuth(next)
  return next
}

async function api<T>(auth: StravaAuth, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
  if (res.status === 401) throw new Error('Akses Strava kedaluwarsa. Putuskan lalu hubungkan lagi.')
  if (res.status === 429) throw new Error('Batas permintaan Strava tercapai. Coba lagi 15 menit lagi.')
  if (!res.ok) throw new Error(`Strava membalas ${res.status}`)
  return res.json() as Promise<T>
}

export interface SyncResult { added: number; skipped: number }

/** Ambil lari baru sejak sinkron terakhir (atau sejak awal program). */
export async function syncStrava(existing: RunLog[]): Promise<SyncResult> {
  let auth = await getStravaAuth()
  if (!auth) throw new Error('Strava belum terhubung.')
  auth = await accessToken(auth)

  // Mundur 2 hari dari sinkron terakhir supaya aktivitas yang telat sinkron dari Huawei tetap terambil.
  const after = auth.lastSyncAt ? auth.lastSyncAt - 2 * 86400 : Math.floor(fromISO(plan().start).getTime() / 1000)
  const activities: StravaActivity[] = []
  for (let page = 1; page <= 5; page++) {
    const batch = await api<StravaActivity[]>(auth, `/athlete/activities?after=${after}&per_page=100&page=${page}`)
    activities.push(...batch)
    if (batch.length < 100) break
  }

  const known = [...existing]
  const res: SyncResult = { added: 0, skipped: 0 }
  let newest = auth.lastSyncAt ?? after
  for (const a of activities.filter(isRun)) {
    newest = Math.max(newest, Math.floor(new Date(a.start_date).getTime() / 1000))
    const draft = toRunLog(a)
    if (isDuplicate(draft, known)) {
      res.skipped++
      continue
    }
    // Detail aktivitas berisi split per km.
    const detail = await api<StravaActivity>(auth, `/activities/${a.id}`).catch(() => a)
    const run = toRunLog({ ...a, splits_metric: detail.splits_metric })
    await saveRun(run)
    known.push(run)
    res.added++
  }
  await saveAuth({ ...auth, lastSyncAt: newest })
  return res
}
