import { describe, expect, it } from 'vitest'
import { bmi, measures, waist, waistTarget, weightForBmi, whtr } from '../lib/bodycomp'

describe('komposisi tubuh', () => {
  it('BMI dan kategori Kemenkes', () => {
    expect(bmi(70, 175)).toMatchObject({ value: 22.9, band: { label: 'Normal' } })
    expect(bmi(76.5, 175)).toMatchObject({ value: 25, band: { label: 'Normal' } })
    expect(bmi(80, 175)).toMatchObject({ value: 26.1, band: { label: 'Gemuk (overweight)' } })
    expect(bmi(90, 175).band.label).toBe('Obesitas')
    expect(bmi(50, 175).band.label).toBe('Kurus')
  })

  it('lingkar perut: batas pria 90, wanita 80', () => {
    expect(waist(89, 'm').band.level).toBe('green')
    expect(waist(90, 'm').band.label).toBe('Obesitas sentral')
    expect(waist(80, 'f').band.level).toBe('red')
  })

  it('rasio pinggang-tinggi', () => {
    expect(whtr(80, 170)).toMatchObject({ value: 0.47, band: { label: 'Sehat' } })
    expect(whtr(88, 170).band.label).toBe('Risiko meningkat')
    expect(whtr(105, 170).band.label).toBe('Risiko tinggi')
  })

  it('target berat dan lingkar perut', () => {
    expect(weightForBmi(25, 170)).toBe(72.2)
    expect(waistTarget(170, 'm')).toBe(85)
    expect(waistTarget(170, 'f')).toBe(80)
  })

  it('riwayat pengukuran urut tanggal, hanya hari yang diukur', () => {
    const m = measures([
      { date: '2026-10-20', weightKg: 71, updatedAt: 0 },
      { date: '2026-10-13', weightKg: 72, waistCm: 90, updatedAt: 0 },
      { date: '2026-10-15', restingHr: 60, updatedAt: 0 },
    ])
    expect(m.weight.map((x) => x.value)).toEqual([72, 71])
    expect(m.waist).toEqual([{ date: '2026-10-13', value: 90 }])
  })
})
