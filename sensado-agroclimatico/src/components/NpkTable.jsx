import { FreshnessBadge, Measurement, Timestamp } from './Reading.jsx'
import { METRICS } from '../data/devices.js'
const nutrients = ['nitrogen', 'phosphorus', 'potassium']

export default function NpkTable({ devices, now, threshold }) {
  const values = devices.flatMap((device) => nutrients.map((key) => device.measurements[key]?.value)).filter(Number.isFinite)
  const scale = Math.max(0, ...values) || 1
  return <section className="panel soil-panel" id="suelo" aria-labelledby="npk-title">
    <div className="section-heading"><div><p className="eyebrow">01 / Suelo · NPK</p><h2 id="npk-title">El suelo, sensor a sensor</h2></div><span className="section-note">Concentración de nutrientes · mg/kg</span></div>
    <div className="npk-grid">{devices.map((device) => <article className="npk-sensor" key={device.device_id} aria-label={`Nutrientes de ${device.node}`}>
      <header className="sensor-heading"><div><h3 className="device-name">{device.node}</h3><span className="device-id">{device.device_id}</span></div><FreshnessBadge timestamp={device.timestamp} now={now} threshold={threshold} /></header>
      <div className="nutrients">{nutrients.map((key) => {
        const measurement = device.measurements[key]
        return <div className={`nutrient metric-${key}`} key={key}>
          <div className="nutrient-label"><span className="chemical-symbol">{METRICS[key].symbol}</span><span>{METRICS[key].label}</span><Measurement measurement={measurement} /></div>
          <div className="nutrient-track" aria-hidden="true"><span style={{ width: `${Number.isFinite(measurement?.value) ? Math.max(0, measurement.value) / scale * 100 : 0}%` }} /></div>
        </div>
      })}</div>
      <footer className="sensor-footer"><span>Última lectura</span><Timestamp value={device.timestamp} /></footer>
    </article>)}</div>
    {!devices.length && <p className="empty">No hay lecturas de nutrientes disponibles.</p>}
    <div className="panel-foot">Barras a escala común desde cero, según el mayor valor medido entre estos sensores. No representan rangos óptimos. La vigencia indica antigüedad de la lectura.</div>
  </section>
}
