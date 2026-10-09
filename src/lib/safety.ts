// Aturan keamanan dari rencana (bagian 3 dan 6). Murni fungsi supaya mudah dites.

export type Level = 'green' | 'yellow' | 'red' | 'critical' | 'unknown'

export interface Verdict {
  level: Level
  title: string
  advice: string[]
}

const RANK: Record<Level, number> = { unknown: 0, green: 1, yellow: 2, red: 3, critical: 4 }

export function worst(...levels: Level[]): Level {
  return levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'unknown' as Level)
}

/** Kategori tensi; diambil yang terburuk dari sistolik dan diastolik. */
export function bpLevel(sys?: number, dia?: number): Level {
  if (!sys || !dia) return 'unknown'
  if (sys >= 180 || dia >= 110) return 'critical'
  if (sys >= 160 || dia >= 100) return 'red'
  if (sys >= 140 || dia >= 90) return 'yellow'
  return 'green'
}

export function bpVerdict(sys?: number, dia?: number): Verdict {
  switch (bpLevel(sys, dia)) {
    case 'critical':
      return { level: 'critical', title: 'Jangan latihan, hubungi dokter', advice: [`Tensi ${sys}/${dia} ≥ 180/110.`, 'Istirahat, ukur ulang, dan hubungi dokter.'] }
    case 'red':
      return { level: 'red', title: 'Jangan latihan hari ini', advice: [`Tensi ${sys}/${dia} ≥ 160/100.`, 'Jalan santai saja, lalu ukur ulang.'] }
    case 'yellow':
      return {
        level: 'yellow', title: 'Boleh latihan, versi aman',
        advice: [`Tensi ${sys}/${dia} di 140–159 / 90–99.`, 'Jangan naikkan beban gym.', 'Tanpa strides.', 'Patuhi batas HR easy.'],
      }
    case 'green':
      return { level: 'green', title: 'Latihan sesuai rencana', advice: [`Tensi ${sys}/${dia} < 140/90.`] }
    default:
      return { level: 'unknown', title: 'Tensi belum dicatat', advice: ['Duduk tenang 5 menit, lalu ukur tensi sebelum latihan.'] }
  }
}

/** HR istirahat naik >7 bpm dari biasanya (mis. biasanya 58 → ≥65) = kurang pulih. */
export function restingHrVerdict(hr: number | undefined, baseline: number): Verdict {
  if (!hr) return { level: 'unknown', title: 'HR istirahat belum dicatat', advice: [] }
  const limit = baseline + 7
  if (hr >= limit) {
    return {
      level: 'red', title: 'Kurang pulih: ganti jadi jalan santai',
      advice: [`HR istirahat ${hr} ≥ ${limit} (biasanya ${baseline}).`, 'Kemungkinan kurang tidur/kurang pulih. Latihan hari ini diganti jalan santai.'],
    }
  }
  return { level: 'green', title: 'HR istirahat normal', advice: [`HR istirahat ${hr} (batas ${limit}).`] }
}

export function sleepVerdict(hours?: number): Verdict {
  if (hours == null) return { level: 'unknown', title: 'Tidur belum dicatat', advice: [] }
  if (hours < 5) return { level: 'red', title: "Tidur <5 jam: skip, jalan 20'", advice: [`Tidur ${hours} jam (<5). Skip latihan, cukup jalan kaki 20'. Tidak apa-apa.`] }
  if (hours < 6) return { level: 'yellow', title: 'Kurang tidur: latihan lebih ringan', advice: [`Tidur ${hours} jam (5–6). Gym cukup 1–2 set per latihan, lari lebih pendek dari rencana.`] }
  return { level: 'green', title: 'Tidur cukup', advice: [] }
}

export interface Readiness {
  level: Level
  headline: string
  verdicts: Verdict[]
  /** Boleh lari/gym seperti rencana (mungkin dengan batasan). */
  canTrain: boolean
  noStrides: boolean
  noLoadIncrease: boolean
}

/**
 * Tanpa tensimeter tapi minum obat tensi: anggap tensi masih kuning (untuk Ibnu,
 * terakhir 148/83), jadi batasan kuning tetap berlaku. Tanpa riwayat hipertensi
 * (tidak ada obat tensi), batasan ini tidak dipakai.
 */
