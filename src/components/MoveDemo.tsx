import { useEffect, useState } from 'react'
import { FLOOR, frontBody, mixFront, mixSide, MOVES, sideBody, type Move, type MoveId, type Pt } from '../data/moves'

const L = (a: Pt, b: Pt, cls?: string) => <line className={cls} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
const poly = (...pts: Pt[]) => pts.map((p) => p.join(',')).join(' ')

function reduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 0 → 1 → 0 halus, berhenti sebentar di tiap ujung gerakan. */
function useCycle(ms: number, run: boolean) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = ((now - t0) % ms) / ms
      const tri = p < 0.5 ? p * 2 : 2 - p * 2
      const hold = Math.min(1, Math.max(0, (tri - 0.12) / 0.76))
      setK(0.5 - Math.cos(hold * Math.PI) / 2)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ms, run])
  return k
}

function Held({ at, hold, from }: { at: Pt; hold?: Move['hold']; from?: Pt }) {
  if (hold === 'dumbbell') return <rect className="mv-gear" x={at[0] - 4} y={at[1] - 1.5} width={8} height={3} rx={1.2} />
  if (hold === 'bar') return <rect className="mv-gear" x={at[0] - 7} y={at[1] - 1} width={14} height={2} rx={1} />
  if (hold === 'handle') {
    const d = from ? Math.atan2(at[1] - from[1], at[0] - from[0]) : 0
    const v: Pt = [-Math.sin(d) * 3, Math.cos(d) * 3]
    return <line className="mv-gear" x1={at[0] - v[0]} y1={at[1] - v[1]} x2={at[0] + v[0]} y2={at[1] + v[1]} />
  }
  return null
}

function SideFigure({ move, k }: { move: Extract<Move, { view: 'side' }>; k: number }) {
  const b = sideBody(mixSide(move.a, move.b, k), move.knee)
  return (
    <>
      {move.cable && L(move.cable, b.hand, 'mv-cable')}
      {move.cable && <circle className="mv-gear" cx={move.cable[0]} cy={move.cable[1]} r={2.5} />}
      <g className="mv-far">
        <polyline points={poly(b.hip, b.knee2, b.foot2, b.toe2)} />
        <polyline points={poly(b.shoulder, b.elbow2, b.hand2)} />
      </g>
      <g className="mv-body">
        {L(b.hip, b.shoulder)}
        <polyline points={poly(b.hip, b.knee, b.foot, b.toe)} />
        <polyline points={poly(b.shoulder, b.elbow, b.hand)} />
        <circle className="mv-head" cx={b.head[0]} cy={b.head[1]} r={6} />
      </g>
      {move.pad && <circle className="mv-gear" cx={b.foot[0]} cy={b.foot[1] - 3} r={3} />}
      {move.plate && L([b.foot[0] + 3, b.foot[1] - 10], [b.foot[0] + 3 + 4, b.foot[1] + 12], 'mv-gear')}
      <Held at={b.hand} hold={move.hold} from={b.elbow} />
      {move.hold === 'dumbbell' && (move.a.hand2 || move.b.hand2) && <Held at={b.hand2} hold="dumbbell" />}
    </>
  )
}

function FrontFigure({ move, k }: { move: Extract<Move, { view: 'front' }>; k: number }) {
  const b = frontBody(mixFront(move.a, move.b, k), move.seated)
  return (
    <>
      {move.seated && <rect className="mv-prop-fill" x={44} y={b.pelvis[1] + 1} width={32} height={5} rx={2} />}
      <g className="mv-body">
        {L(b.neck, b.pelvis)}
        {L(b.shoulders[0], b.shoulders[1])}
        {L(b.hips[0], b.hips[1])}
        {[0, 1].map((i) => (
          <g key={i}>
            <polyline points={poly(b.shoulders[i], b.elbows[i], b.hands[i])} />
            <polyline points={poly(b.hips[i], b.knees[i], b.feet[i])} />
          </g>
        ))}
        <circle className="mv-head" cx={b.head[0]} cy={b.head[1]} r={6} />
      </g>
      {b.hands.map((h, i) => <Held key={i} at={h} hold={move.hold} from={b.elbows[i]} />)}
    </>
  )
}

/** Animasi satu gerakan. Kalau pengguna memilih kurangi gerakan, tampil diam di pose akhir. */
export function MoveFigure({ id, className, at }: { id: MoveId; className?: string; at?: number }) {
  const move: Move = MOVES[id]
  const still = at !== undefined || reduced()
  const cyc = useCycle(move.ms ?? 2400, !still)
  const k = at ?? (still ? 1 : cyc)
  return (
    <svg className={`mv ${className ?? ''}`} viewBox="0 0 120 100" role="img" aria-label={`Animasi ${move.label}`}>
      <line className="mv-floor" x1={4} y1={FLOOR} x2={116} y2={FLOOR} />
      {move.props?.map(([x1, y1, x2, y2], i) => <line key={i} className="mv-prop" x1={x1} y1={y1} x2={x2} y2={y2} />)}
      {move.view === 'side' ? <SideFigure move={move} k={k} /> : <FrontFigure move={move} k={k} />}
    </svg>
  )
}

export function MoveDemo({ id }: { id: MoveId }) {
  const move: Move = MOVES[id]
  return (
    <div className="move-demo">
      <MoveFigure id={id} />
      <ol className="small">{move.how.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  )
}

/** Tombol kecil "Cara gerak" yang membuka animasi dan langkahnya. Tidak tampil kalau gerakan tidak dikenal. */
export function MoveToggle({ id, name }: { id?: MoveId; name: string }) {
  const [open, setOpen] = useState(false)
  if (!id) return null
  return (
    <>
      <button type="button" className="link small mv-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Tutup' : 'Cara gerak'}<span className="sr-only"> {name}</span>
      </button>
      {open && <MoveDemo id={id} />}
    </>
  )
}
