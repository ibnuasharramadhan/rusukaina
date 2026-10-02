import { fromISO, type ISODate } from './date'

export interface Zone {
  id: string
  name: string
  low: number
  high: number | null
  use: string
}

export function ageOn(birth: ISODate, on: ISODate): number {
  const b = fromISO(birth)
  const d = fromISO(on)
  let age = d.getFullYear() - b.getFullYear()
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--
  return age
}

/** Zona Karvonen: HR istirahat + persentase cadangan HR (HRmax − HRrest). */
export function karvonenZones(rest: number, max: number): Zone[] {
  const hrr = max - rest
  const at = (p: number) => Math.round(rest + hrr * p)
  return [
    { id: 'z1', name: 'Z1 Pemulihan', low: at(0.5), high: at(0.6), use: 'Jalan cepat, pendinginan' },
    { id: 'z2', name: 'Z2 Easy (aerobik)', low: at(0.6), high: at(0.7), use: 'Hampir semua lari sampai Desember' },
    { id: 'z3', name: 'Z3 Tempo ringan', low: at(0.7), high: at(0.8), use: 'Hanya di race day, bagian tengah' },
    { id: 'z4', name: 'Z4 Threshold', low: at(0.8), high: at(0.9), use: 'Belum dipakai (tunggu izin dokter)' },
    { id: 'z5', name: 'Z5 Maksimal', low: at(0.9), high: null, use: 'Tidak dipakai' },
  ]
}

export function zoneFor(hr: number, zones: Zone[]): Zone | undefined {
  for (let i = zones.length - 1; i >= 0; i--) if (hr >= zones[i].low) return zones[i]
  return undefined
}

/** MAF: 180 − umur, dikurangi 10 karena minum obat rutin. */
export function mafHr(age: number, onMedication: boolean): number {
  return 180 - age - (onMedication ? 10 : 0)
}
