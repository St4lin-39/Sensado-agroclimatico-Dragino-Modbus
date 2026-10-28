export const DEVICES = [
  { device_id: 'rs485-lb-01', node: 'npk-01', sensor_type: 'npk' },
  { device_id: 'rs485-lb-02', node: 'npk-02', sensor_type: 'npk' },
  { device_id: 'rs485-lb-03', node: 'npk-03', sensor_type: 'npk' },
  { device_id: 'rak7431-byx-01', node: 'byx-01', sensor_type: 'byx' },
]
export const METRICS = {
  nitrogen: { label: 'Nitrógeno', symbol: 'N', unit: 'mg/kg' },
  phosphorus: { label: 'Fósforo', symbol: 'P', unit: 'mg/kg' },
  potassium: { label: 'Potasio', symbol: 'K', unit: 'mg/kg' },
  temperature: { label: 'Temperatura', unit: '°C' },
  humidity: { label: 'Humedad relativa', unit: '%' },
}
export function metricsFor(device) {
  return device.sensor_type === 'npk' ? ['nitrogen', 'phosphorus', 'potassium'] : ['temperature', 'humidity']
}
