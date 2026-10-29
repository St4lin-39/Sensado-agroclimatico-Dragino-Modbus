import { DEVICES, METRICS, metricsFor } from '../../data/devices.js'

const validTime = (value) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const fail = () => { throw new Error('Respuesta de API inválida.') }
const envelope = (data) => { if (data?.schema_version !== 1 || data.source !== 'real') fail() }

async function request(path) {
  const response = await fetch(`/api${path}`, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('No se pudo consultar la API.')
  const data = await response.json()
  envelope(data)
  return data
}

export const apiProvider = {
  async getOverview() {
    const inventory = await request('/devices')
    if (!Array.isArray(inventory.devices) || inventory.devices.length !== DEVICES.length ||
      !DEVICES.every((expected) => inventory.devices.filter((d) => d.device_id === expected.device_id && d.node === expected.node && d.sensor_type === expected.sensor_type).length === 1)) fail()
    const devices = await Promise.all(DEVICES.map(async (device) => {
      const data = await request(`/devices/${device.device_id}/latest`)
      if (data.device_id !== device.device_id || data.node !== device.node || data.sensor_type !== device.sensor_type ||
        !(data.timestamp === null || validTime(data.timestamp))) fail()
      for (const metric of metricsFor(device)) {
        const reading = data.measurements?.[metric]
        if (!reading || reading.unit !== METRICS[metric].unit ||
          !(reading.value === null || (Number.isFinite(reading.value) && reading.value !== -999)) ||
          (data.timestamp === null && reading.value !== null)) fail()
      }
      return data
    }))
    return { schema_version: 1, source: 'real', generated_at: new Date().toISOString(), freshness_threshold_seconds: 1800, devices }
  },
  async getHistory({ deviceId, metric, hours }) {
    const device = DEVICES.find((item) => item.device_id === deviceId)
    if (!device || !metricsFor(device).includes(metric) || ![6, 24, 168].includes(hours)) fail()
    const data = await request(`/devices/${deviceId}/history?${new URLSearchParams({ metric, hours })}`)
    if (data.device_id !== deviceId || data.metric !== metric || data.unit !== METRICS[metric].unit ||
      !validTime(data.from) || !validTime(data.to) || Date.parse(data.from) >= Date.parse(data.to) ||
      !Array.isArray(data.points) || data.points.length > 500) fail()
    let previous = -Infinity
    for (const point of data.points) {
      const time = Date.parse(point.timestamp)
      if (!validTime(point.timestamp) || !Number.isFinite(point.value) || point.value === -999 ||
        time <= previous || time < Date.parse(data.from) || time >= Date.parse(data.to)) fail()
      previous = time
    }
    return data
  },
}
