import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import type { Level } from '../lib/safety'
import type { SessionKind } from '../lib/types'

export const LEVEL_LABEL: Record<Level, string> = {
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

/** Ikon, label pendek, dan warna (kelas CSS k-*) per jenis sesi. */
export const KIND: Record<SessionKind, { icon: IconName; label: string; tone: 'run' | 'gym' | 'walk' | 'rest' | 'race' }> = {
  gymA: { icon: 'dumbbell', label: 'Gym A', tone: 'gym' },
  gymB: { icon: 'dumbbell', label: 'Gym B', tone: 'gym' },
  easy: { icon: 'route', label: 'Lari easy', tone: 'run' },
  long: { icon: 'route', label: 'Long run', tone: 'run' },
  walk: { icon: 'walk', label: 'Jalan', tone: 'walk' },
  rest: { icon: 'moon', label: 'Pemulihan', tone: 'rest' },
  race: { icon: 'flag', label: 'Race', tone: 'race' },
}

export function KindIcon({ kind, size = 18 }: { kind: SessionKind; size?: number }) {
  return (
    <span className={`kind-ico t-${KIND[kind].tone}`} aria-hidden>
      <Icon name={KIND[kind].icon} size={size} />
    </span>
  )
}

/** Judul halaman: label kecil di atas + judul besar. */
export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-h">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </header>
  )
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
