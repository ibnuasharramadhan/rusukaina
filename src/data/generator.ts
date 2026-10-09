// Generator rencana untuk pengguna baru, dengan aturan yang sama seperti
// rencana coach untuk Ibnu: semua lari easy (HR ≤ batas easy), maks 3 lari
// per minggu, tidak lari 2 hari berturut-turut, long run naik ±10%/minggu,
// deload tiap minggu ke-4, taper sebelum race.

import { addDays, fromISO, mondayOf, type ISODate } from '../lib/date'
import type { PlannedSession, PlanInput, SessionKind } from '../lib/types'
import type { Plan, WeekSpec } from './plan'

/** Long run terpanjang yang dituju per jarak race (menit, pace easy). */
export function peakLongMin(raceKm: number): number {
  if (raceKm <= 5) return 45
  if (raceKm <= 7) return 65
  if (raceKm <= 10) return 75
  if (raceKm <= 21.1) return 120
  return 150
}

const round5 = (n: number) => Math.round(n / 5) * 5
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Hari lari dan gym per hari-dalam-minggu (0 = Minggu ... 6 = Sabtu). */
export function weekLayout(input: Pick<PlanInput, 'runsPerWeek' | 'longDay' | 'gymPerWeek'>): { runs: number[]; gym: number[] } {
  const long = input.longDay
  const runs = input.runsPerWeek === 3 ? [2, 4, long] : [3, long]
  // Gym di hari kosong, urutan pilihan Senin, Kamis, Rabu, Jumat, Selasa.
  const gym = [1, 4, 3, 5, 2].filter((d) => !runs.includes(d)).slice(0, input.gymPerWeek)
  return { runs, gym }
}

export function generatePlan(input: PlanInput): Plan {
  const { start, raceDate, raceKm } = input
  const layout = weekLayout(input)
  const firstMonday = mondayOf(start)
  const raceMonday = mondayOf(raceDate)
  const n = Math.round((fromISO(raceMonday).getTime() - fromISO(firstMonday).getTime()) / (7 * 86_400_000)) + 1
  const peak = peakLongMin(raceKm)
  const taperWeek = n >= 6 ? n - 1 : 0 // nomor minggu taper (1-based), 0 = tidak ada

  // Long run per minggu: naik maks ±10% (min 5'), tiap minggu ke-4 deload.
  const longs: number[] = []
  let base = clamp(round5(input.currentMin), 15, peak)
  for (let no = 1; no <= n; no++) {
    const deload = no % 4 === 0 && no < taperWeek
    if (no === n) longs.push(0)
    else if (no === taperWeek) longs.push(Math.max(15, round5(base * 0.75)))
    else if (deload) longs.push(round5(base * 0.8))
    else {
      if (no > 1) base = Math.min(peak, base + Math.max(5, round5(base * 0.1)))
      longs.push(base)
    }
  }

  const weeks: WeekSpec[] = []
  const schedule: PlannedSession[] = []
  for (let no = 1; no <= n; no++) {
    const monday = addDays(firstMonday, (no - 1) * 7)
    const wStart = no === 1 ? start : monday
    const wEnd = no === n ? raceDate : addDays(monday, 6)
    const isRace = no === n
    const deload = no % 4 === 0 && no < taperWeek
    const taper = no === taperWeek
    const longMin = longs[no - 1]
    const midMin = clamp(round5(longMin * 0.6), 20, 40)
    const strides = !deload && !taper && !isRace && raceKm <= 10 && no > n / 2 ? 4 : undefined
    const note = isRace ? 'Minggu race: simpan tenaga.'
      : taper ? 'Taper: volume turun, jaga rasa segar.'
      : deload ? 'Deload: lebih ringan supaya tubuh menyerap latihan.'
      : no === 1 ? 'Minggu adaptasi: biasakan lari pelan dengan HR terjaga.'
      : undefined
    weeks.push({
      no, start: wStart, end: wEnd, deload, note, strides,
      longRun: isRace ? `RACE ${input.raceName}` : `Easy ${longMin}'`,
      midweek: isRace ? "Easy 20' + 3 strides" : `${midMin}'${strides ? ` + ${strides}x strides` : ''}`,
      longMin: isRace ? undefined : longMin, midMin: isRace ? undefined : midMin,
    })
    for (let d = wStart; d <= wEnd; d = addDays(d, 1)) {
      schedule.push(isRace ? raceDay(d, input, layout) : day(d, { longMin, midMin, strides, deload, taper }, layout, no))
    }
  }

  return {
    id: 'generated',
    start,
    end: raceDate,
    weeks,
    schedule,
    priorityNote: 'Kalau minggu sibuk: prioritas 1 = long run, 2 = gym, 3 = sisanya. Minggu dengan cuma 2–3 sesi tetap minggu yang bagus.',
    raceTips: [
      'Km awal: lebih lambat dari yang terasa perlu, HR masih di batas easy.',
      'Tengah: stabil sedikit di atas batas easy, jalan di tanjakan kalau HR melonjak.',
      'Akhir: kalau masih enak boleh sedikit menaikkan tempo. Jauhi zona 5.',
      'Sukses = finish dengan HR terkontrol dan merasa "masih bisa tambah 1 km".',
    ],
  }
}

