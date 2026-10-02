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
        advice: [`Tensi ${sys}/${dia} di 140–159 / 90–99.`, 'Jangan naikkan beban gym.', 'Tanpa strides.', 'Patuhi HR ≤145.'],
      }
    case 'green':
      return { level: 'green', title: 'Latihan sesuai rencana', advice: [`Tensi ${sys}/${dia} < 140/90.`] }
    default:
      return { level: 'unknown', title: 'Tensi belum dicatat', advice: ['Duduk tenang 5 menit, lalu ukur tensi sebelum latihan.'] }
  }
}

/** HR istirahat naik >7 bpm dari biasanya (baseline 58 → ≥65) = kurang pulih. */
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
  if (hours < 6) return { level: 'yellow', title: 'Kurang tidur', advice: [`Tidur ${hours} jam (<6). Ganti sesi jadi jalan kaki atau skip. Tidak apa-apa.`] }
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

export function readiness(input: { sys?: number; dia?: number; restingHr?: number; sleepHours?: number; baseline: number }): Readiness {
  const bp = bpVerdict(input.sys, input.dia)
  const hr = restingHrVerdict(input.restingHr, input.baseline)
  const sl = sleepVerdict(input.sleepHours)
  // Kurang tidur di rencana = "ganti sesi jadi jalan kaki atau skip", jadi diperlakukan seperti red untuk keputusan latihan.
  const sleepAsTraining: Level = sl.level === 'yellow' ? 'red' : sl.level
  const level = worst(bp.level, hr.level, sleepAsTraining)
  const verdicts = [bp, hr, sl].filter((v) => v.level !== 'unknown' || v === bp)
  const headline =
    level === 'critical' ? bp.title
    : level === 'red' ? (bp.level === 'red' ? bp.title : hr.level === 'red' ? hr.title : 'Kurang tidur: jalan kaki atau skip')
    : level === 'yellow' ? bp.title
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
