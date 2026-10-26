// Preset: rencana Ibnu 1 Okt – 5 Des 2026 (UI Ultra 7K), disalin dari
// latihan/rencana-okt-des-2026.md (revisi 1 Okt) plus revisi coach per tanggal (8 dan 19 Okt).

import { addDays, fromISO, type ISODate } from '../../lib/date'
import type { PlannedSession, Profile } from '../../lib/types'
import type { Plan, WeekSpec } from '../plan'

export const IBNU_PROFILE: Profile = {
  name: 'Ibnu',
  birthDate: '1998-12-25',
  restingHrBaseline: 58,
  maxHr: 188,
  easyCap: 145,
  raceDate: '2026-12-05',
  raceName: 'UI Ultra 7K',
  trackBp: false,
  medName: 'Amlodipin',
  plan: { kind: 'preset', id: 'ibnu-ui7k' },
}

const WEEKS: WeekSpec[] = [
  { no: 1, start: '2026-10-01', end: '2026-10-04', longRun: "Easy 35' HR ≤145 (treadmill ±7:45–8:15/km)", midweek: "Minggu: jalan cepat 30'", note: 'Minggu adaptasi gym', longMin: 35 },
  { no: 2, start: '2026-10-05', end: '2026-10-11', longRun: "Easy 40'", midweek: "25–30'", longMin: 40, midMin: 25 },
  { no: 3, start: '2026-10-12', end: '2026-10-18', longRun: "Easy 45' / ±5,5 km", midweek: "30'", longMin: 45, longKm: 5.5, midMin: 30 },
  { no: 4, start: '2026-10-19', end: '2026-10-25', longRun: 'Tidak lari (pemulihan kaki)', midweek: "Jalan santai 20–30' 3–4x", note: 'Pemulihan kaki: tanpa lari. Jalan santai, penguatan kaki 3x, gym tubuh atas. Berhenti kalau jalan memicu nyeri.', deload: true },
  { no: 5, start: '2026-10-26', end: '2026-11-01', longRun: "Tahap 2: (lari 2' / jalan 1') x7", midweek: 'Jalan santai + penguatan kaki', note: "Lari 22 Okt memicu nyeri lagi, lalu istirahat 23–25 Okt. Kembali lari-jalan tahap 2 (±20'), hanya kalau pagi bebas nyeri. Nyeri muncul lagi: turun 1 tahap dan istirahat 2 hari." },
  { no: 6, start: '2026-11-02', end: '2026-11-08', longRun: "Easy 55'", midweek: "30'", note: 'Tes 3 km di HR 140–145: catat pace, bandingkan dengan 1 Okt', longMin: 55, midMin: 30 },
  { no: 7, start: '2026-11-09', end: '2026-11-15', longRun: "Easy 60' / ±7 km", midweek: "30' + 4x strides 15\"", note: 'Strides = akselerasi santai, bukan sprint', longMin: 60, longKm: 7, midMin: 30, strides: 4 },
  { no: 8, start: '2026-11-16', end: '2026-11-22', longRun: "Easy 50'", midweek: "30' + 6x strides", note: 'Deload', deload: true, longMin: 50, midMin: 30, strides: 6 },
  { no: 9, start: '2026-11-23', end: '2026-11-29', longRun: "Easy 65' / ±8 km", midweek: "30'", note: 'Simulasi: sepatu, sarapan, minum sama dengan hari H', longMin: 65, longKm: 8, midMin: 30 },
  { no: 10, start: '2026-11-30', end: '2026-12-05', longRun: 'RACE Sabtu 5 Des', midweek: "Rabu 20' easy + 3 strides; Kamis/Jumat libur/jalan", note: 'Minggu race' },
]

