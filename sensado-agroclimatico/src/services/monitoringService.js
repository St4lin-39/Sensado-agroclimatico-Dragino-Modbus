import { mockProvider } from './providers/mockProvider.js'
import { apiProvider } from './providers/apiProvider.js'

export const monitoringMode = import.meta.env.VITE_MONITORING_PROVIDER || 'mock'
if (!['mock', 'api'].includes(monitoringMode)) throw new Error('Proveedor de monitoreo inválido.')
export const monitoringService = monitoringMode === 'api' ? apiProvider : mockProvider
