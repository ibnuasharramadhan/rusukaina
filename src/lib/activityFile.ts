// Impor aktivitas dari file ekspor jam/aplikasi: GPX, TCX, dan FIT.
// Untuk teman yang tidak bisa memakai sinkron Strava (kuota API 1 atlet).
// Semua parsing dilakukan di perangkat, tanpa library tambahan.

import { formatSplits, isDuplicate } from './strava'
import type { RunLog, RunType } from './types'

/** Satu titik rekaman: detik sejak mulai dan jarak kumulatif (meter). */
interface Point { t: number; d?: number; lat?: number; lon?: number; hr?: number; cad?: number }

export interface ParsedActivity {
  /** Waktu mulai (epoch ms). */
  start: number
  distanceM: number
  durationSec: number
  avgHr?: number
  maxHr?: number
  /** Langkah per menit (dua kaki). */
  cadence?: number
  kind: 'run' | 'walk' | 'other'
  /** Tanpa GPS = kemungkinan treadmill. */
  indoor: boolean
  /** Split per km: jarak (m) dan waktu (detik). */
  splits: { distance: number; moving_time: number }[]
}

export class ActivityFileError extends Error {}

export function parseActivityFile(name: string, data: ArrayBuffer): ParsedActivity {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'fit') return parseFit(data)
  const text = new TextDecoder().decode(data)
  if (ext === 'tcx' || /<TrainingCenterDatabase/i.test(text)) return parseTcx(text)
  if (ext === 'gpx' || /<gpx[\s>]/i.test(text)) return parseGpx(text)
  throw new ActivityFileError('Format tidak dikenali. Gunakan file .gpx, .tcx, atau .fit.')
}

// ---------- XML (GPX & TCX)

/** Isi tag pertama bernama `tag` (abaikan prefix namespace). */
function tagText(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([^<]*)<`, 'i').exec(xml)
  return m?.[1].trim()
}
function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</(?:[\\w-]+:)?${tag}>)`, 'gi')
  return xml.match(re) ?? []
}
function attr(el: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(el)?.[1]
}
const numOr = (s?: string) => (s != null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined)

function kindFromName(s = ''): ParsedActivity['kind'] {
  if (/walk|hik|jalan/i.test(s)) return 'walk'
  if (/run|lari|jog/i.test(s)) return 'run'
  return 'other'
}

function parseGpx(xml: string): ParsedActivity {
  const pts = blocks(xml, 'trkpt')
  if (!pts.length) throw new ActivityFileError('File GPX tidak berisi titik rute.')
  let t0: number | undefined
  const points: Point[] = []
  for (const p of pts) {
    const time = tagText(p, 'time')
    if (!time) continue
    const ms = Date.parse(time)
    t0 ??= ms
    points.push({
      t: (ms - t0) / 1000, lat: numOr(attr(p, 'lat')), lon: numOr(attr(p, 'lon')),
      hr: numOr(tagText(p, 'hr')), cad: numOr(tagText(p, 'cad')),
    })
  }
  if (t0 == null) throw new ActivityFileError('File GPX tidak berisi waktu, jadi durasi tidak bisa dihitung.')
  // Jarak kumulatif dari koordinat.
  let d = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (a?.lat != null && a.lon != null && b.lat != null && b.lon != null) d += haversine(a.lat, a.lon, b.lat, b.lon)
    b.d = d
  }
  const type = tagText(blocks(xml, 'trk')[0] ?? '', 'type') ?? tagText(xml, 'name')
  return summarize(t0, points, { kind: kindFromName(type), indoor: false })
}