function sessionFor(date: ISODate, w: WeekSpec): PlannedSession {
  const dow = fromISO(date).getDay() // 0 Min ... 6 Sab
  const deload = w.deload ? '. Minggu deload: lebih ringan dari biasanya.' : ''

  if (w.no === 10) {
    switch (dow) {
      case 1: return { date, kind: 'gymA', title: 'Gym A ringan (opsional)', detail: 'Minggu race: ringan saja, jangan menambah beban.' }
      case 3: return { date, kind: 'easy', title: "Lari easy 20' + 3 strides", minutes: 20, strides: 3 }
      case 4:
      case 5: return { date, kind: 'walk', title: 'Libur / jalan santai', detail: 'Simpan tenaga untuk Sabtu.' }
      case 6: return { date, kind: 'race', title: 'RACE: UI Ultra 7K', km: 7, detail: 'Km 1–2 HR ≤150, km 3–5 di 145–160, km 6–7 maks ~165.' }
      default: return { date, kind: 'rest', title: 'Libur' }
    }
  }

  switch (dow) {
    case 1: return { date, kind: 'gymA', title: 'Gym A (full body)', minutes: 40, detail: `Jam istirahat siang, 35–40'${deload}` }
    case 2: return { date, kind: 'walk', title: "Libur / jalan kaki 20–30'", minutes: 25 }
    case 3: return {
      date, kind: 'easy', title: `Lari easy treadmill${w.midMin ? ` ${w.midMin}'` : ''}${w.strides ? ` + ${w.strides}x strides` : ''}`,
      minutes: w.midMin, strides: w.strides, detail: 'HR ≤145. Kalau capek, ganti Gym B.',
    }
    case 4: return { date, kind: 'gymB', title: 'Gym B (full body)', minutes: 40, detail: `Jam istirahat siang, 35–40'${deload}` }
    case 5: return { date, kind: 'rest', title: 'Libur' }
    case 6: return {
      date, kind: 'long', title: `Long run easy ${w.longMin}'${w.longKm ? ` / ±${String(w.longKm).replace('.', ',')} km` : ''}`,
      minutes: w.longMin, km: w.longKm, detail: 'Lari utama minggu ini. HR ≤145, sebelum 07.00.',
    }
    default: // Minggu
      if (w.no === 1) return { date, kind: 'walk', title: "Jalan cepat 30'", minutes: 30 }
      return {
        date, kind: 'easy', title: `Lari easy pendek ${w.midMin}'${w.strides ? ` + ${w.strides}x strides` : ''} / jalan cepat`,
        minutes: w.midMin, strides: w.strides, detail: 'Opsional: boleh jalan cepat atau libur.',
      }
  }
}

const LEG = 'Penguatan kaki: calf raise 2x12, angkat ujung kaki (tibialis raise) 2x15, glute bridge 2x12.'
const STAGE2 = "Tahap 2: (lari 2' / jalan 1') x7"
const STAGE2_DETAIL = 'Treadmill, ±20 menit, HR ≤145. Hanya kalau pagi ini kaki bebas nyeri dan tidak pegal berat. Nyeri saat lari: berhenti, turun ke tahap 1, istirahat 2 hari.'

