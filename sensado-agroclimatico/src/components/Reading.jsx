import { isRecent } from '../services/readingUtils.js'
const dates = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const numbers = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
export function Timestamp({ value }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span>Sin registro</span>
  return <time dateTime={value}>{dates.format(new Date(value))}</time>
}
export function Measurement({ measurement }) {
  return <span className="measurement">{Number.isFinite(measurement?.value) ? numbers.format(measurement.value) : '—'}<small>{measurement?.unit ?? ''}</small></span>
}
export function FreshnessBadge({ timestamp, now, threshold }) {
  const valid = Number.isFinite(Date.parse(timestamp))
  const recent = isRecent(timestamp, now, threshold)
  return <span className={`badge ${recent ? 'badge-fresh' : 'badge-stale'}`}><span className="status-dot" />{!valid ? 'Sin datos' : recent ? 'Reciente' : 'Desactualizado'}</span>
}
