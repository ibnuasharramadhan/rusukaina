import { UpdatePrompt } from './components/UpdatePrompt'
import { href, useHashRoute, type Route } from './lib/router'
import { useData } from './lib/store'
import { Info } from './pages/Info'
import { Log } from './pages/Log'
import { Progress } from './pages/Progress'
import { Schedule } from './pages/Schedule'
import { Today } from './pages/Today'

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: 'hari-ini', label: 'Hari ini', icon: '☀︎' },
  { route: 'jadwal', label: 'Jadwal', icon: '▦' },
  { route: 'catat', label: 'Catat', icon: '＋' },
  { route: 'progres', label: 'Progres', icon: '↗' },
  { route: 'info', label: 'Info', icon: 'ⓘ' },
]

export function App() {
  const { ready } = useData()
  const { route, params } = useHashRoute()
  return (
    <div className="app">
      <main>
        {!ready ? <div className="page muted">Memuat…</div>
          : route === 'jadwal' ? <Schedule />
          : route === 'catat' ? <Log params={params} />
          : route === 'progres' ? <Progress />
          : route === 'info' ? <Info />
          : <Today />}
      </main>
      <nav className="tabbar" aria-label="Navigasi utama">
        {NAV.map((n) => (
          <a key={n.route} href={href(n.route)} className={route === n.route ? 'on' : ''} aria-current={route === n.route ? 'page' : undefined}>
            <span className="ti" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  )
}
