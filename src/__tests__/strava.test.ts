import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, listRuns, resetConnection, saveRun } from '../lib/db'
import { isDuplicate, isRun, syncStrava, toRunLog, type StravaActivity } from '../lib/strava'
import type { RunLog } from '../lib/types'

// Lari treadmill 5 Okt dari Huawei Health, seperti yang dikirim Strava.
const treadmill: StravaActivity = {
  id: 111, name: 'Lari treadmill', sport_type: 'Run', trainer: true,
  start_date: '2026-10-05T11:08:00Z', start_date_local: '2026-10-05T18:08:00Z',
  distance: 5580, moving_time: 2444, elapsed_time: 2450,
  average_heartrate: 143.6, max_heartrate: 158, average_cadence: 78.5,
  splits_metric: [
    { distance: 1000, moving_time: 451 }, { distance: 1000, moving_time: 416 }, { distance: 1000, moving_time: 416 },
    { distance: 1000, moving_time: 421 }, { distance: 1000, moving_time: 416 }, { distance: 580, moving_time: 324 },
  ],
}

describe('toRunLog', () => {
  it('memetakan aktivitas Strava ke catatan lari', () => {
    const r = toRunLog(treadmill, 1)
    expect(r).toMatchObject({
      id: 'strava-111', date: '2026-10-05', time: '18:08', type: 'treadmill',
      distanceKm: 5.58, durationSec: 2444, avgHr: 144, maxHr: 158, cadence: 157,
    })
    expect(r.splits).toBe('7:31, 6:56, 6:56, 7:01, 6:56, sisa 0,58 km 5:24')
  })
  it('lari luar ruangan tanpa HR, dan race', () => {
    const r = toRunLog({ ...treadmill, trainer: false, average_heartrate: undefined, max_heartrate: undefined, splits_metric: undefined })
    expect(r.type).toBe('outdoor')
    expect(r.avgHr).toBeUndefined()
    expect(r.splits).toBeUndefined()
    expect(toRunLog({ ...treadmill, trainer: false, workout_type: 1 }).type).toBe('race')
  })
  it('hanya lari yang diambil', () => {
    expect(isRun(treadmill)).toBe(true)
    expect(isRun({ ...treadmill, sport_type: 'Walk' })).toBe(false)
    expect(isRun({ ...treadmill, sport_type: undefined, type: 'Run' })).toBe(true)
  })
  it('lari manual di hari yang sama dengan jarak hampir sama = duplikat', () => {
    const manual = { id: 'x', date: '2026-10-05', distanceKm: 5.6 } as RunLog
    expect(isDuplicate(toRunLog(treadmill), [manual])).toBe(true)
    expect(isDuplicate(toRunLog(treadmill), [{ ...manual, distanceKm: 3 }])).toBe(false)
  })
})

describe('syncStrava', () => {
  beforeEach(async () => {
    await resetConnection()
    await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('latihan'); r.onsuccess = () => res() })
    await (await db()).put('meta', { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() / 1000 + 3600 }, 'strava')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('menambah lari baru, melewati duplikat dan aktivitas non-lari', async () => {
    const walk = { ...treadmill, id: 222, sport_type: 'Walk' }
    const outdoor = { ...treadmill, id: 333, trainer: false, start_date_local: '2026-10-04T06:34:00Z', start_date: '2026-10-03T23:34:00Z', distance: 5040 }
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('/athlete/activities') ? [treadmill, walk, outdoor] : treadmill
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await saveRun({ id: 'manual', date: '2026-10-04', type: 'outdoor', distanceKm: 5.04, durationSec: 2515, createdAt: 0, updatedAt: 0 })

    const res = await syncStrava(await listRuns())
    expect(res).toEqual({ added: 1, skipped: 1 })
    const runs = await listRuns()
    expect(runs.map((r) => r.id).sort()).toEqual(['manual', 'strava-111'])
    expect(fetchMock.mock.calls[0][0]).toContain('after=')

    // Sinkron kedua tidak menambah apa-apa.
    expect(await syncStrava(await listRuns())).toEqual({ added: 0, skipped: 2 })
  })

  it('pesan jelas saat token ditolak', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(syncStrava([])).rejects.toThrow('kedaluwarsa')
  })
})
