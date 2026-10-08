import { BarChart, LineChart } from '../components/charts'
import { Card, PageHeader, Stat } from '../components/ui'
import { weekOf } from '../data/plan'
import { addDays, today } from '../lib/date'
import { formatPace, metersPerBeat, paceSecPerKm } from '../lib/pace'
import { adherence, bpAverage, weekStats } from '../lib/stats'
import { useData } from '../lib/store'

const C = { s1: 'var(--series-1)', s2: 'var(--series-2)' }

export function Progress() {
  const { runs, daily, gym, marks, profile } = useData()
  const t = today()
  const ws = weekStats(runs, gym, marks)
  const currentNo = weekOf(t)?.no
  const easy = runs.filter((r) => r.type !== 'race')
  const totalKm = runs.reduce((a, r) => a + r.distanceKm, 0)
  const { planned, done } = adherence(runs, gym, marks, t)
  const avg7 = bpAverage(daily, 7, t)
  const hrRows = daily.filter((d) => d.restingHr && d.date >= addDays(t, -6) && d.date <= t)
  const hr7 = hrRows.length ? Math.round(hrRows.reduce((a, d) => a + d.restingHr!, 0) / hrRows.length) : null
  const withHr = easy.filter((r) => r.avgHr)

  return (
    <div className="page">
      <PageHeader eyebrow={currentNo ? `Minggu ${currentNo} dari 10` : 'Ringkasan'} title="Progres" />
      <div className="stats grid4">
        <Stat label="Total jarak" value={`${totalKm.toFixed(1).replace('.', ',')} km`} sub={`${runs.length} lari`} />
        <Stat label="Sesi gym" value={gym.length} />
        <Stat label="Konsistensi" value={planned ? `${Math.round((done / planned) * 100)}%` : '–'} sub={`${done}/${planned} sesi`} />
        {profile.trackBp
          ? <Stat label="Tensi 7 hari" value={avg7 ? `${avg7.sys}/${avg7.dia}` : '–'} sub={avg7 ? `${avg7.n} pengukuran` : 'belum ada'} />
          : <Stat label="HR istirahat 7 hari" value={hr7 ?? '–'} sub={hr7 ? `batas ${profile.restingHrBaseline + 7}` : 'belum ada'} />}
      </div>

      {profile.trackBp && <Card title="Tekanan darah (pagi)">
        <p className="muted small">Target dokter umumnya &lt;130–140. Garis 140 = batas kuning, 160 = jangan latihan.</p>
        <LineChart
          series={[
            { name: 'Sistolik', color: C.s1, points: daily.filter((d) => d.sys).map((d) => ({ x: d.date, y: d.sys! })) },
            { name: 'Diastolik', color: C.s2, points: daily.filter((d) => d.dia).map((d) => ({ x: d.date, y: d.dia! })) },
          ]}
          refs={[{ y: 140, label: '140', tone: 'warn' }, { y: 160, label: '160', tone: 'bad' }, { y: 90, label: '90', tone: 'warn' }]}
          empty="Catat tensi di tab Catat › Tensi & HR."
        />
      </Card>}

      <Card title="HR istirahat">
        <p className="muted small">Naik ≥{profile.restingHrBaseline + 7} = kurang pulih. Turun pelan-pelan = jantung makin efisien.</p>
        <LineChart
          series={[{ name: 'HR istirahat', color: C.s1, points: daily.filter((d) => d.restingHr).map((d) => ({ x: d.date, y: d.restingHr! })) }]}
          refs={[{ y: profile.restingHrBaseline + 7, label: String(profile.restingHrBaseline + 7), tone: 'warn' }]}
        />
      </Card>

      <Card title="Pace lari (/km)">
        <p className="muted small">Makin atas makin cepat. Pace easy akan turun sendiri dalam 6–10 minggu kalau HR dijaga.</p>
        <LineChart
          invert
          yFormat={(v) => formatPace(v)}
          series={[{ name: 'Pace', color: C.s1, points: runs.map((r) => ({ x: r.date, y: paceSecPerKm(r.distanceKm, r.durationSec)! })) }]}
        />
      </Card>

      <Card title="HR rata-rata saat lari">
        <LineChart
          series={[{ name: 'HR rata-rata', color: C.s1, points: withHr.map((r) => ({ x: r.date, y: r.avgHr! })) }]}
          refs={[{ y: profile.easyCap, label: String(profile.easyCap), tone: 'warn' }]}
        />
      </Card>

      <Card title="Efisiensi aerobik">
        <p className="muted small">Meter per detak jantung (jarak ÷ total detak). Naik = stamina membaik: lebih jauh dengan detak yang sama.</p>
        <LineChart
          yFormat={(v) => v.toFixed(2).replace('.', ',')}
          series={[{ name: 'm/detak', color: C.s1, points: withHr.map((r) => ({ x: r.date, y: metersPerBeat(r.distanceKm, r.durationSec, r.avgHr!)! })) }]}
        />
      </Card>

      <Card title="Sesi selesai per minggu">
        <p className="muted small">Batang = sesi selesai, garis tipis = sesi di rencana.</p>
        <BarChart unit="sesi" bars={ws.map((w) => ({ label: String(w.no), value: w.done, target: w.planned, highlight: w.no === currentNo }))} />
      </Card>

      <Card title="Jarak lari per minggu (km)">
        <BarChart unit="km" bars={ws.map((w) => ({ label: String(w.no), value: w.km, highlight: w.no === currentNo }))} />
      </Card>
    </div>
  )
}
