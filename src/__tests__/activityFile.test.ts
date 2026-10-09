import { describe, expect, it } from 'vitest'
import { fileToRunLog, importActivityFiles, kmSplits, parseActivityFile, readFitMessages } from '../lib/activityFile'
import type { RunLog } from '../lib/types'

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
const WIB = 420

// Lari luar 2 km: titik tiap ~100 m ke utara (0,0009° lintang ≈ 100 m), 40 detik per titik.
function gpx(type = 'running') {
  const pts = Array.from({ length: 21 }, (_, i) => {
    const t = new Date(Date.UTC(2026, 9, 10, 23, 30) + i * 40_000).toISOString()
    return `<trkpt lat="${(-6.2 + i * 0.0009).toFixed(4)}" lon="106.8"><ele>10</ele><time>${t}</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${130 + i}</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>`
  }).join('\n')
  return `<?xml version="1.0"?><gpx version="1.1" creator="Huawei"><trk><name>Lari pagi</name><type>${type}</type><trkseg>${pts}</trkseg></trk></gpx>`
}

const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
<Activities><Activity Sport="Running"><Id>2026-10-08T11:00:00Z</Id>
<Lap StartTime="2026-10-08T11:00:00Z"><TotalTimeSeconds>1500</TotalTimeSeconds><DistanceMeters>3500</DistanceMeters>
<AverageHeartRateBpm><Value>138</Value></AverageHeartRateBpm><Track>
${[0, 1000, 2000, 3000, 3500].map((d, i) => `<Trackpoint><Time>${new Date(Date.UTC(2026, 9, 8, 11) + [0, 430, 860, 1290, 1500][i] * 1000).toISOString()}</Time><DistanceMeters>${d}</DistanceMeters><HeartRateBpm><Value>${[120, 135, 140, 142, 145][i]}</Value></HeartRateBpm><Extensions><ns3:TPX><ns3:RunCadence>79</ns3:RunCadence></ns3:TPX></Extensions></Trackpoint>`).join('\n')}
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`

/** Penyusun file FIT kecil untuk tes: satu definisi + data per pesan. */
function fit(msgs: { global: number; fields: [num: number, base: number, value: number][] }[]): ArrayBuffer {
  const SIZE: Record<number, number> = { 0: 1, 2: 1, 4: 2, 6: 4, 0x84: 2, 0x86: 4 }
  const bytes: number[] = []
  const le = (n: number, size: number) => { for (let i = 0; i < size; i++) bytes.push((n >>> (8 * i)) & 0xff) }
  msgs.forEach((m, i) => {
    const local = i % 16
    bytes.push(0x40 | local, 0, 0); le(m.global, 2); bytes.push(m.fields.length)
    for (const [num, base] of m.fields) bytes.push(num, SIZE[base], base)
    bytes.push(local)
    for (const [, base, value] of m.fields) le(value, SIZE[base])
  })
  const header = [14, 0x20, 0, 0, ...[0, 1, 2, 3].map((i) => (bytes.length >>> (8 * i)) & 0xff), 46, 70, 73, 84, 0, 0]
  return new Uint8Array([...header, ...bytes, 0, 0]).buffer
}
const FIT_EPOCH = 631_065_600
const fitTs = (iso: string) => Date.parse(iso) / 1000 - FIT_EPOCH

describe('impor file jam', () => {
  it('GPX: jarak dari koordinat, durasi, HR, cadence, split per km', () => {
    const a = parseActivityFile('lari.gpx', enc(gpx()))
    expect(a.kind).toBe('run')
    expect(a.indoor).toBe(false)
    expect(a.durationSec).toBe(800)
    expect(a.distanceM).toBeGreaterThan(1990)
    expect(a.distanceM).toBeLessThan(2020)
    expect(a.maxHr).toBe(150)
    expect(a.cadence).toBe(160)
    expect(a.splits.length).toBe(2)
    const r = fileToRunLog(a, 1, WIB)
    // 23:30 UTC = 06:30 WIB keesokan harinya.
    expect(r).toMatchObject({ date: '2026-10-11', time: '06:30', type: 'outdoor', distanceKm: 2.0, avgHr: 140 })
  })

  it('GPX jalan kaki tercatat sebagai jalan', () => {
    expect(fileToRunLog(parseActivityFile('a.gpx', enc(gpx('walking'))), 1, WIB).type).toBe('walk')
  })

  it('TCX: memakai total lap, tanpa GPS = treadmill', () => {
    const r = fileToRunLog(parseActivityFile('lari.tcx', enc(tcx)), 1, WIB)
    expect(r).toMatchObject({ date: '2026-10-08', time: '18:00', type: 'treadmill', distanceKm: 3.5, durationSec: 1500, avgHr: 136, maxHr: 145, cadence: 158 })
    expect(r.splits).toBe('7:10, 7:10, 7:10, sisa 0,50 km 3:30')
  })

  it('FIT: membaca sesi (waktu, jarak, HR, treadmill) dan record', () => {
    const start = fitTs('2026-10-05T11:08:00Z')
    const data = fit([
      { global: 0, fields: [[0, 0, 4]] }, // file_id: activity
      ...[0, 1000, 2000].map((d, i) => ({ global: 20, fields: [[253, 0x86, start + i * 450], [5, 0x86, d * 100], [3, 2, 140 + i]] as [number, number, number][] })),
      { global: 18, fields: [[2, 0x86, start], [8, 0x86, 900_000], [7, 0x86, 905_000], [9, 0x86, 200_000], [16, 2, 143], [17, 2, 158], [18, 2, 79], [5, 0, 1], [6, 0, 1]] },
    ])
    expect(readFitMessages(data).map((m) => m.global)).toEqual([0, 20, 20, 20, 18])
    const r = fileToRunLog(parseActivityFile('5okt.FIT', data), 1, WIB)
    expect(r).toMatchObject({ id: `file-${Date.parse('2026-10-05T11:08:00Z') / 1000}`, date: '2026-10-05', time: '18:08', type: 'treadmill', distanceKm: 2, durationSec: 900, avgHr: 143, maxHr: 158, cadence: 158 })
    expect(r.splits).toBe('7:30, 7:30')
  })

  it('file bukan aktivitas ditolak dengan pesan jelas', () => {
    expect(() => parseActivityFile('foto.jpg', enc('xxxx'))).toThrow(/Format tidak dikenali/)
    expect(() => parseActivityFile('x.fit', enc('bukan file fit sama sekali'))).toThrow(/Bukan file FIT/)
  })

  it('split per km dengan interpolasi', () => {
    expect(kmSplits([{ t: 0, d: 0 }, { t: 600, d: 1500 }], 1500, 600)).toEqual([{ distance: 1000, moving_time: 400 }, { distance: 500, moving_time: 200 }])
  })

  it('impor beberapa file: lewati duplikat dan yang gagal', async () => {
    const saved: RunLog[] = []
    const existing = [{ id: 'm', date: '2026-10-08', distanceKm: 3.48 } as RunLog]
    const f = (name: string, s: string) => ({ name, arrayBuffer: async () => enc(s) })
    const res = await importActivityFiles([f('a.gpx', gpx()), f('b.tcx', tcx), f('c.gpx', gpx()), f('d.txt', 'halo')], existing, async (r) => { saved.push(r) })
    expect(saved.length).toBe(1)
    expect(res.added.map((r) => r.type)).toEqual(['outdoor'])
    expect(res.skipped.map((s) => s.reason)).toEqual(['sudah tercatat', 'sudah tercatat', expect.stringMatching(/Format/)])
  })
})
