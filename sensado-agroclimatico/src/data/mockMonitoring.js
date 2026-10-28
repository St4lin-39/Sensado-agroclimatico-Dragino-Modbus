import { DEVICES, METRICS, metricsFor } from './devices.js'

// Fixed session fixture: a refresh does not invent a new sensor uplink.
const anchor = Date.now()
const ages = [4, 12, 47, 7]
const values = [
  { nitrogen: 84, phosphorus: 36, potassium: 142 },
  { nitrogen: 76, phosphorus: 41, potassium: 158 },
  { nitrogen: 91, phosphorus: 33, potassium: 136 },
  { temperature: 24.6, humidity: 72.3 },
]
export function createOverview() {
  return {
    schema_version: 1, source: 'simulated', generated_at: new Date().toISOString(),
    freshness_threshold_seconds: 1800,
    devices: DEVICES.map((device, index) => ({
      ...device, timestamp: new Date(anchor - ages[index] * 60_000).toISOString(),
      measurements: Object.fromEntries(metricsFor(device).map((metric) => [metric, { value: values[index][metric], unit: METRICS[metric].unit }])),
    })),
  }
}
export function createHistory({ deviceId, metric, hours }) {
  const index = DEVICES.findIndex((device) => device.device_id === deviceId)
  const device = DEVICES[index]
  if (!device || !metricsFor(device).includes(metric) || ![6, 24, 168].includes(hours)) throw new Error('Consulta de histórico no válida.')
  const end = anchor - ages[index] * 60_000
  const start = anchor - hours * 3_600_000
  const count = hours === 168 ? 57 : 25
  const base = values[index][metric]
  return {
    schema_version: 1, source: 'simulated', device_id: deviceId, metric, unit: METRICS[metric].unit,
    from: new Date(start).toISOString(), to: new Date(anchor).toISOString(),
    points: Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(start + (end - start) * i / (count - 1)).toISOString(),
      value: i === count - 1 ? base : Number((base * (1 + .045 * Math.sin(i * .8 + index))).toFixed(1)),
    })),
  }
}
