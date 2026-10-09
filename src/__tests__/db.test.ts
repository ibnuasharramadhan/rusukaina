import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportAll, getLastExportAt, importAll, listDaily, listRuns, getProfile, markExported, resetConnection, saveDaily, saveProfile, saveRun, wipeAll } from '../lib/db'

beforeEach(async () => {
  await resetConnection()
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('latihan'); r.onsuccess = () => res() })
})

async function seed() {
  await saveRun({ id: 'r1', date: '2026-10-01', type: 'treadmill', distanceKm: 5.15, durationSec: 2162, createdAt: 1, updatedAt: 1 })
  await saveDaily({ date: '2026-09-29', restingHr: 58, sys: 148, dia: 83, updatedAt: 1 })
}

describe('IndexedDB', () => {
  it('HP baru tanpa data perlu onboarding; HP lama dengan data = profil Ibnu', async () => {
    expect(await getProfile()).toBeNull()
    await seed()
    expect(await getProfile()).toMatchObject({ name: 'Ibnu', plan: { kind: 'preset' } })
    expect((await listDaily())[0]).toMatchObject({ sys: 148, dia: 83 })
  })

  it('profil lama tanpa rencana tetap preset Ibnu; profil hasil onboarding dipakai apa adanya', async () => {
    await saveProfile({ name: 'Ibnu A', birthDate: '1998-12-25', restingHrBaseline: 60, maxHr: 188, easyCap: 145, raceDate: '2026-12-05', raceName: 'UI Ultra 7K', trackBp: true })
    expect(await getProfile()).toMatchObject({ name: 'Ibnu A', restingHrBaseline: 60, medName: 'Amlodipin', plan: { kind: 'preset' } })
    const input = { start: '2026-10-12', raceDate: '2026-12-13', raceName: 'Jakarta 10K', raceKm: 10, currentMin: 20, runsPerWeek: 3 as const, longDay: 0 as const, gymPerWeek: 1 as const }
    await saveProfile({ name: 'Rina', birthDate: '1995-01-01', restingHrBaseline: 62, maxHr: 186, easyCap: 145, raceDate: '2026-12-13', raceName: 'Jakarta 10K', trackBp: false, plan: { kind: 'generated', input } })
    const p = await getProfile()
    expect(p?.medName).toBeUndefined()
    expect(p?.plan).toMatchObject({ kind: 'generated' })
  })

  it('ekspor → hapus → impor mengembalikan data', async () => {
    await seed()
    const file = await exportAll()
    await wipeAll()
    expect(await listRuns()).toHaveLength(0)
    const res = await importAll(JSON.parse(JSON.stringify(file)))
    expect(res.runs).toBe(1)
    expect(await listRuns()).toHaveLength(1)
  })

  it('impor tidak menimpa data yang lebih baru', async () => {
    await seed()
    const file = await exportAll()
    file.runs[0].updatedAt = 1
    const [r] = await listRuns()
    await saveRun({ ...r, notes: 'diubah' })
    const res = await importAll(file)
    expect(res.runs).toBe(0)
    expect((await listRuns())[0].notes).toBe('diubah')
  })

  it('menolak file asing', async () => {
    await expect(importAll({ foo: 1 })).rejects.toThrow('Bukan file ekspor')
  })

  it('mencatat waktu ekspor terakhir', async () => {
    expect(await getLastExportAt()).toBeUndefined()
    await markExported(123)
    expect(await getLastExportAt()).toBe(123)
  })
})
