// Grafik SVG ringan tanpa library: garis (deret waktu) dan batang (per minggu).
// Spesifikasi: garis 2px, marker r=4 dengan ring warna permukaan, grid hairline,
// legenda untuk ≥2 seri, tooltip saat hover/tap, dan tampilan tabel.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { diffDays, formatDate, type ISODate } from '../lib/date'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  let v = Math.floor(min / step) * step
  out.push(Math.round(v * 1000) / 1000)
  while (v < max - 1e-9) {
    v += step
    out.push(Math.round(v * 1000) / 1000)
  }
  return out
}

export interface Series {
  name: string
  color: string
  points: { x: ISODate; y: number }[]
}

interface Ref { y: number; label: string; tone?: 'warn' | 'bad' }

const PAD = { t: 12, r: 44, b: 26, l: 40 }

export function LineChart(props: {
  series: Series[]
  refs?: Ref[]
  height?: number
  yFormat?: (v: number) => string
  /** true = nilai kecil di atas (mis. pace: makin kecil makin cepat). */
  invert?: boolean
  yDomain?: [number, number]
  empty?: ReactNode
}) {
  const { series, refs = [], height = 200, yFormat = (v) => String(Math.round(v)), invert } = props
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<ISODate | null>(null)
  const [table, setTable] = useState(false)

  const all = series.flatMap((s) => s.points)
  if (!all.length) return <div className="chart-empty">{props.empty ?? 'Belum ada data.'}</div>

  const xs = [...new Set(all.map((p) => p.x))].sort()
  const x0 = xs[0]
  const span = Math.max(1, diffDays(x0, xs[xs.length - 1]))
  const ys = [...all.map((p) => p.y), ...refs.map((r) => r.y)]
  let [ymin, ymax] = props.yDomain ?? [Math.min(...ys), Math.max(...ys)]
  const padY = (ymax - ymin) * 0.08 || Math.max(Math.abs(ymax) * 0.08, 1)
  ymin -= padY
  ymax += padY
  const ticks = niceTicks(ymin, ymax)
  ymin = Math.min(ymin, ticks[0])
  ymax = Math.max(ymax, ticks[ticks.length - 1])

  const iw = width - PAD.l - PAD.r
  const ih = height - PAD.t - PAD.b
  const sx = (d: ISODate) => PAD.l + (xs.length === 1 ? iw / 2 : (diffDays(x0, d) / span) * iw)
  const sy = (v: number) => {
    const t = (v - ymin) / (ymax - ymin)
    return PAD.t + (invert ? t : 1 - t) * ih
  }

  // Label sumbu-x: awal, akhir, dan beberapa di tengah yang tidak bertabrakan.
  const xLabels: ISODate[] = []
  for (const d of xs) {
    if (!xLabels.length || sx(d) - sx(xLabels[xLabels.length - 1]) > 56) xLabels.push(d)
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left + PAD.l
    let best = xs[0]
    for (const d of xs) if (Math.abs(sx(d) - px) < Math.abs(sx(best) - px)) best = d
    setHover(best)
  }

  const hoverRows = hover ? series.map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((r) => r.p) : []
  const tipLeft = hover ? Math.min(Math.max(sx(hover) - 70, 0), width - 140) : 0

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
      {table ? (
        <DataTable series={series} yFormat={yFormat} />
      ) : (
        <div className="chart-plot">
          <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(', ')}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={width - PAD.r} y1={sy(t)} y2={sy(t)} className="grid" />
                <text x={PAD.l - 6} y={sy(t)} className="axis" textAnchor="end" dominantBaseline="middle">{yFormat(t)}</text>
              </g>
            ))}
            {refs.map((r) => (
              <g key={r.label}>
                <line x1={PAD.l} x2={width - PAD.r} y1={sy(r.y)} y2={sy(r.y)} className={`ref ${r.tone ?? ''}`} />
                <text x={width - PAD.r + 4} y={sy(r.y)} className="axis" dominantBaseline="middle">{r.label}</text>
              </g>
            ))}
            {xLabels.map((d) => (
              <text key={d} x={sx(d)} y={height - 6} className="axis" textAnchor="middle">{formatDate(d)}</text>
            ))}
            {hover && <line x1={sx(hover)} x2={sx(hover)} y1={PAD.t} y2={PAD.t + ih} className="crosshair" />}
            {series.map((s) => {
              const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x))
              const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
              const last = pts[pts.length - 1]
              return (
                <g key={s.name}>
                  <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p) => (
                    <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={p.x === hover || p === last ? 5 : 3.5} fill={s.color} className="dot" />
                  ))}
                </g>
              )
            })}
            <rect
              x={PAD.l} y={PAD.t} width={iw} height={ih} fill="transparent"
              onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hover && hoverRows.length > 0 && (
            <div className="tooltip" style={{ left: tipLeft }}>
              <b>{formatDate(hover, true)}</b>
              {hoverRows.map(({ s, p }) => (
                <div key={s.name}><i style={{ background: s.color }} />{s.name}: <b>{yFormat(p!.y)}</b></div>
              ))}
            </div>
          )}
        </div>
      )}
      <button className="link small" onClick={() => setTable(!table)}>{table ? 'Lihat grafik' : 'Lihat tabel'}</button>
    </div>
  )
}

function DataTable({ series, yFormat }: { series: Series[]; yFormat: (v: number) => string }) {
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort().reverse()
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>
          {xs.map((x) => (
            <tr key={x}>
              <td>{formatDate(x, true)}</td>
              {series.map((s) => {
                const p = s.points.find((q) => q.x === x)
                return <td key={s.name}>{p ? yFormat(p.y) : '–'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BarChart(props: {
  bars: { label: string; value: number; target?: number; highlight?: boolean }[]
  height?: number
  unit?: string
}) {
  const { bars, height = 180, unit = '' } = props
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value, b.target ?? 0)))
  const ticks = niceTicks(0, max, 3)
  const top = ticks[ticks.length - 1]
  const pad = { t: 16, r: 8, b: 24, l: 32 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const band = iw / bars.length
  const bw = Math.min(24, band * 0.6)
  const sy = (v: number) => pad.t + ih - (v / top) * ih

  return (
    <div className="chart" ref={ref}>
      <div className="chart-plot">
        <svg width={width} height={height} role="img" aria-label="Volume per minggu">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={pad.l - 6} y={sy(t)} className="axis" textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = pad.l + band * i + band / 2
            const h = Math.max(0, sy(0) - sy(b.value))
            const r = Math.min(4, h)
            const x = cx - bw / 2
            const y = sy(b.value)
            // Ujung data membulat 4px, pangkal di baseline tetap siku.
            const d = h > 0
              ? `M${x},${sy(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${sy(0)}Z`
              : ''
            return (
              <g key={b.label} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
                {b.target != null && b.target > 0 && (
                  <line x1={x - 3} x2={x + bw + 3} y1={sy(b.target)} y2={sy(b.target)} className="target" />
                )}
                {d && <path d={d} className={b.highlight ? 'bar now' : 'bar'} />}
                {b.value > 0 && (hover === i || b.highlight) && (
                  <text x={cx} y={y - 4} className="axis value" textAnchor="middle">{b.value}</text>
                )}
                <text x={cx} y={height - 6} className="axis" textAnchor="middle">{b.label}</text>
              </g>
            )
          })}
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: Math.min(Math.max(pad.l + band * hover - 50, 0), width - 140) }}>
            <b>Minggu {bars[hover].label}</b>
            <div>{bars[hover].value} {unit}{bars[hover].target ? ` dari target ±${bars[hover].target}` : ''}</div>
          </div>
        )}
      </div>
    </div>
  )
}
