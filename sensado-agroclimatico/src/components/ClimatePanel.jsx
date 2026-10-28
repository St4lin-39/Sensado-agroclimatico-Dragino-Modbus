import { FreshnessBadge, Measurement, Timestamp } from './Reading.jsx'

function ClimateIcon({ humidity }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{humidity ? <><path d="M16 3C12 9 6 15 6 21a10 10 0 0 0 20 0C26 15 20 9 16 3Z" /><path d="M11 21a5 5 0 0 0 5 5" /></> : <><path d="M12 19V7a4 4 0 0 1 8 0v12a7 7 0 1 1-8 0Z" /><path d="M16 12v12m7-15h5m-5 5h3" /><circle cx="16" cy="24" r="2" /></>}</svg>
}

export default function ClimatePanel({ device, now, threshold }) {
  return <section className="panel climate" id="ambiente" aria-labelledby="climate-title">
    <div className="section-heading"><div><p className="eyebrow">02 / Ambiente · BYX</p><h2 id="climate-title">El pulso del ambiente</h2></div>{device && <FreshnessBadge timestamp={device.timestamp} now={now} threshold={threshold} />}</div>
    {device ? <div className="climate-body"><div className="climate-device"><span className="device-name">{device.node}</span><span className="device-id">{device.device_id}</span><p>Condiciones agroclimáticas</p><span className="section-note">Última lectura<br /><Timestamp value={device.timestamp} /></span></div><div className="climate-metrics">{['temperature', 'humidity'].map((key) => <div className={`climate-reading metric-${key}`} key={key}><div className="climate-label"><ClimateIcon humidity={key === 'humidity'} /><p>{key === 'humidity' ? 'Humedad relativa' : 'Temperatura'}</p></div><Measurement measurement={device.measurements[key]} /><span className="climate-caption">{key === 'humidity' ? 'Humedad del aire' : 'Temperatura del aire'}</span></div>)}</div></div> : <p className="empty">No hay lecturas ambientales disponibles.</p>}
  </section>
}
