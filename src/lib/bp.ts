export interface BpReading { sys: number; dia: number }

/** Satu pasang isian sistolik/diastolik dari form; error bila hanya satu terisi atau angkanya janggal. */
export function parseReading(sys: string, dia: string): BpReading | undefined | string {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')))
  const s = num(sys), d = num(dia)
  if ((s != null && !isFinite(s)) || (d != null && !isFinite(d))) return 'Angka tensi tidak masuk akal, cek lagi.'
  if (s == null && d == null) return undefined
  if (s == null || d == null) return 'Isi sistolik dan diastolik sekaligus.'
  if (s < 70 || s > 260 || d < 40 || d > 160 || d >= s) return 'Angka tensi tidak masuk akal, cek lagi.'
  return { sys: s, dia: d }
}

/** Rata-rata beberapa pengukuran dalam satu waktu (pagi atau malam), dibulatkan. */
export function averageBp(readings: BpReading[]): BpReading | undefined {
  if (!readings.length) return undefined
  const avg = (k: keyof BpReading) => Math.round(readings.reduce((a, r) => a + r[k], 0) / readings.length)
  return { sys: avg('sys'), dia: avg('dia') }
}
