import { describe, expect, it } from 'vitest'
import { notifSessions, notifText } from '../lib/notify'
import type { PlannedSession } from '../lib/types'

const s = (date: string, p: Partial<PlannedSession>): PlannedSession => ({ date, kind: 'walk', title: 'Jalan', ...p })

describe('notifikasi jadwal', () => {
  it('teks per jenis sesi', () => {
    expect(notifText(s('2026-10-23', { kind: 'rest', title: 'Libur' })).title).toBe('Hari ini libur')
    expect(notifText(s('2026-10-21', { title: "Jalan santai 20–30'", detail: 'Tanpa lari.' }))).toEqual({
      title: "Hari ini: Jalan santai 20–30'", body: 'Tanpa lari. Isi cek pagi dulu di Rusukaina.',
    })
    expect(notifText(s('2026-10-21', { kind: 'gymA', title: 'Gym A', minutes: 40 })).body).toBe('40 menit. Isi cek pagi dulu di Rusukaina.')
  })

  it('hanya menyimpan rentang hari yang diminta', () => {
    const sched = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((d) => s(d, {}))
    expect(Object.keys(notifSessions(sched, '2026-10-19', 2))).toEqual(['2026-10-19', '2026-10-20'])
  })
})
