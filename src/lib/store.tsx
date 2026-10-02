import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_PROFILE } from '../data/plan'
import * as repo from './db'
import type { DailyLog, GymLog, Profile, RunLog, SessionMark } from './types'

interface Data {
  ready: boolean
  profile: Profile
  runs: RunLog[]
  daily: DailyLog[]
  gym: GymLog[]
  marks: SessionMark[]
  lastExportAt?: number
  refresh: () => Promise<void>
}

const Ctx = createContext<Data | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Data, 'refresh'>>({
    ready: false, profile: DEFAULT_PROFILE, runs: [], daily: [], gym: [], marks: [],
  })

  const refresh = useCallback(async () => {
    const [profile, runs, daily, gym, marks, lastExportAt] = await Promise.all([
      repo.getProfile(), repo.listRuns(), repo.listDaily(), repo.listGym(), repo.listMarks(), repo.getLastExportAt(),
    ])
    setState({ ready: true, profile, runs, daily, gym, marks, lastExportAt })
  }, [])

  useEffect(() => {
    repo.seedIfEmpty().then(refresh)
    // Minta penyimpanan persisten supaya browser tidak menghapus data saat ruang penuh.
    navigator.storage?.persist?.().catch(() => {})
  }, [refresh])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData di luar DataProvider')
  return v
}
