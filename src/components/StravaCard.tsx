import { useState } from 'react'
import { connectStrava, disconnectStrava, stravaConfigured } from '../lib/strava'
import { useData } from '../lib/store'
import { Card } from './ui'

function ago(sec?: number): string {
  if (!sec) return 'belum pernah'
  const d = new Date(sec * 1000)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Hubungkan Strava (jembatan dari Huawei Health) dan sinkron lari. */
export function StravaCard() {
  const { strava, stravaMsg, stravaBusy, syncStrava, refresh } = useData()
  const [confirm, setConfirm] = useState(false)
  if (!stravaConfigured) return null
  return (
    <Card title="Sinkron Strava">
      {strava ? (
        <>
          <p className="small">
            Terhubung{strava.athleteName ? ` sebagai ${strava.athleteName}` : ''}. Lari baru diambil otomatis tiap aplikasi dibuka.
            <br /><span className="muted">Aktivitas terakhir yang diambil: {ago(strava.lastSyncAt)}</span>
          </p>
          <div className="row wrap">
            <button className="btn primary" onClick={syncStrava} disabled={stravaBusy}>{stravaBusy ? 'Menyinkronkan…' : 'Sinkron sekarang'}</button>
            {confirm ? (
              <>
                <button className="btn danger" onClick={async () => { await disconnectStrava(); await refresh(); setConfirm(false) }}>Ya, putuskan</button>
                <button className="btn ghost" onClick={() => setConfirm(false)}>Batal</button>
              </>
            ) : (
              <button className="link danger" onClick={() => setConfirm(true)}>Putuskan</button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="small">Lari dari jam (Huawei, Garmin, Coros, dll.) bisa masuk otomatis lewat Strava. Contoh di app Huawei Health: <b>Saya › Privasi › Berbagi data › Strava</b>, lalu hubungkan Strava di sini.</p>
          <button className="btn primary" onClick={connectStrava}>Hubungkan Strava</button>
        </>
      )}
      {stravaMsg && <p role="status" className="small">{stravaMsg}</p>}
    </Card>
  )
}
