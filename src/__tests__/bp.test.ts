import { describe, expect, it } from 'vitest'
import { averageBp, checkBp, dayBp, parseReading } from '../lib/bp'
import { bpAverage } from '../lib/stats'

describe('tensi dua kali ukur', () => {
  it('rata-rata dibulatkan', () => {
    expect(averageBp([{ sys: 150, dia: 90 }, { sys: 146, dia: 87 }])).toEqual({ sys: 148, dia: 89 })
    expect(averageBp([{ sys: 140, dia: 85 }])).toEqual({ sys: 140, dia: 85 })
    expect(averageBp([])).toBeUndefined()
  })

  it('isian kosong dilewati, isian setengah atau janggal ditolak', () => {
    expect(parseReading('', '')).toBeUndefined()
    expect(parseReading('148', '')).toBe('Isi sistolik dan diastolik sekaligus.')
    expect(parseReading('80', '90')).toBe('Angka tensi tidak masuk akal, cek lagi.')
    expect(parseReading('abc', '80')).toBe('Angka tensi tidak masuk akal, cek lagi.')
    expect(parseReading(' 148 ', '83')).toEqual({ sys: 148, dia: 83 })
  })

  it('tensi malam saja tetap terhitung', () => {
    const malam = { date: '2026-10-26', sysPm: 139, diaPm: 92, updatedAt: 0 }
    expect(dayBp(malam)).toEqual({ sys: 139, dia: 92 })
    expect(checkBp(malam)).toEqual({ sys: 139, dia: 92, evening: true })
    expect(bpAverage([malam], 7, '2026-10-26')).toEqual({ sys: 139, dia: 92, n: 1 })
  })

  it('pagi dan malam: grafik pakai rata-rata, cek kesiapan pakai pagi', () => {
    const d = { sys: 150, dia: 90, sysPm: 140, diaPm: 84 }
    expect(dayBp(d)).toEqual({ sys: 145, dia: 87 })
    expect(checkBp(d)).toEqual({ sys: 150, dia: 90, evening: false })
    expect(dayBp({})).toBeUndefined()
  })
})
