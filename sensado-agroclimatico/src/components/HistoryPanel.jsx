import { useEffect, useRef, useState } from 'react'
import { DEVICES, METRICS, metricsFor } from '../data/devices.js'
import { monitoringMode, monitoringService } from '../services/monitoringService.js'
import { Timestamp } from './Reading.jsx'
import { loadHistorySeries, prepareHistorySeries } from './historySeries.js'

const linePatterns = ['', '7 4', '2 4']
const fullDate = (time) => new Date(time).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
const pointText = (item, time) => {
  const point = item.points.find((point) => Date.parse(point.timestamp) === time)
  return `${METRICS[item.metric].label}: ${point ? `${point.value.toLocaleString('es-CO')} ${item.unit}` : 'Sin medición en esta fecha'}`
}

function HistoryChart({ histories }) {
  const [selected, setSelected] = useState(null)
  const chartRef = useRef(null)
  const [width, setWidth] = useState(1000)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)))
    if (chartRef.current) observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])
  const { series, times, axes } = prepareHistorySeries(histories)
  if (!times.length) return <div className="history-empty" role="status">No se registraron mediciones para este periodo.</div>
  const dualAxis = axes.length > 1
  const right = width - (dualAxis ? 58 : 16)
  const plotWidth = right - 64
  const ticks = width < 500 ? [0, 4] : [0, 1, 2, 3, 4]
  const start = Math.min(...series.map((item) => Date.parse(item.from)))
  const end = Math.max(...series.map((item) => Date.parse(item.to)))
  const duration = end - start || 1
  const x = (time) => 64 + (time - start) / duration * plotWidth
  const y = (value, axis) => 254 - (value - axis.low) / (axis.high - axis.low) * 210
  const index = selected === null ? times.length - 1 : Math.min(selected, times.length - 1)
  const activeTime = times[index]
  const description = series.map((item) => pointText(item, activeTime)).join('; ')
  const formatTick = (value) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', ...(duration > 86_400_000 ? { day: '2-digit', month: 'short' } : { hour: '2-digit', minute: '2-digit', hour12: false }) }).format(new Date(value))
  return <div className={`metric-${series[0].metric}`}>
    <div className="chart-summary"><div className="chart-legends">{series.map((item, i) => <span className={`chart-legend metric-${item.metric}`} key={item.metric}><svg width="20" height="10" aria-hidden="true"><line x1="0" x2="20" y1="5" y2="5" stroke="var(--metric-color)" strokeWidth="2.5" strokeDasharray={linePatterns[i]} /></svg>{METRICS[item.metric].label} <small>{item.unit}{!item.points.length && ' · Sin mediciones'}</small></span>)}</div><span>{series.reduce((count, item) => count + item.points.length, 0)} puntos · {series[0].source === 'real' ? 'Datos reales' : 'Datos simulados'}</span></div>
    <div className="chart-inspection" aria-live="polite"><Timestamp value={new Date(activeTime).toISOString()} />{series.map((item) => <span className="series-reading" key={item.metric}>{pointText(item, activeTime)}</span>)}<span>{selected === null ? 'Último punto del periodo' : 'Punto seleccionado'}</span></div>
    <div className="chart-scroll" ref={chartRef}>
      <svg className="history-chart" viewBox={`0 0 ${width} 305`} role="img" aria-label={`Histórico de ${series.map((item) => `${METRICS[item.metric].label} (${item.unit})`).join(', ')}.${dualAxis ? ' Temperatura en el eje izquierdo y humedad en el derecho.' : ''} Use el control bajo el gráfico para consultar cada punto.`}>
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="64" x2={right} y1={44 + i * 210 / 4} y2={44 + i * 210 / 4} stroke="var(--line)" strokeDasharray="3 5" />)}
        {axes.map((axis, axisIndex) => <g className={dualAxis ? `metric-${series.find((item) => item.unit === axis.unit).metric}` : ''} key={axis.unit}>
          <text className={dualAxis ? 'chart-axis-label' : ''} x={axisIndex ? right + 10 : 52} y="20" textAnchor={axisIndex ? 'start' : 'end'}>{axis.unit}</text>
          {axis.low !== null && [0, 1, 2, 3, 4].map((i) => <text className={dualAxis ? 'chart-axis-label' : ''} key={i} x={axisIndex ? right + 10 : 52} y={49 + i * 210 / 4} textAnchor={axisIndex ? 'start' : 'end'}>{(axis.high - i * (axis.high - axis.low) / 4).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</text>)}
        </g>)}
        {ticks.map((i) => <text key={i} x={64 + i * plotWidth / 4} y="285" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{formatTick(start + duration * i / 4)}</text>)}
        <line x1={x(activeTime)} x2={x(activeTime)} y1="44" y2="254" stroke="var(--muted)" strokeDasharray="4 5" opacity=".5" />
        {series.map((item, i) => {
          const axis = axes.find((axis) => axis.unit === item.unit)
          const path = item.points.map((point, j) => `${j ? 'L' : 'M'}${x(Date.parse(point.timestamp))},${y(point.value, axis)}`).join(' ')
          return <g className={`metric-${item.metric}`} key={item.metric}>
            <path d={path} fill="none" stroke="var(--metric-color)" strokeWidth="2.5" strokeDasharray={linePatterns[i]} strokeLinejoin="round" />
            {item.points.map((point) => <circle key={point.timestamp} cx={x(Date.parse(point.timestamp))} cy={y(point.value, axis)} r={Date.parse(point.timestamp) === activeTime ? 5 : 2.5} fill="var(--surface)" stroke="var(--metric-color)" strokeWidth="2"><title>{pointText(item, Date.parse(point.timestamp))} · {fullDate(point.timestamp)}</title></circle>)}
          </g>
        })}
        {times.map((time, i) => <rect key={time} x={i === 0 ? 64 : (x(times[i - 1]) + x(time)) / 2} y="44" width={Math.max(1, (i === times.length - 1 ? right : (x(time) + x(times[i + 1])) / 2) - (i === 0 ? 64 : (x(times[i - 1]) + x(time)) / 2))} height="210" fill="transparent" onPointerEnter={() => setSelected(i)} onPointerDown={() => setSelected(i)}><title>{fullDate(time)} · {series.map((item) => pointText(item, time)).join('; ')}</title></rect>)}
      </svg>
    </div>
    <p className="chart-period"><Timestamp value={new Date(start).toISOString()} /> — <Timestamp value={new Date(end).toISOString()} /> · Bogotá</p>
    <label className="chart-control">Explorar lecturas <input type="range" min="0" max={times.length - 1} value={index} onChange={(event) => setSelected(Number(event.target.value))} aria-label="Punto del histórico" aria-valuetext={`${description}, ${fullDate(activeTime)}`} /><span>Hora de Bogotá · UTC−5</span></label>
    <details className="history-data"><summary>Ver mediciones en tabla</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Datos del histórico"><table><thead><tr><th scope="col">Fecha (Bogotá)</th><th scope="col">Variable</th><th scope="col">Valor</th><th scope="col">Unidad</th></tr></thead><tbody>{series.flatMap((item) => item.points.map((point) => ({ ...point, metric: item.metric, unit: item.unit }))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).map((point) => <tr key={`${point.metric}:${point.timestamp}`}><td><Timestamp value={point.timestamp} /></td><td>{METRICS[point.metric].label}</td><td>{point.value.toLocaleString('es-CO')}</td><td>{point.unit}</td></tr>)}</tbody></table></div></details>
  </div>
}
export default function HistoryPanel() {
  const [deviceId, setDeviceId] = useState(DEVICES[0].device_id)
  const [metric, setMetric] = useState('all')
  const [hours, setHours] = useState(24)
  const [state, setState] = useState({ key: '', data: null, error: '' })
  const [retry, setRetry] = useState(0)
  const device = DEVICES.find((item) => item.device_id === deviceId)
  const queryKey = `${deviceId}:${metric}:${hours}:${retry}`
  const loading = state.key !== queryKey
  useEffect(() => {
    let active = true
    loadHistorySeries(monitoringService, DEVICES.find((item) => item.device_id === deviceId), metric, hours).then((data) => {
      if (active) setState({ key: queryKey, data, error: '' })
    }).catch(() => {
      if (active) setState({ key: queryKey, data: null, error: 'No se pudo cargar el histórico.' })
    })
    return () => { active = false }
  }, [deviceId, metric, hours, queryKey])
  return <section className="panel history" id="historico" aria-labelledby="history-title">
    <div className="section-heading"><div><p className="eyebrow">03 / Evolución de las mediciones</p><h2 id="history-title">Histórico de sensores</h2></div><span className="section-note">{monitoringMode === 'mock' ? 'Datos de demostración' : 'Datos reales'}</span></div>
    <div className="history-filters"><label>Dispositivo<select value={deviceId} onChange={(event) => { const next = DEVICES.find((item) => item.device_id === event.target.value); setDeviceId(next.device_id); setMetric('all') }}>{DEVICES.map((item) => <option key={item.device_id} value={item.device_id}>{item.node}</option>)}</select></label><label>Variable<select value={metric} onChange={(event) => setMetric(event.target.value)}><option value="all">Todas las variables</option>{metricsFor(device).map((key) => <option key={key} value={key}>{METRICS[key].label}</option>)}</select></label><label>Periodo<select value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={6}>Últimas 6 horas</option><option value={24}>Últimas 24 horas</option><option value={168}>Últimos 7 días</option></select></label></div>
    <div className="chart-area" aria-busy={loading}>{loading ? <p className="empty" role="status">Cargando histórico…</p> : state.error ? <div className="empty" role="alert"><p>{state.error}</p><button onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : <HistoryChart key={queryKey} histories={state.data} />}</div>
  </section>
}
