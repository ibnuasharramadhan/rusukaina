// Semua tanggal disimpan sebagai string lokal "YYYY-MM-DD" supaya tidak
// bergeser karena zona waktu (WIB) saat diserialisasi ke JSON.

export type ISODate = string

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function dayName(s: ISODate, short = false): string {
  return (short ? HARI_PENDEK : HARI)[fromISO(s).getDay()]
}

/** "1 Okt" atau "Kam, 1 Okt" */
export function formatDate(s: ISODate, withDay = false): string {
  const d = fromISO(s)
  const base = `${d.getDate()} ${BULAN[d.getMonth()]}`
  return withDay ? `${HARI_PENDEK[d.getDay()]}, ${base}` : base
}

/** Senin dari minggu yang memuat tanggal s. */
export function mondayOf(s: ISODate): ISODate {
  const dow = fromISO(s).getDay() // 0 = Minggu
  return addDays(s, dow === 0 ? -6 : 1 - dow)
}
