// Kartu share: gambar ringkasan satu lari/jalan (1080×1350, rasio 4:5 untuk
// feed IG dan status WA). Data kartu disusun murni di cardData() supaya mudah
// dites; drawShareCard() hanya menggambar ke canvas.

import { plan, weekOf } from '../data/plan'
import { dayName, diffDays, formatDate } from './date'
import { formatDuration, formatPace, paceSecPerKm } from './pace'
import type { Profile, RunLog } from './types'

export const CARD_W = 1080
export const CARD_H = 1350

const TYPE: Record<RunLog['type'], string> = { treadmill: 'LARI TREADMILL', outdoor: 'LARI', race: 'RACE', walk: 'JALAN KAKI' }

export interface CardData {
  eyebrow: string
  date: string
  km: string
  stats: { label: string; value: string }[]
  /** Pace tiap km penuh (detik/km), maks 12 bar. */
  splits: number[]
  badge?: string
  /** "Minggu 2 dari 9 · UI Ultra 7K · 57 hari lagi" */
  journey?: string
  /** 0–1, posisi di rencana. */
  progress?: number
}

/** "7:31, 6:56, sisa 0,58 km 5:24" → [451, 416] (hanya km penuh). */
export function parseSplits(s?: string): number[] {
  if (!s) return []
  return s.split(',').map((x) => x.trim()).filter((x) => /^\d+:\d{2}$/.test(x)).map((x) => {
    const [m, sec] = x.split(':').map(Number)
    return m * 60 + sec
  })
}

const km = (n: number) => n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')

export function cardData(r: RunLog, profile: Pick<Profile, 'easyCap' | 'raceName' | 'raceDate'>): CardData {
  const pace = paceSecPerKm(r.distanceKm, r.durationSec)
  const stats = [
    { label: 'Waktu', value: formatDuration(r.durationSec) },
    { label: 'Pace', value: `${formatPace(pace)}/km` },
  ]
  if (r.avgHr) stats.push({ label: 'HR rata-rata', value: String(r.avgHr) })
  else if (r.cadence) stats.push({ label: 'Cadence', value: String(r.cadence) })

  const easy = r.type !== 'race' && r.type !== 'walk' && r.avgHr && r.avgHr <= profile.easyCap
  const p = plan()
  const w = weekOf(r.date)
  const left = diffDays(r.date, profile.raceDate)
  const journey = w && left >= 0
    ? `Minggu ${w.no} dari ${p.weeks.length} · ${profile.raceName}${left > 0 ? ` · ${left} hari lagi` : ''}`
    : undefined
  const total = diffDays(p.start, p.end)
  return {
    eyebrow: TYPE[r.type],
    date: `${dayName(r.date)}, ${formatDate(r.date)} ${r.date.slice(0, 4)}${r.time ? ` · ${r.time}` : ''}`,
    km: km(r.distanceKm),
    stats,
    splits: parseSplits(r.splits).slice(0, 12),
    badge: r.type === 'race' ? 'Race selesai' : easy ? `HR terjaga di zona easy (≤ ${profile.easyCap})` : undefined,
    journey,
    progress: journey && total > 0 ? Math.min(1, Math.max(0, diffDays(p.start, r.date) / total)) : undefined,
  }
}

const C = { bg: '#0e0f11', panel: '#17191c', ink: '#f3f1ec', ink2: '#c4c0b6', muted: '#8f8b82', line: '#262a2f', accent: '#ff6a2b', good: '#2fbf62', walk: '#2cc39b' }

