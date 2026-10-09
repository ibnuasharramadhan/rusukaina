import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from './motion'

export type Route = 'hari-ini' | 'jadwal' | 'catat' | 'progres' | 'info'
const ROUTES: Route[] = ['hari-ini', 'jadwal', 'catat', 'progres', 'info']

/** Router hash sederhana: "#/catat?tab=gym&date=2026-10-05". Hash dipakai supaya jalan di hosting statis mana pun. */
export function parseHash(hash: string): { route: Route; params: URLSearchParams } {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'hari-ini'
  return { route, params: new URLSearchParams(query) }
}

export function useHashRoute() {
  const [loc, setLoc] = useState(() => parseHash(location.hash))
  const current = useRef(loc.route)
  useEffect(() => {
    const on = () => {
      const next = parseHash(location.hash)
      const apply = () => {
        flushSync(() => setLoc(next))
        window.scrollTo(0, 0)
      }
      // Pindah halaman = transisi geser ke kiri/kanan; perubahan di halaman yang sama (mis. tab Lari/Gym) langsung saja.
      const from = current.current
      current.current = next.route
      if (from === next.route) return apply()
      withViewTransition(apply, ROUTES.indexOf(next.route) > ROUTES.indexOf(from) ? 'forward' : 'back')
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return loc
}

export function href(route: Route, params?: Record<string, string>): string {
  const q = params ? `?${new URLSearchParams(params)}` : ''
  return `#/${route}${q}`
}
