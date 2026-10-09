// Gerak: transisi halaman, angka berjalan, dan perayaan kecil.
// Semua mati kalau HP minta "kurangi gerakan".

import { useEffect, useRef, useState } from 'react'

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

type VTDocument = Document & { startViewTransition?: (cb: () => void) => unknown }

/** Jalankan perubahan DOM di dalam View Transition kalau browser mendukung. */
export function withViewTransition(update: () => void, direction?: 'forward' | 'back') {
  const doc = document as VTDocument
  if (!doc.startViewTransition || reducedMotion()) return update()
  if (direction) document.documentElement.dataset.nav = direction
  doc.startViewTransition(update)
}

const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Angka naik dari nilai sebelumnya (awal: 0) ke target. */
export function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(() => (reducedMotion() ? target : 0))
  const from = useRef(v)
  useEffect(() => {
    if (reducedMotion()) { setV(target); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const cur = a + (target - a) * easeOut(p)
      from.current = cur
      setV(cur)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

/** Konfeti singkat dari titik tertentu (default: tengah layar) + getar kecil. */
export function celebrate(origin?: { x: number; y: number }) {
  navigator.vibrate?.(30)
  if (reducedMotion()) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()
  ctx.scale(dpr, dpr)
  const css = getComputedStyle(document.documentElement)
  const colors = ['--accent', '--good', '--gym', '--series-1', '--warning'].map((v) => css.getPropertyValue(v).trim() || '#e8551f')
  const ox = origin?.x ?? W / 2
  const oy = origin?.y ?? H / 2
  const parts = Array.from({ length: 70 }, () => {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = 6 + Math.random() * 7
    return {
      x: ox, y: oy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }
  })
  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    for (const p of parts) {
      p.vy += 0.28
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t / 1600)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (t < 1600) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}

/** Titik tengah elemen yang diklik, untuk asal konfeti. */
export function originOf(e: { currentTarget: Element }): { x: number; y: number } {
  const r = e.currentTarget.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