export function drawShareCard(ctx: CanvasRenderingContext2D, d: CardData, type: RunLog['type']) {
  const W = CARD_W, H = CARD_H, X = 84
  const accent = type === 'walk' ? C.walk : C.accent
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  // Cahaya lembut di pojok kanan atas.
  const glow = ctx.createRadialGradient(W - 80, 60, 0, W - 80, 60, 760)
  glow.addColorStop(0, accent + '55')
  glow.addColorStop(1, accent + '00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const num = (size: number, weight = 700) => `${weight} ${size}px 'Barlow Condensed', 'Barlow', system-ui, sans-serif`
  const txt = (size: number, weight = 500) => `${weight} ${size}px 'Barlow', system-ui, sans-serif`
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = accent
  ctx.font = num(40, 700)
  ctx.fillText(spaced(d.eyebrow), X, 150)
  ctx.fillStyle = C.ink2
  ctx.font = txt(36)
  ctx.fillText(d.date, X, 205)

  // Jarak besar.
  ctx.fillStyle = C.ink
  ctx.font = num(300, 700)
  ctx.fillText(d.km, X - 8, 480)
  const kmW = ctx.measureText(d.km).width
  ctx.fillStyle = C.ink2
  ctx.font = num(80, 600)
  ctx.fillText('km', X + kmW + 10, 480)

  // Baris statistik.
  const colW = (W - X * 2) / d.stats.length
  d.stats.forEach((s, i) => {
    const x = X + i * colW
    ctx.fillStyle = C.muted
    ctx.font = txt(30, 500)
    ctx.fillText(s.label, x, 580)
    ctx.fillStyle = C.ink
    ctx.font = num(76, 600)
    ctx.fillText(s.value, x, 660)
  })

  let y = 730
  if (d.badge) {
    ctx.font = txt(32, 600)
    const bw = ctx.measureText(d.badge).width + 64
    ctx.fillStyle = (type === 'race' ? accent : C.good) + '26'
    roundRect(ctx, X, y, bw, 64, 32)
    ctx.fill()
    ctx.fillStyle = type === 'race' ? accent : C.good
    ctx.fillText(d.badge, X + 32, y + 43)
    y += 104
  } else y += 24

  // Split per km: bar makin panjang = makin cepat.
  if (d.splits.length >= 2) {
    const top = y, bottom = d.journey ? 1110 : 1220
    ctx.fillStyle = C.muted
    ctx.font = txt(30, 500)
    ctx.fillText('Split per km', X, top + 10)
    const n = d.splits.length
    const rowH = Math.min(46, (bottom - top - 40) / n)
    const fast = Math.min(...d.splits), slow = Math.max(...d.splits)
    const maxW = W - X * 2 - 190
    d.splits.forEach((s, i) => {
      const ry = top + 40 + i * rowH
      const t = slow === fast ? 1 : 1 - (s - fast) / (slow - fast)
      const bw = maxW * (0.45 + 0.55 * t)
      ctx.fillStyle = C.muted
      ctx.font = num(Math.min(30, rowH * 0.7), 600)
      ctx.fillText(String(i + 1), X, ry + rowH * 0.68)
      ctx.fillStyle = s === fast ? accent : accent + '8c'
      roundRect(ctx, X + 50, ry + rowH * 0.18, bw, rowH * 0.64, rowH * 0.2)
      ctx.fill()
      ctx.fillStyle = C.ink
      ctx.fillText(formatPace(s), X + 50 + bw + 16, ry + rowH * 0.68)
    })
  }

  // Perjalanan menuju race.
  if (d.journey) {
    ctx.fillStyle = C.ink2
    ctx.font = txt(32, 500)
    ctx.fillText(d.journey, X, 1180)
    ctx.fillStyle = C.line
    roundRect(ctx, X, 1206, W - X * 2, 14, 7)
    ctx.fill()
    ctx.fillStyle = accent
    roundRect(ctx, X, 1206, Math.max(14, (W - X * 2) * (d.progress ?? 0)), 14, 7)
    ctx.fill()
  }

  ctx.fillStyle = C.muted
  ctx.font = num(34, 700)
  ctx.fillText(spaced('RUSUKAINA'), X, H - 60)
}

function spaced(s: string) {
  return s.split('').join(' ')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Gambar kartu ke PNG. Tunggu font Barlow siap supaya tidak jatuh ke font sistem. */
export async function renderShareCard(r: RunLog, profile: Profile): Promise<Blob> {
  await Promise.all([
    document.fonts.load("700 300px 'Barlow Condensed'"), document.fonts.load("600 76px 'Barlow Condensed'"),
    document.fonts.load("500 36px 'Barlow'"), document.fonts.load("600 32px 'Barlow'"),
  ]).catch(() => undefined)
  const canvas = Object.assign(document.createElement('canvas'), { width: CARD_W, height: CARD_H })
  drawShareCard(canvas.getContext('2d')!, cardData(r, profile), r.type)
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Gagal membuat gambar'))), 'image/png'))
}

export function shareFileName(r: RunLog): string {
  return `rusukaina-${r.date}-${String(r.distanceKm).replace('.', '_')}km.png`
}

