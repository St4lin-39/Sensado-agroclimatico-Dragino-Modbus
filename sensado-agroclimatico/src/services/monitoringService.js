import { createHistory, createOverview } from '../data/mockMonitoring.js'

// Swap this adapter for fetch('/api/...'); preserve docs/data-contract.md DTOs.
export const monitoringService = {
  async getOverview() { return structuredClone(createOverview()) },
  async getHistory(query) { return structuredClone(createHistory(query)) },
}
