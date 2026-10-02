import type { ReactNode } from 'react'
import type { Level } from '../lib/safety'
import type { SessionKind } from '../lib/types'

const LEVEL_LABEL: Record<Level, string> = {
  green: 'Aman', yellow: 'Hati-hati', red: 'Jangan latihan', critical: 'Hubungi dokter', unknown: 'Belum dicek',
}
const LEVEL_ICON: Record<Level, string> = { green: '✓', yellow: '!', red: '✕', critical: '✕', unknown: '?' }

/** Status selalu pakai ikon + label, tidak hanya warna. */
export function LevelBadge({ level, label }: { level: Level; label?: string }) {
  return (
    <span className={`badge lv-${level}`}>
      <span aria-hidden>{LEVEL_ICON[level]}</span> {label ?? LEVEL_LABEL[level]}
    </span>
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-h">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-l">{label}</div>
      <div className="stat-v">{value}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  )
}

export const KIND_ICON: Record<SessionKind, string> = {
  gymA: '🏋️', gymB: '🏋️', easy: '🏃', long: '🏃‍♂️', walk: '🚶', rest: '😴', race: '🏁',
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      {children}
      {hint && <span className="field-h">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function num(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v.replace(',', '.'))
  return isFinite(n) ? n : undefined
}
