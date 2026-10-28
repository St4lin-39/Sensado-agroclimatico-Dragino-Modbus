import { useMonitoring } from '../hooks/useMonitoring.js'
import NpkTable from '../components/NpkTable.jsx'
import ClimatePanel from '../components/ClimatePanel.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import { Timestamp } from '../components/Reading.jsx'
import { isRecent } from '../services/readingUtils.js'

export default function DashboardPage() {
  const { data, loading, error, now, refresh } = useMonitoring()
  const devices = data?.devices ?? []
  const threshold = data?.freshness_threshold_seconds ?? 1800
  const recent = devices.filter((device) => isRecent(device.timestamp, now, threshold)).length
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="app-header"><div className="header-inner"><a className="brand" href="#contenido"><span className="brand-mark" aria-hidden="true">SA</span><span>Sensado agroclimático<small>Monitoreo agrícola</small></span></a><a className="advanced-link" href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Dashboard avanzado <span aria-hidden="true">↗</span><small>Grafana · entorno local</small></a></div></header>
    <nav className="app-nav" aria-label="Secciones del monitoreo"><div><a href="#contenido">Resumen</a><a href="#suelo">Suelo</a><a href="#ambiente">Ambiente</a><a href="#historico">Histórico</a></div></nav>
    <main id="contenido" className="dashboard">
      <div className="page-heading"><div><p className="eyebrow">Red de sensores agrícolas</p><h1>Monitoreo del cultivo</h1><p className="muted">Seguimiento de nutrientes y condiciones ambientales.</p></div><button onClick={refresh} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar lecturas'}</button></div>
      <div className="simulation-notice"><strong>Modo demostración</strong><span>Lecturas simuladas. El estado de la infraestructura real no se está consultando.</span></div>
      {error && <div className="error-notice" role="alert">{error}{data && ' Se conservan las últimas lecturas consultadas.'}</div>}
      <div aria-live="polite" className="sr-only">{loading ? 'Consultando lecturas' : data ? 'Consulta de lecturas completada' : ''}</div>
      {data ? <>
        <section className="system-summary" aria-label="Estado general de las lecturas simuladas">
          <div><strong>{devices.length}</strong><span>Sensores disponibles</span></div>
          <div className="summary-fresh"><strong>{recent}</strong><span><i className="status-dot" />Recientes</span></div>
          <div className="summary-stale"><strong>{devices.length - recent}</strong><span><i className="status-dot" />Desactualizados</span></div>
          <div className="summary-update"><span>Última actualización general</span><strong><Timestamp value={data.generated_at} /></strong><small>Bogotá · Lectura reciente ≤ {threshold / 60} min</small></div>
        </section>
        <NpkTable devices={devices.filter((device) => device.sensor_type === 'npk')} now={now} threshold={threshold} />
        <ClimatePanel device={devices.find((device) => device.sensor_type === 'byx')} now={now} threshold={threshold} />
      </> : <div className="panel empty" role="status">{loading ? 'Cargando lecturas de los sensores…' : 'No hay lecturas disponibles. Usa «Actualizar lecturas» para reintentar.'}</div>}
      <HistoryPanel />
      <footer className="dashboard-footer"><span>Sensado agroclimático <span className="footer-divider">/</span> Vista operativa</span><span>Última consulta: <Timestamp value={data?.generated_at} /></span></footer>
    </main>
  </>
}
