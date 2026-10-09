import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { LEGACY_PROFILE } from '../data/plan'
import type { DailyLog, ExportFile, GymLog, Profile, RunLog, SessionMark, Shoe } from './types'

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
/**
 * Profil tersimpan. Profil tanpa `plan` (dibuat sebelum ada onboarding) dan HP
 * yang sudah punya data tapi belum punya profil adalah milik Ibnu (preset).
 * null = HP baru, perlu onboarding.
 */
export async function getProfile(): Promise<Profile | null> {
  const d = await db()
  const p = (await d.get('meta', 'profile')) as Partial<Profile> | undefined
  if (p?.plan) return p as Profile
  if (p) return { ...LEGACY_PROFILE, ...p, plan: LEGACY_PROFILE.plan }
  const hasData = (await d.get('meta', 'seeded')) || (await d.count('runs')) + (await d.count('daily')) + (await d.count('gym')) + (await d.count('marks')) > 0
  return hasData ? LEGACY_PROFILE : null
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

// --- Sepatu (disimpan sebagai satu daftar di meta, tanpa object store baru)
export async function listShoes(): Promise<Shoe[]> {
  return ((await (await db()).get('meta', 'shoes')) as Shoe[] | undefined) ?? []
}
export async function saveShoe(s: Shoe) {
  const all = await listShoes()
  await (await db()).put('meta', [...all.filter((x) => x.id !== s.id), s], 'shoes')
}
export async function deleteShoe(id: string) {
  await (await db()).put('meta', (await listShoes()).filter((x) => x.id !== id), 'shoes')
}

// --- Ekspor / impor
export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'pwa-latihan',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: (await getProfile()) ?? undefined,
    runs: await listRuns(),
    daily: await listDaily(),
    gym: await listGym(),
    marks: await listMarks(),
    shoes: await listShoes(),
  }
}

export interface ImportResult { runs: number; daily: number; gym: number; marks: number; shoes: number }

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
  const res: ImportResult = { runs: 0, daily: 0, gym: 0, marks: 0, shoes: 0 }
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
  if (Array.isArray(f.shoes) && f.shoes.length) {
    const meta = tx.objectStore('meta')
    const shoes = new Map(((await meta.get('shoes')) as Shoe[] | undefined ?? []).map((s) => [s.id, s]))
    for (const s of f.shoes) {
      const cur = shoes.get(s.id)
      if (!cur || cur.updatedAt <= s.updatedAt) { shoes.set(s.id, s); res.shoes++ }
    }
    await meta.put([...shoes.values()], 'shoes')
  }
  if (opts.includeProfile && f.profile) await tx.objectStore('meta').put(f.profile, 'profile')
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
  await tx.done
}
