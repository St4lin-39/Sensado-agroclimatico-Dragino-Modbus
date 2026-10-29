import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { apiProvider } from './apiProvider.js'
import { mockProvider } from './mockProvider.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const query = { deviceId: 'rs485-lb-01', metric: 'nitrogen', hours: 6 }
const history = { schema_version: 1, source: 'real', device_id: query.deviceId, metric: 'nitrogen', unit: 'mg/kg', from: '2026-10-28T00:00:00Z', to: '2026-10-28T06:00:00Z', points: [{ timestamp: '2026-10-28T01:00:00Z', value: 0 }] }
function respond(data, ok = true) { globalThis.fetch = async () => ({ ok, json: async () => structuredClone(data) }) }

test('mock continues to return isolated simulated DTOs', async () => {
  const data = await mockProvider.getOverview()
  data.devices.length = 0
  assert.equal((await mockProvider.getOverview()).devices.length, 4)
  assert.equal((await mockProvider.getHistory(query)).source, 'simulated')
})
test('api fetches same-origin history and preserves zero', async () => {
  let url
  globalThis.fetch = async (path) => { url = path; return { ok: true, json: async () => history } }
  assert.equal((await apiProvider.getHistory(query)).points[0].value, 0)
  assert.equal(url, '/api/devices/rs485-lb-01/history?metric=nitrogen&hours=6')
})
test('api rejects failed HTTP, malformed envelopes, invalid times, duplicated or unordered points', async () => {
  respond(history, false)
  await assert.rejects(apiProvider.getHistory(query))
  for (const data of [{}, { ...history, source: 'simulated' }, { ...history, from: 'bad' },
    { ...history, points: [...history.points, ...history.points] },
    { ...history, points: [{ timestamp: history.to, value: 2 }] },
    { ...history, points: [{ timestamp: history.from, value: null }] }]) {
    respond(data)
    await assert.rejects(apiProvider.getHistory(query))
  }
})
test('api overview uses catalog and latest endpoints, never mocks on error', async () => {
  const fixture = await mockProvider.getOverview()
  const devices = fixture.devices.map((d) => ({ ...d, timestamp: null, measurements: Object.fromEntries(Object.entries(d.measurements).map(([k, v]) => [k, { ...v, value: null }])) }))
  globalThis.fetch = async (path) => ({ ok: true, json: async () => path === '/api/devices' ? { schema_version: 1, source: 'real', devices } : { schema_version: 1, source: 'real', ...devices.find((d) => path.includes(d.device_id)) } })
  assert.equal((await apiProvider.getOverview()).devices[0].timestamp, null)
  respond({ schema_version: 1, source: 'real', devices: [] })
  await assert.rejects(apiProvider.getOverview())
})