function day(
  date: ISODate,
  w: { longMin: number; midMin: number; strides?: number; deload: boolean; taper: boolean },
  layout: { runs: number[]; gym: number[] },
  weekNo: number,
): PlannedSession {
  const dow = fromISO(date).getDay()
  const light = w.deload ? ' Minggu deload: lebih ringan dari biasanya.' : w.taper ? ' Taper: ringan, jangan menambah beban.' : ''
  const longDay = layout.runs[layout.runs.length - 1]
  if (dow === longDay) {
    return { date, kind: 'long', title: `Long run easy ${w.longMin}'`, minutes: w.longMin, detail: 'Lari utama minggu ini. HR di batas easy; kalau lewat, jalan dulu.' }
  }
  if (layout.runs.includes(dow)) {
    return {
      date, kind: 'easy', title: `Lari easy ${w.midMin}'${w.strides ? ` + ${w.strides}x strides` : ''}`, minutes: w.midMin, strides: w.strides,
      detail: 'HR di batas easy. Kalau capek, ganti jalan kaki.',
    }
  }
  const gi = layout.gym.indexOf(dow)
  if (gi >= 0) {
    // Gym A/B bergantian; kalau cuma 1x seminggu, ganti tiap minggu.
    const kind: SessionKind = (layout.gym.length === 1 ? weekNo % 2 === 1 : gi === 0) ? 'gymA' : 'gymB'
    return { date, kind, title: `Gym ${kind === 'gymA' ? 'A' : 'B'} (full body)`, minutes: 40, detail: `35–40'.${light}` }
  }
  // Hari sebelum long run libur total; hari kosong lain boleh jalan kaki.
  if (dow === (longDay + 6) % 7) return { date, kind: 'rest', title: 'Libur' }
  return { date, kind: 'walk', title: "Libur / jalan kaki 20–30'", minutes: 25 }
}

function raceDay(date: ISODate, input: PlanInput, layout: { runs: number[]; gym: number[] }): PlannedSession {
  const before = Math.round((fromISO(input.raceDate).getTime() - fromISO(date).getTime()) / 86_400_000)
  if (before === 0) return { date, kind: 'race', title: `RACE: ${input.raceName}`, km: input.raceKm, detail: 'Mulai pelan, HR di batas easy di km awal.' }
  if (before <= 2) return { date, kind: 'walk', title: 'Libur / jalan santai', detail: 'Simpan tenaga untuk hari race.' }
  if (before === 3) return { date, kind: 'easy', title: "Lari easy 20' + 3 strides", minutes: 20, strides: 3 }
  const dow = fromISO(date).getDay()
  if (layout.gym[0] === dow) return { date, kind: 'gymA', title: 'Gym A ringan (opsional)', detail: 'Minggu race: ringan saja, jangan menambah beban.' }
  return { date, kind: 'rest', title: 'Libur' }
}