function parseTcx(xml: string): ParsedActivity {
  const act = blocks(xml, 'Activity')[0] ?? xml
  const laps = blocks(act, 'Lap')
  const tps = blocks(act, 'Trackpoint')
  const startStr = attr(laps[0] ?? '', 'StartTime') ?? tagText(act, 'Id') ?? tagText(tps[0] ?? '', 'Time')
  if (!startStr) throw new ActivityFileError('File TCX tidak berisi waktu mulai.')
  const t0 = Date.parse(startStr)
  const points: Point[] = []
  for (const p of tps) {
    const time = tagText(p, 'Time')
    if (!time) continue
    points.push({
      t: (Date.parse(time) - t0) / 1000, d: numOr(tagText(p, 'DistanceMeters')),
      lat: numOr(tagText(p, 'LatitudeDegrees')), hr: numOr(tagText(blocks(p, 'HeartRateBpm')[0] ?? '', 'Value')),
      cad: numOr(tagText(p, 'RunCadence') ?? tagText(p, 'Cadence')),
    })
  }
  // Jarak & durasi resmi dari lap (sudah tanpa jeda), kalau ada.
  const lapTotals = laps.map((l) => {
    const head = l.split(/<(?:[\w-]+:)?Track\b/)[0]
    return { sec: numOr(tagText(head, 'TotalTimeSeconds')) ?? 0, m: numOr(tagText(head, 'DistanceMeters')) ?? 0 }
  })
  const lapSec = lapTotals.reduce((s, l) => s + l.sec, 0)
  const lapM = lapTotals.reduce((s, l) => s + l.m, 0)
  const sport = attr(act, 'Sport')
  return summarize(t0, points, {
    kind: kindFromName(sport === 'Other' ? tagText(act, 'Notes') ?? sport : sport),
    indoor: !points.some((p) => p.lat != null),
    durationSec: lapSec || undefined, distanceM: lapM || undefined,
  })
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000, rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ---------- FIT (biner, format jam Garmin/Coros/Huawei)

const FIT_EPOCH = 631_065_600 // 1989-12-31T00:00:00Z dalam detik epoch Unix
const BASE: Record<number, { size: number; read: (v: DataView, o: number, le: boolean) => number; invalid: number }> = {
  0: { size: 1, read: (v, o) => v.getUint8(o), invalid: 0xff },
  1: { size: 1, read: (v, o) => v.getInt8(o), invalid: 0x7f },
  2: { size: 1, read: (v, o) => v.getUint8(o), invalid: 0xff },
  3: { size: 2, read: (v, o, le) => v.getInt16(o, le), invalid: 0x7fff },
  4: { size: 2, read: (v, o, le) => v.getUint16(o, le), invalid: 0xffff },
  5: { size: 4, read: (v, o, le) => v.getInt32(o, le), invalid: 0x7fffffff },
  6: { size: 4, read: (v, o, le) => v.getUint32(o, le), invalid: 0xffffffff },
  10: { size: 1, read: (v, o) => v.getUint8(o), invalid: 0 },
  11: { size: 2, read: (v, o, le) => v.getUint16(o, le), invalid: 0 },
  12: { size: 4, read: (v, o, le) => v.getUint32(o, le), invalid: 0 },
}

interface FitDef { global: number; le: boolean; fields: { num: number; size: number; base: number }[]; devSize: number }

/** Baca pesan FIT sebagai daftar { global, values }. Hanya field angka tunggal. */
export function readFitMessages(data: ArrayBuffer): { global: number; values: Record<number, number> }[] {
  const v = new DataView(data)
  if (v.byteLength < 12) throw new ActivityFileError('File FIT terlalu kecil.')
  const headerSize = v.getUint8(0)
  const dataSize = v.getUint32(4, true)
  if (String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11)) !== '.FIT') {
    throw new ActivityFileError('Bukan file FIT yang valid.')
  }
  const end = Math.min(v.byteLength, headerSize + dataSize)
  const defs = new Map<number, FitDef>()
  const out: { global: number; values: Record<number, number> }[] = []
  let o = headerSize
  let lastTs = 0
  while (o < end) {
    const h = v.getUint8(o++)
    if (h & 0x80) {
      // Header timestamp terkompresi: pesan data dengan offset waktu 5 bit.
      const def = defs.get((h >> 5) & 0x3)
      if (!def) throw new ActivityFileError('File FIT rusak (definisi hilang).')
      const off = h & 0x1f
      lastTs = lastTs + ((off - (lastTs & 0x1f)) & 0x1f)
      const values = readFields(v, o, def)
      values[253] ??= lastTs
      out.push({ global: def.global, values })
      o += def.fields.reduce((s, f) => s + f.size, 0) + def.devSize
    } else if (h & 0x40) {
      const local = h & 0x0f
      const le = v.getUint8(o + 1) === 0
      const global = v.getUint16(o + 2, le)
      const n = v.getUint8(o + 4)
      o += 5
      const fields = []
      for (let i = 0; i < n; i++, o += 3) fields.push({ num: v.getUint8(o), size: v.getUint8(o + 1), base: v.getUint8(o + 2) & 0x1f })
      let devSize = 0
      if (h & 0x20) {
        const nd = v.getUint8(o++)
        for (let i = 0; i < nd; i++, o += 3) devSize += v.getUint8(o + 1)
      }
      defs.set(local, { global, le, fields, devSize })
    } else {
      const def = defs.get(h & 0x0f)
      if (!def) throw new ActivityFileError('File FIT rusak (definisi hilang).')
      const values = readFields(v, o, def)
      if (values[253] != null) lastTs = values[253]
      out.push({ global: def.global, values })
      o += def.fields.reduce((s, f) => s + f.size, 0) + def.devSize
    }
  }
  return out
}

