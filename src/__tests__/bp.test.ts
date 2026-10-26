import { describe, expect, it } from 'vitest'
import { averageBp, parseReading } from '../lib/bp'

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
})
