import { metricsFor } from '../data/devices.js'

export function loadHistorySeries(service, device, metric, hours) {
  const metrics = metric === 'all' ? metricsFor(device) : [metric]
  return Promise.all(metrics.map((key) => service.getHistory({ deviceId: device.device_id, metric: key, hours })))
}

export function prepareHistorySeries(histories) {
  const series = histories.map((history) => ({
    ...history,
    points: history.points.filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.timestamp)))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
  }))
  const times = [...new Set(series.flatMap((item) => item.points.map((point) => Date.parse(point.timestamp))))].sort((a, b) => a - b)
  const axes = [...new Set(series.map((item) => item.unit))].map((unit) => {
    const values = series.filter((item) => item.unit === unit).flatMap((item) => item.points.map((point) => point.value))
    if (!values.length) return { unit, low: null, high: null }
    const min = Math.min(...values), max = Math.max(...values)
    const padding = Math.max((max - min) * .3, 1)
    return { unit, low: min - padding, high: max + padding }
  })
  return { series, times, axes }
}
