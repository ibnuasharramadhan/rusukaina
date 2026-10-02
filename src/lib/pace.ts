// Konversi waktu dan pace. Durasi disimpan dalam detik.

/** "36:02", "1:05:30", atau "45" (menit) menjadi detik. */
export function parseDuration(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  const parts = s.split(':').map((p) => p.trim())
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.length === 1) return Math.round(nums[0] * 60)
  if (nums.length === 2) {
    if (nums[1] >= 60) return null
    return nums[0] * 60 + nums[1]
  }
  if (nums.length === 3) {
    if (nums[1] >= 60 || nums[2] >= 60) return null
    return nums[0] * 3600 + nums[1] * 60 + nums[2]
  }
  return null
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Detik per km. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0)) return null
  return durationSec / distanceKm
}

/** 420 -> "7:00" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm)) return '–'
  let m = Math.floor(secPerKm / 60)
  let s = Math.round(secPerKm % 60)
  if (s === 60) {
    m += 1
    s = 0
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Efisiensi aerobik: meter yang ditempuh per detak jantung.
 * Naik dari minggu ke minggu = jantung makin efisien (stamina membaik).
 */
export function metersPerBeat(distanceKm: number, durationSec: number, avgHr: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0) || !(avgHr > 0)) return null
  const beats = (avgHr * durationSec) / 60
  return (distanceKm * 1000) / beats
}
