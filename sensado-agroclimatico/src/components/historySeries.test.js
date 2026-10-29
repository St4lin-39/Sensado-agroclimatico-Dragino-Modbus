import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEVICES, metricsFor } from '../data/devices.js'
import { mockProvider } from '../services/providers/mockProvider.js'
import { loadHistorySeries, prepareHistorySeries } from './historySeries.js'

for (const device of DEVICES) {
  for (const metric of ['all', ...metricsFor(device)]) {
    test(`${device.node}: ${metric} queries only the selected metrics and preserves mock measurements`, async () => {
      const queries = []
      const service = { getHistory: (query) => { queries.push(query); return mockProvider.getHistory(query) } }
      const histories = await loadHistorySeries(service, device, metric, 24)
      const expected = metric === 'all' ? metricsFor(device) : [metric]
      assert.deepEqual(queries, expected.map((key) => ({ deviceId: device.device_id, metric: key, hours: 24 })))
      assert.deepEqual(histories.map((item) => item.metric), expected)
      const { series, times, axes } = prepareHistorySeries(histories)
      assert.ok(times.length > 0)
      assert.equal(axes.length, device.sensor_type === 'byx' && metric === 'all' ? 2 : 1)
      assert.deepEqual(series.map((item) => item.points), histories.map((item) => item.points))
    })
  }
}

const history = (metric, unit, points) => ({ metric, unit, points })
test('shared NPK scale preserves zero; distinct timestamps stay distinct', () => {
  const points = [{ timestamp: '2026-10-28T01:00:00Z', value: 0 }]
  const later = [{ timestamp: '2026-10-28T02:00:00Z', value: 15 }]
  const result = prepareHistorySeries([history('nitrogen', 'mg/kg', points), history('phosphorus', 'mg/kg', later)])
  assert.equal(result.axes.length, 1)
  assert.equal(result.times.length, 2)
  assert.deepEqual(result.series[0].points, points)
  assert.deepEqual(result.series[1].points, later)
  assert.ok(result.axes[0].low < 0 && result.axes[0].high > 15)
})
test('BYX scales derive independently from the original values without conversions', () => {
  const timestamp = '2026-10-28T01:00:00Z'
  const result = prepareHistorySeries([history('temperature', '°C', [{ timestamp, value: 20 }]), history('humidity', '%', [{ timestamp, value: 80 }])])
  assert.deepEqual(result.axes, [{ unit: '°C', low: 19, high: 21 }, { unit: '%', low: 79, high: 81 }])
  assert.deepEqual(result.series.map((item) => item.points[0].value), [20, 80])
})
test('empty and partially empty series do not create measurements or artificial axes', () => {
  const empty = history('temperature', '°C', [])
  assert.deepEqual(prepareHistorySeries([empty]).times, [])
  const partial = prepareHistorySeries([empty, history('humidity', '%', [{ timestamp: '2026-10-28T01:00:00Z', value: 0 }])])
  assert.deepEqual(partial.series[0].points, [])
  assert.equal(partial.axes[0].low, null)
  assert.equal(partial.series[1].points[0].value, 0)
})
test('a failed metric request remains an error, never an empty or simulated series', async () => {
  const service = { getHistory: async ({ metric }) => { if (metric === 'phosphorus') throw new Error('unavailable'); return history(metric, 'mg/kg', []) } }
  await assert.rejects(loadHistorySeries(service, DEVICES[0], 'all', 6), /unavailable/)
})