// Perubahan per tanggal dari thread coaching (revisi 8 Okt), menimpa template mingguan.
const OVERRIDES: Record<ISODate, Omit<PlannedSession, 'date'>> = {
  '2026-10-09': { kind: 'rest', title: 'Libur', detail: 'Istirahat setelah lari Rabu dan Kamis.' },
  '2026-10-10': { kind: 'rest', title: 'Libur', detail: 'Long run minggu ini sudah dilakukan Kamis.' },
  '2026-10-11': {
    kind: 'easy', title: "Lari easy 30–40'", minutes: 35, extraRunOk: true,
    detail: 'HR ≤145, pakai jam. Jangan lebih panjang dari lari Kamis. Lari ke-4 minggu ini: pengecualian, mulai minggu depan maks 3.',
  },
  '2026-10-12': { kind: 'gymB', title: 'Gym B (full body)', minutes: 40, detail: "Pembuka minggu 3. Jam istirahat siang, 35–40'" },
  // Revisi 19 Okt: nyeri betis/kaki, lari dihentikan. Minggu 4 jalan + penguatan, minggu 5 protokol kembali lari tahap 1.
  '2026-10-19': { kind: 'walk', title: "Jalan santai 20–30'", minutes: 25, detail: 'Tanpa lari. Berhenti kalau memicu nyeri.' },
  '2026-10-20': { kind: 'gymA', title: 'Gym A tubuh atas + penguatan kaki', minutes: 40, detail: `Lewati gerakan kaki yang berat. ${LEG}` },
  '2026-10-21': { kind: 'walk', title: "Jalan santai 20–30'", minutes: 25, detail: 'Tanpa lari. Berhenti kalau memicu nyeri.' },
  '2026-10-22': { kind: 'gymB', title: 'Gym B tubuh atas + penguatan kaki', minutes: 40, detail: `Lewati gerakan kaki yang berat. ${LEG}` },
  '2026-10-23': { kind: 'rest', title: 'Libur' },
  '2026-10-24': { kind: 'walk', title: "Jalan santai 30' + penguatan kaki", minutes: 30, detail: `Tanpa lari. ${LEG}` },
  '2026-10-25': {
    kind: 'walk', title: "Tes jalan cepat 30'", minutes: 30,
    detail: 'Syarat mulai lari lagi: jalan cepat 30\' tanpa nyeri, 10x lompat kecil satu kaki tanpa nyeri, tulang kering tidak nyeri ditekan. Kalau masih nyeri, minggu depan tetap jalan saja.',
  },
  '2026-10-26': { kind: 'gymA', title: "Leg day ringan + jalan treadmill 20–30'", minutes: 50, detail: 'Tidak lari. Gerakan kaki beban ringan, berhenti kalau nyeri. Setelah gym, jalan santai di treadmill.' },
  '2026-10-27': { kind: 'easy', title: STAGE2, minutes: 20, detail: `${STAGE2_DETAIL} Masih pegal dari leg day: geser ke Rabu.` },
  '2026-10-28': { kind: 'walk', title: "Jalan santai 20–30' + penguatan kaki", minutes: 25, detail: `Kalau lari-jalan kemarin digeser, lakukan hari ini dan lewati jalan ini. ${LEG}` },
  '2026-10-29': { kind: 'gymB', title: 'Gym B (full body)', minutes: 40, detail: 'Gerakan kaki hanya kalau tidak nyeri. Tambahkan gerakan tarik (lat pulldown/row) dan core.' },
  '2026-10-30': { kind: 'rest', title: 'Libur' },
  '2026-10-31': { kind: 'easy', title: STAGE2, minutes: 20, detail: `${STAGE2_DETAIL} Dua sesi tanpa nyeri (saat lari dan besok paginya) = boleh naik ke tahap 3: (lari 4' / jalan 1') x5.` },
  '2026-11-01': { kind: 'walk', title: "Jalan santai 20–30'", minutes: 25, detail: 'Opsional. Cek kaki pagi ini setelah lari kemarin.' },
}

function buildSchedule(): PlannedSession[] {
  const out: PlannedSession[] = []
  for (const w of WEEKS) {
    for (let d = w.start; d <= w.end; d = addDays(d, 1)) {
      const o = OVERRIDES[d]
      out.push(o ? { date: d, ...o } : sessionFor(d, w))
    }
  }
  return out
}

export const IBNU_PLAN: Plan = {
  id: 'ibnu-ui7k',
  start: '2026-10-01',
  end: '2026-12-05',
  weeks: WEEKS,
  schedule: buildSchedule(),
  priorityNote: 'Kalau minggu kerja kacau: prioritas 1 = long run, 2 = 2x gym, 3 = sisanya. Minggu dengan cuma 3 sesi tetap minggu yang bagus.',
  raceTips: [
    'Km 1–2: lebih lambat dari yang terasa perlu, HR ≤150.',
    'Km 3–5: stabil di 145–160, jalan di tanjakan kalau HR >160.',
    'Km 6–7: kalau masih enak boleh sedikit naik, tapi tidak lewat ~165. Jauhi 175+.',
    'Sukses = finish dengan HR terkontrol dan merasa "masih bisa tambah 1 km".',
  ],
}
