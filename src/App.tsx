import { Icon, type IconName } from './components/icons'
import { UpdatePrompt } from './components/UpdatePrompt'
import { href, useHashRoute, type Route } from './lib/router'
import { useData } from './lib/store'
import { Info } from './pages/Info'
import { Log } from './pages/Log'
import { Progress } from './pages/Progress'
import { Schedule } from './pages/Schedule'
import { Today } from './pages/Today'

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: 'hari-ini', label: 'Hari ini', icon: 'today' },
  { route: 'jadwal', label: 'Jadwal', icon: 'calendar' },
  { route: 'catat', label: 'Catat', icon: 'plus' },
  { route: 'progres', label: 'Progres', icon: 'trend' },
  { route: 'info', label: 'Info', icon: 'info' },
]

function Skeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Memuat">
      <div className="skel" style={{ height: 64 }} />
      <div className="skel" style={{ height: 150 }} />
      <div className="skel" style={{ height: 190 }} />
    </div>
  )
}

export function App() {
  const { ready } = useData()
  const { route, params } = useHashRoute()
  return (
    <div className="app">
      <main key={route} className="route">
        {!ready ? <Skeleton />
          : route === 'jadwal' ? <Schedule />
          : route === 'catat' ? <Log params={params} />
          : route === 'progres' ? <Progress />
          : route === 'info' ? <Info />
          : <Today />}
      </main>
      <nav className="tabbar" aria-label="Navigasi utama">
        {NAV.map((n) => (
          <a key={n.route} href={href(n.route)} className={`${route === n.route ? 'on' : ''} ${n.route === 'catat' ? 'fab' : ''}`} aria-current={route === n.route ? 'page' : undefined}>
            <span className="ti"><Icon name={n.icon} size={n.route === 'catat' ? 24 : 22} /></span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  )
}
