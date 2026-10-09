import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { LEGACY_PROFILE, planFor, setActivePlan } from '../data/plan'
import * as repo from './db'
import * as strava from './strava'
import type { DailyLog, GymLog, Profile, RunLog, SessionMark } from './types'

interface Data {
  ready: boolean
  /** HP baru tanpa profil: tampilkan onboarding. */
  needsOnboarding: boolean
  profile: Profile
  /** Lari saja (tanpa jalan kaki). */
  runs: RunLog[]
  walks: RunLog[]
  daily: DailyLog[]
  gym: GymLog[]
  marks: SessionMark[]
  lastExportAt?: number
  /** Status Strava: undefined = belum terhubung. */
  strava?: strava.StravaAuth
  stravaMsg: string
  stravaBusy: boolean
  syncStrava: () => Promise<void>
  refresh: () => Promise<void>
}

type State = Omit<Data, 'refresh' | 'syncStrava' | 'stravaMsg' | 'stravaBusy'>

const Ctx = createContext<Data | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    ready: false, needsOnboarding: false, profile: LEGACY_PROFILE, runs: [], walks: [], daily: [], gym: [], marks: [],
  })
  const [stravaMsg, setStravaMsg] = useState('')
  const [stravaBusy, setStravaBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [profile, activities, daily, gym, marks, lastExportAt, stravaAuth] = await Promise.all([
      repo.getProfile(), repo.listRuns(), repo.listDaily(), repo.listGym(), repo.listMarks(), repo.getLastExportAt(), strava.getStravaAuth(),
    ])
    setActivePlan(planFor(profile ?? LEGACY_PROFILE))
    setState({ ready: true, needsOnboarding: !profile, profile: profile ?? LEGACY_PROFILE,
      runs: activities.filter((r) => r.type !== 'walk'), walks: activities.filter((r) => r.type === 'walk'), daily, gym, marks, lastExportAt, strava: stravaAuth })
  }, [])

  const syncStrava = useCallback(async () => {
    setStravaBusy(true)
    try {
      const res = await strava.syncStrava(await repo.listRuns())
      setStravaMsg(res.added ? `${res.added} lari baru dari Strava.` : 'Tidak ada lari baru di Strava.')
    } catch (e) {
      setStravaMsg((e as Error).message)
    } finally {
      setStravaBusy(false)
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    ;(async () => {
      const msg = await strava.handleStravaRedirect()
      if (msg) setStravaMsg(msg)
      await refresh()
      // Sinkron otomatis tiap aplikasi dibuka, kalau Strava terhubung dan sedang online.
      if (strava.stravaConfigured && navigator.onLine && (await strava.getStravaAuth())) await syncStrava()
    })()
    // Minta penyimpanan persisten supaya browser tidak menghapus data saat ruang penuh.
    navigator.storage?.persist?.().catch(() => {})
  }, [refresh, syncStrava])

  return <Ctx.Provider value={{ ...state, stravaMsg, stravaBusy, syncStrava, refresh }}>{children}</Ctx.Provider>
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData di luar DataProvider')
  return v
}
