import { createHistory, createOverview } from '../../data/mockMonitoring.js'

export const mockProvider = {
  async getOverview() { return structuredClone(createOverview()) },
  async getHistory(query) { return structuredClone(createHistory(query)) },
}
