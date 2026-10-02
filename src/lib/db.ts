import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DEFAULT_PROFILE } from '../data/plan'
import type { DailyLog, ExportFile, GymLog, Profile, RunLog, SessionMark } from './types'

interface LatihanDB extends DBSchema {
  runs: { key: string; value: RunLog; indexes: { date: string } }
  daily: { key: string; value: DailyLog }
  gym: { key: string; value: GymLog; indexes: { date: string } }
  marks: { key: string; value: SessionMark }
  meta: { key: string; value: unknown }
}

const DB_NAME = 'latihan'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<LatihanDB>> | null = null

export function db() {
  dbPromise ??= openDB<LatihanDB>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('runs', { keyPath: 'id' }).createIndex('date', 'date')
      d.createObjectStore('daily', { keyPath: 'date' })
      d.createObjectStore('gym', { keyPath: 'id' }).createIndex('date', 'date')
      d.createObjectStore('marks', { keyPath: 'date' })
      d.createObjectStore('meta')
    },
  })
  return dbPromise
}

/** Hanya untuk tes: tutup koneksi supaya DB baru bisa dibuka. */
export async function resetConnection() {
  if (dbPromise) (await dbPromise).close()
  dbPromise = null
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date)

// --- Runs
export async function listRuns(): Promise<RunLog[]> {
  return (await (await db()).getAll('runs')).sort(byDate)
}
export async function saveRun(r: RunLog) {
  await (await db()).put('runs', { ...r, updatedAt: Date.now() })
}
export async function deleteRun(id: string) {
  await (await db()).delete('runs', id)
}

// --- Daily (tensi, HR istirahat, tidur)
export async function listDaily(): Promise<DailyLog[]> {
  return (await (await db()).getAll('daily')).sort(byDate)
}
export async function getDaily(date: string) {
  return (await db()).get('daily', date)
}
export async function saveDaily(d: DailyLog) {
  await (await db()).put('daily', { ...d, updatedAt: Date.now() })
}
export async function deleteDaily(date: string) {
  await (await db()).delete('daily', date)
}

// --- Gym
export async function listGym(): Promise<GymLog[]> {
  return (await (await db()).getAll('gym')).sort(byDate)
}
export async function saveGym(g: GymLog) {
  await (await db()).put('gym', { ...g, updatedAt: Date.now() })
}
export async function deleteGym(id: string) {
  await (await db()).delete('gym', id)
}

// --- Tanda selesai/skip di jadwal
export async function listMarks(): Promise<SessionMark[]> {
  return (await db()).getAll('marks')
}
export async function setMark(m: SessionMark | { date: string; status: null }) {
  const d = await db()
  if (m.status === null) await d.delete('marks', m.date)
  else await d.put('marks', { ...m, updatedAt: Date.now() })
}

// --- Profil
export async function getProfile(): Promise<Profile> {
  const p = (await (await db()).get('meta', 'profile')) as Partial<Profile> | undefined
  return { ...DEFAULT_PROFILE, ...p }
}
export async function saveProfile(p: Profile) {
  await (await db()).put('meta', p, 'profile')
}

// --- Cadangan: kapan terakhir ekspor, untuk pengingat di layar Hari ini.
export async function getLastExportAt(): Promise<number | undefined> {
  return (await (await db()).get('meta', 'lastExportAt')) as number | undefined
}
export async function markExported(at = Date.now()) {
  await (await db()).put('meta', at, 'lastExportAt')
}

// --- Data awal: lari 1 Okt dan tensi 29 Sep dari catatan coach.
export async function seedIfEmpty() {
  const d = await db()
  if (await d.get('meta', 'seeded')) return
  const now = Date.now()
  const tx = d.transaction(['runs', 'daily', 'meta'], 'readwrite')
  await tx.objectStore('runs').put({
    id: 'seed-2026-10-01', date: '2026-10-01', time: '17:42', type: 'treadmill',
    distanceKm: 5.15, durationSec: 36 * 60 + 2, avgHr: 148, maxHr: 159, cadence: 163,
    splits: '7:16, 6:46, 7:01, 6:56, 7:01',
    notes: 'Lari treadmill pertama. HR stabil, tapi ±25 menit di atas 145.',
    createdAt: now, updatedAt: now,
  })
  await tx.objectStore('daily').put({ date: '2026-09-29', restingHr: 58, sys: 148, dia: 83, medTaken: true, updatedAt: now })
  await tx.objectStore('meta').put(true, 'seeded')
  await tx.done
}

// --- Ekspor / impor
export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'pwa-latihan',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: await getProfile(),
    runs: await listRuns(),
    daily: await listDaily(),
    gym: await listGym(),
    marks: await listMarks(),
  }
}

export interface ImportResult { runs: number; daily: number; gym: number; marks: number }

export function validateExport(x: unknown): ExportFile {
  const f = x as Partial<ExportFile>
  if (!f || f.app !== 'pwa-latihan') throw new Error('Bukan file ekspor aplikasi ini.')
  if (f.schemaVersion !== 1) throw new Error(`Versi skema ${String(f.schemaVersion)} belum didukung.`)
  for (const k of ['runs', 'daily', 'gym', 'marks'] as const) {
    if (!Array.isArray(f[k])) throw new Error(`Bagian "${k}" tidak valid.`)
  }
  return f as ExportFile
}

/**
 * Impor = gabung (upsert). Entri dengan id/tanggal sama diambil yang
 * updatedAt-nya lebih baru, jadi impor berulang aman.
 */
export async function importAll(raw: unknown, opts: { includeProfile?: boolean } = {}): Promise<ImportResult> {
  const f = validateExport(raw)
  const d = await db()
  const res: ImportResult = { runs: 0, daily: 0, gym: 0, marks: 0 }
  const tx = d.transaction(['runs', 'daily', 'gym', 'marks', 'meta'], 'readwrite')

  async function merge<S extends 'runs' | 'daily' | 'gym' | 'marks'>(store: S, items: LatihanDB[S]['value'][], key: (v: LatihanDB[S]['value']) => string) {
    const os = tx.objectStore(store)
    for (const item of items) {
      const existing = await os.get(key(item))
      if (!existing || (existing.updatedAt ?? 0) <= (item.updatedAt ?? 0)) {
        await os.put(item)
        res[store]++
      }
    }
  }

  await merge('runs', f.runs, (v) => v.id)
  await merge('daily', f.daily, (v) => v.date)
  await merge('gym', f.gym, (v) => v.id)
  await merge('marks', f.marks, (v) => v.date)
  if (opts.includeProfile && f.profile) await tx.objectStore('meta').put(f.profile, 'profile')
  await tx.objectStore('meta').put(true, 'seeded')
  await tx.done
  return res
}

export async function wipeAll() {
  const d = await db()
  const tx = d.transaction(['runs', 'daily', 'gym', 'marks', 'meta'], 'readwrite')
  await Promise.all([
    tx.objectStore('runs').clear(), tx.objectStore('daily').clear(), tx.objectStore('gym').clear(),
    tx.objectStore('marks').clear(), tx.objectStore('meta').clear(),
  ])
  await tx.objectStore('meta').put(true, 'seeded')
  await tx.done
}