function readFields(v: DataView, o: number, def: FitDef): Record<number, number> {
  const values: Record<number, number> = {}
  for (const f of def.fields) {
    const b = BASE[f.base]
    if (b && b.size === f.size && o + f.size <= v.byteLength) {
      const x = b.read(v, o, def.le)
      if (x !== b.invalid) values[f.num] = x
    }
    o += f.size
  }
  return values
}

function parseFit(data: ArrayBuffer): ParsedActivity {
  const msgs = readFitMessages(data)
  const session = msgs.find((m) => m.global === 18)?.values
  const records = msgs.filter((m) => m.global === 20 && m.values[253] != null).map((m) => m.values)
  const startTs = session?.[2] ?? records[0]?.[253]
  if (startTs == null) throw new ActivityFileError('File FIT tidak berisi aktivitas.')
  const points: Point[] = records.map((r) => ({
    t: r[253] - startTs, d: r[5] != null ? r[5] / 100 : undefined, hr: r[3], cad: r[4], lat: r[0],
  }))
  const sport = session?.[5]
  const subSport = session?.[6]
  return summarize((startTs + FIT_EPOCH) * 1000, points, {
    kind: sport === 1 ? 'run' : sport === 11 || sport === 17 ? 'walk' : 'other',
    indoor: subSport === 1 || subSport === 45 || !records.some((r) => r[0] != null),
    durationSec: session?.[8] != null ? session[8] / 1000 : session?.[7] != null ? session[7] / 1000 : undefined,
    distanceM: session?.[9] != null ? session[9] / 100 : undefined,
    avgHr: session?.[16], maxHr: session?.[17], cad: session?.[18],
  })
}

// ---------- Ringkasan bersama

