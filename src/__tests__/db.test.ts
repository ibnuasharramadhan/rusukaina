import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportAll, getLastExportAt, importAll, listDaily, listRuns, markExported, resetConnection, saveRun, seedIfEmpty, wipeAll } from '../lib/db'

beforeEach(async () => {
  await resetConnection()
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('latihan'); r.onsuccess = () => res() })
})

describe('IndexedDB', () => {
  it('seed sekali saja', async () => {
    await seedIfEmpty()
    await seedIfEmpty()
    expect(await listRuns()).toHaveLength(1)
    expect((await listDaily())[0]).toMatchObject({ sys: 148, dia: 83 })
  })

  it('ekspor → hapus → impor mengembalikan data', async () => {
    await seedIfEmpty()
    const file = await exportAll()
    await wipeAll()
    expect(await listRuns()).toHaveLength(0)
    const res = await importAll(JSON.parse(JSON.stringify(file)))
    expect(res.runs).toBe(1)
    expect(await listRuns()).toHaveLength(1)
  })

  it('impor tidak menimpa data yang lebih baru', async () => {
    await seedIfEmpty()
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