export const NO_BP_NOTE = 'Tensi belum dipantau: tanpa strides dan beban gym tidak dinaikkan sampai tensi bisa dicek.'

export function readiness(input: {
  sys?: number; dia?: number; restingHr?: number; sleepHours?: number; baseline: number; trackBp?: boolean; pain?: Verdict
  /** Punya hipertensi (minum obat tensi). Default true supaya aman. */
  hypertension?: boolean
}): Readiness {
  const r = input.trackBp === false ? readinessWithoutBp(input) : readinessWithBp(input)
  return withPain(r, input.pain)
}

/** Nyeri ikut menentukan kesiapan: nyeri merah = tidak lari hari ini. */
function withPain(r: Readiness, pain?: Verdict): Readiness {
  if (!pain || pain.level === 'unknown') return r
  const level = r.level === 'unknown' && pain.level === 'green' ? r.level : worst(r.level, pain.level)
  const painWins = (pain.level === 'red' && r.level !== 'critical') || (pain.level === 'yellow' && (r.level === 'green' || r.level === 'unknown'))
  return {
    ...r,
    level,
    headline: painWins ? pain.title : r.headline,
    verdicts: [...r.verdicts, pain],
    canTrain: level === 'green' || level === 'yellow',
  }
}

function readinessWithBp(input: { sys?: number; dia?: number; restingHr?: number; sleepHours?: number; baseline: number }): Readiness {
  const bp = bpVerdict(input.sys, input.dia)
  const hr = restingHrVerdict(input.restingHr, input.baseline)
  const sl = sleepVerdict(input.sleepHours)
  const level = worst(bp.level, hr.level, sl.level)
  const verdicts = [bp, hr, sl].filter((v) => v.level !== 'unknown' || v === bp)
  const headline =
    level === 'critical' ? bp.title
    : level === 'red' ? (bp.level === 'red' ? bp.title : hr.level === 'red' ? hr.title : sl.title)
    : level === 'yellow' ? (bp.level === 'yellow' ? bp.title : sl.title)
    : level === 'green' ? 'Siap latihan sesuai rencana'
    : 'Cek tensi & HR istirahat dulu'
  return {
    level,
    headline,
    verdicts,
    canTrain: level === 'green' || level === 'yellow',
    noStrides: bp.level !== 'green',
    noLoadIncrease: bp.level !== 'green',
  }
}

function readinessWithoutBp(input: { restingHr?: number; sleepHours?: number; baseline: number; hypertension?: boolean }): Readiness {
  const htn = input.hypertension ?? true
  const hr = restingHrVerdict(input.restingHr, input.baseline)
  const sl = sleepVerdict(input.sleepHours)
  const level = worst(hr.level, sl.level)
  const note: Verdict = { level: 'unknown', title: 'Tensi belum dipantau', advice: [NO_BP_NOTE] }
  const headline =
    level === 'red' ? (hr.level === 'red' ? hr.title : sl.title)
    : level === 'yellow' ? sl.title
    : level === 'green' ? 'Siap latihan sesuai rencana'
    : 'Cek HR istirahat & tidur dulu'
  return {
    level,
    headline,
    verdicts: [hr, sl, ...(htn ? [note] : [])].filter((v) => v.advice.length),
    canTrain: level === 'green' || level === 'yellow',
    noStrides: htn,
    noLoadIncrease: htn,
  }
}

export const STOP_SIGNS = [
  'Nyeri/tekanan di dada, lengan, rahang',
  'Sesak tidak wajar',
  'Pusing berat / mau pingsan',
  'Jantung berdebar tidak beraturan',
  'Sakit kepala hebat mendadak',
  'Pandangan kabur',
]

/** Catatan coach otomatis untuk satu lari easy. */
export function runFlags(r: { avgHr?: number; maxHr?: number; type: string }, easyCap: number): string[] {
  const out: string[] = []
  if (r.type !== 'race' && r.avgHr && r.avgHr > easyCap) out.push(`HR rata-rata ${r.avgHr} > ${easyCap}: terlalu cepat untuk lari easy. Pelankan, atau selingi jalan sampai HR ~130.`)
  if (r.maxHr && r.maxHr >= 175) out.push(`HR maks ${r.maxHr} masuk Z5. Hindari di blok ini.`)
  return out
}