function summarize(
  start: number, points: Point[],
  o: { kind: ParsedActivity['kind']; indoor: boolean; durationSec?: number; distanceM?: number; avgHr?: number; maxHr?: number; cad?: number },
): ParsedActivity {
  const last = points[points.length - 1]
  const distanceM = o.distanceM ?? Math.max(0, ...points.map((p) => p.d ?? 0))
  const durationSec = Math.round(o.durationSec ?? last?.t ?? 0)
  if (!durationSec) throw new ActivityFileError('Durasi aktivitas tidak terbaca dari file.')
  const hrs = points.map((p) => p.hr).filter((x): x is number => !!x)
  const cads = points.map((p) => p.cad).filter((x): x is number => !!x)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined)
  const cadPerLeg = o.cad ?? avg(cads)
  return {
    start, distanceM, durationSec, kind: o.kind, indoor: o.indoor,
    avgHr: o.avgHr ?? (hrs.length ? Math.round(avg(hrs)!) : undefined),
    maxHr: o.maxHr ?? (hrs.length ? Math.max(...hrs) : undefined),
    // Jam umumnya mencatat cadence lari per satu kaki; dikali 2 jadi langkah/menit.
    cadence: cadPerLeg ? Math.round(cadPerLeg * 2) : undefined,
    splits: kmSplits(points, distanceM, durationSec),
  }
}

/** Waktu tiap km dari titik (t, d) kumulatif, plus sisa jarak terakhir. */
export function kmSplits(points: Point[], totalM: number, totalSec: number): ParsedActivity['splits'] {
  const pts = points.filter((p) => p.d != null) as (Point & { d: number })[]
  if (pts.length < 2 || totalM < 1000) return []
  const out: ParsedActivity['splits'] = []
  let prevT = 0
  let km = 1
  for (let i = 1; i < pts.length && km * 1000 <= totalM; i++) {
    const a = pts[i - 1], b = pts[i]
    while (b.d >= km * 1000 && a.d < km * 1000 + 1e-9) {
      const t = a.t + ((km * 1000 - a.d) / (b.d - a.d || 1)) * (b.t - a.t)
      out.push({ distance: 1000, moving_time: Math.round(t - prevT) })
      prevT = t
      km++
    }
  }
  const rest = totalM - (km - 1) * 1000
  const lastT = pts[pts.length - 1].t
  if (rest > 20 && out.length) out.push({ distance: Math.round(rest), moving_time: Math.round(Math.min(totalSec, lastT) - prevT) })
  return out
}

/** Aktivitas dari file → RunLog. `tzOffsetMin` = selisih zona waktu lokal dari UTC (WIB = 420). */
export function fileToRunLog(a: ParsedActivity, now = Date.now(), tzOffsetMin = -new Date(a.start).getTimezoneOffset()): RunLog {
  const local = new Date(a.start + tzOffsetMin * 60_000).toISOString()
  const type: RunType = a.kind === 'walk' ? 'walk' : a.indoor ? 'treadmill' : 'outdoor'
  return {
    id: `file-${Math.round(a.start / 1000)}`,
    date: local.slice(0, 10),
    time: local.slice(11, 16),
    type,
    distanceKm: Math.round(a.distanceM / 10) / 100,
    durationSec: a.durationSec,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    cadence: a.cadence,
    splits: formatSplits(a.splits),
    notes: 'Impor dari file',
    createdAt: now,
    updatedAt: now,
  }
}

export interface FileImportResult { added: RunLog[]; skipped: { name: string; reason: string }[] }

/** Baca beberapa file sekaligus; lewati yang gagal, bukan lari/jalan, atau sudah tercatat. */
export async function importActivityFiles(
  files: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }[],
  existing: RunLog[],
  save: (r: RunLog) => Promise<unknown>,
): Promise<FileImportResult> {
  const res: FileImportResult = { added: [], skipped: [] }
  const seen = [...existing]
  for (const f of files) {
    try {
      const a = parseActivityFile(f.name, await f.arrayBuffer())
      if (a.kind === 'other') { res.skipped.push({ name: f.name, reason: 'bukan lari atau jalan' }); continue }
      const r = fileToRunLog(a)
      if (isDuplicate(r, seen)) { res.skipped.push({ name: f.name, reason: 'sudah tercatat' }); continue }
      await save(r)
      seen.push(r)
      res.added.push(r)
    } catch (e) {
      res.skipped.push({ name: f.name, reason: e instanceof ActivityFileError ? e.message : 'file tidak bisa dibaca' })
    }
  }
  return res
}
