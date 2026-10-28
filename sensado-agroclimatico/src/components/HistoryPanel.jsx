import { useEffect, useState } from 'react'
import { DEVICES, METRICS, metricsFor } from '../data/devices.js'
import { monitoringService } from '../services/monitoringService.js'
import { Timestamp } from './Reading.jsx'

function HistoryChart({ history }) {
  const [selected, setSelected] = useState(null)
  const points = history.points.filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.timestamp))).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  if (!points.length) return <p className="empty">No hay mediciones en este periodo.</p>
  const values = points.map((point) => point.value)
  const min = Math.min(...values), max = Math.max(...values)
  const padding = Math.max((max - min) * .3, 1)
  const low = min - padding, high = max + padding
  const start = Date.parse(history.from), duration = Date.parse(history.to) - start || 1
  const x = (point) => 64 + (Date.parse(point.timestamp) - start) / duration * 870
  const y = (point) => 254 - (point.value - low) / (high - low) * 210
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${x(point)},${y(point)}`).join(' ')
  const index = selected === null ? points.length - 1 : Math.min(selected, points.length - 1)
  const active = points[index]
  const formatTick = (value) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', ...(duration > 86_400_000 ? { day: '2-digit', month: 'short' } : { hour: '2-digit', minute: '2-digit', hour12: false }) }).format(new Date(value))
  return <div className={`metric-${history.metric}`}>
    <div className="chart-summary"><span className="chart-legend"><i />{METRICS[history.metric].label} <small>{history.unit}</small></span><span>{points.length} puntos · Datos simulados</span></div>
    <div className="chart-inspection" aria-live="polite"><strong>{active.value.toLocaleString('es-CO')} <small>{history.unit}</small></strong><Timestamp value={active.timestamp} /><span>{selected === null ? 'Último punto del periodo' : 'Punto seleccionado'}</span></div>
    <div className="chart-scroll">
      <svg className="history-chart" viewBox="0 0 1000 305" role="img" aria-label={`Histórico simulado de ${METRICS[history.metric].label} en ${history.unit}. Use el control bajo el gráfico para consultar cada punto.`}>
        <text x="64" y="20">{history.unit}</text>
        {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1="64" x2="934" y1={44 + i * 210 / 4} y2={44 + i * 210 / 4} stroke="var(--line)" strokeDasharray="3 5" /><text x="52" y={49 + i * 210 / 4} textAnchor="end">{(high - i * (high - low) / 4).toLocaleString('es-CO', { maximumFractionDigits: 1 })}</text></g>)}
        {[0, 1, 2, 3, 4].map((i) => <text key={i} x={64 + i * 870 / 4} y="285" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{formatTick(start + duration * i / 4)}</text>)}
        <path d={path} fill="none" stroke="var(--metric-color)" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={x(active)} x2={x(active)} y1="44" y2="254" stroke="var(--metric-color)" strokeDasharray="4 5" opacity=".5" />
        <circle cx={x(active)} cy={y(active)} r="5" fill="var(--surface)" stroke="var(--metric-color)" strokeWidth="2.5" />
        {selected !== null && <g aria-hidden="true"><rect x={Math.min(752, Math.max(66, x(active) - 90))} y="27" width="180" height="30" rx="4" fill="var(--ink)" /><text className="tooltip-text" x={Math.min(842, Math.max(156, x(active)))} y="47" textAnchor="middle">{active.value.toLocaleString('es-CO')} {history.unit} · {formatTick(Date.parse(active.timestamp))}</text></g>}
        {points.map((point, i) => <rect key={point.timestamp} x={i === 0 ? 64 : (x(points[i - 1]) + x(point)) / 2} y="58" width={Math.max(1, (i === points.length - 1 ? 934 : (x(point) + x(points[i + 1])) / 2) - (i === 0 ? 64 : (x(points[i - 1]) + x(point)) / 2))} height="210" fill="transparent" onPointerEnter={() => setSelected(i)} onPointerDown={() => setSelected(i)}><title>{point.value} {history.unit} · {formatTick(Date.parse(point.timestamp))}</title></rect>)}
      </svg>
    </div>
    <label className="chart-control">Explorar lecturas <input type="range" min="0" max={points.length - 1} value={index} onChange={(event) => setSelected(Number(event.target.value))} aria-label="Punto del histórico" aria-valuetext={`${active.value} ${history.unit}, ${new Date(active.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`} /><span>Hora de Bogotá · UTC−5</span></label>
    <details className="history-data"><summary>Ver mediciones en tabla</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Datos del histórico"><table><thead><tr><th scope="col">Fecha (Bogotá)</th><th scope="col">{METRICS[history.metric].label} ({history.unit})</th></tr></thead><tbody>{points.map((point) => <tr key={point.timestamp}><td><Timestamp value={point.timestamp} /></td><td>{point.value.toLocaleString('es-CO')}</td></tr>)}</tbody></table></div></details>
  </div>
}
export default function HistoryPanel() {
  const [deviceId, setDeviceId] = useState(DEVICES[0].device_id)
  const [metric, setMetric] = useState('nitrogen')
  const [hours, setHours] = useState(24)
  const [state, setState] = useState({ key: '', data: null, error: '' })
  const [retry, setRetry] = useState(0)
  const device = DEVICES.find((item) => item.device_id === deviceId)
  const queryKey = `${deviceId}:${metric}:${hours}:${retry}`
  const loading = state.key !== queryKey
  useEffect(() => {
    let active = true
    monitoringService.getHistory({ deviceId, metric, hours }).then((data) => {
      if (active) setState({ key: queryKey, data, error: '' })
    }).catch(() => {
      if (active) setState({ key: queryKey, data: null, error: 'No se pudo cargar el histórico.' })
    })
    return () => { active = false }
  }, [deviceId, metric, hours, queryKey])
  return <section className="panel history" id="historico" aria-labelledby="history-title">
    <div className="section-heading"><div><p className="eyebrow">03 / Evolución de las mediciones</p><h2 id="history-title">Histórico de sensores</h2></div><span className="section-note">Datos de demostración</span></div>
    <div className="history-filters"><label>Dispositivo<select value={deviceId} onChange={(event) => { const next = DEVICES.find((item) => item.device_id === event.target.value); setDeviceId(next.device_id); setMetric(metricsFor(next)[0]) }}>{DEVICES.map((item) => <option key={item.device_id} value={item.device_id}>{item.node}</option>)}</select></label><label>Variable<select value={metric} onChange={(event) => setMetric(event.target.value)}>{metricsFor(device).map((key) => <option key={key} value={key}>{METRICS[key].label}</option>)}</select></label><label>Periodo<select value={hours} onChange={(event) => setHours(Number(event.target.value))}><option value={6}>Últimas 6 horas</option><option value={24}>Últimas 24 horas</option><option value={168}>Últimos 7 días</option></select></label></div>
    <div className="chart-area" aria-busy={loading}>{loading ? <p className="empty" role="status">Cargando histórico…</p> : state.error ? <div className="empty" role="alert"><p>{state.error}</p><button onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : <HistoryChart key={queryKey} history={state.data} />}</div>
  </section>
}
