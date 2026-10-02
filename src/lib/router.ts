import { useEffect, useState } from 'react'

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
  useEffect(() => {
    const on = () => {
      setLoc(parseHash(location.hash))
      window.scrollTo(0, 0)
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
