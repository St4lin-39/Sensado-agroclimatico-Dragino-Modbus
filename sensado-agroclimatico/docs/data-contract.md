# Contrato de consulta v1

Implementado por los proveedores mock y api. Ambos conservan estos DTO.
El proveedor api compone el resumen desde el catálogo y las últimas lecturas.

## Vista general

monitoringService.getOverview(): en modo api usa GET /api/devices y
GET /api/devices/{device_id}/latest para cada dispositivo. No existe endpoint overview.

```json
{
  "schema_version": 1,
  "source": "simulated",
  "generated_at": "2026-10-28T15:00:00.000Z",
  "freshness_threshold_seconds": 1800,
  "devices": [
    {
      "device_id": "rs485-lb-01",
      "node": "npk-01",
      "sensor_type": "npk",
      "timestamp": "2026-10-28T14:56:00.000Z",
      "measurements": {
        "nitrogen": { "value": 84, "unit": "mg/kg" },
        "phosphorus": { "value": 36, "unit": "mg/kg" },
        "potassium": { "value": 142, "unit": "mg/kg" }
      }
    }
  ]
}
```

El ejemplo abrevia el array. El mock incluye los cuatro dispositivos:

| device_id | node | sensor_type | measurements |
|---|---|---|---|
| rs485-lb-01 | npk-01 | npk | nitrogen, phosphorus, potassium |
| rs485-lb-02 | npk-02 | npk | nitrogen, phosphorus, potassium |
| rs485-lb-03 | npk-03 | npk | nitrogen, phosphorus, potassium |
| rak7431-byx-01 | byx-01 | byx | temperature, humidity |

BYX usa temperature: { value: 24.6, unit: "°C" } y humidity: { value: 72.3, unit: "%" }.

- source: simulated en mocks, real en la API.
- generated_at: instante de consulta; no recepción de un uplink.
- timestamp: recepción de medición, UTC ISO 8601, o null sin datos.
- value: número finito o null; nunca texto ni -999.
- Todas las claves de medición del tipo de sensor deben estar presentes.
- freshness_threshold_seconds: entero positivo, inicialmente 1800. Confirmar
  con la cadencia de envío real antes de integrar.
- La UI recalcula vigencia cada 30 segundos usando el reloj local sincronizado.
  Una fecha futura no se considera reciente. Fechas mostradas en America/Bogota.
- El resumen describe vigencia, no salud de TTN, Docker ni InfluxDB.

## Histórico

GET /api/devices/rs485-lb-01/history?metric=nitrogen&hours=24
→ monitoringService.getHistory({ deviceId, metric, hours })

```json
{
  "schema_version": 1,
  "source": "simulated",
  "device_id": "rs485-lb-01",
  "metric": "nitrogen",
  "unit": "mg/kg",
  "from": "2026-10-27T15:00:00.000Z",
  "to": "2026-10-28T15:00:00.000Z",
  "points": [
    { "timestamp": "2026-10-28T14:56:00.000Z", "value": 84 }
  ]
}
```

hours admite 6, 24 y 168; metric debe pertenecer al dispositivo.
points se ordena por fecha ascendente, con números finitos y timestamps únicos
dentro del rango. Array vacío significa ausencia de datos. La API deberá
limitar/agregar puntos; los mocks usan 25 o 57. La gráfica conecta observaciones,
no certifica continuidad de recepción.

## Adaptación implementada

services/monitoringService.js selecciona mock (predeterminado) o api mediante
VITE_MONITORING_PROVIDER. El proveedor api usa fetch del mismo origen y rechaza
respuestas HTTP fallidas o inválidas. No usa mocks automáticamente ante errores.
Los tokens y consultas InfluxDB permanecen en el servidor con lectura limitada a
organización agricultura, bucket sensores_agricolas, measurement sensores.
No poner secretos en variables VITE_ ni en código del navegador.

El catálogo de dispositivos actual es fijo en data/devices.js. El selector del
histórico podrá consumir un inventario dinámico si posteriormente cambia el alcance.

## Semántica de la API

- GET /api/devices devuelve `{schema_version: 1, source: "real", devices: [...]}`
  con las cuatro identidades del catálogo (sin lecturas).
- GET /api/devices/{device_id}/latest devuelve `schema_version`, `source` y
  un dispositivo con la misma forma del array del resumen. Busca desde Unix epoch
  hasta ahora: devuelve los campos del instante real más reciente, sin combinar
  campos de uplinks anteriores. Sin datos: timestamp null y valores null.
- BYX se filtra con el tag almacenado `sensor_type=environment` y se presenta
  como `byx`, manteniendo el contrato de React. Humedad relativa se presenta en %.
- Histórico: hours solo 6, 24 o 168; limit entre 1 y 1000 (predeterminado 500).
  Una observación real (última) por ventana de ceil(hours*3600/limit) segundos,
  conservando su timestamp original. Sin interpolación, promedios ni relleno.
  Se conservan como máximo los últimos limit puntos en orden cronológico.
  La reducción puede omitir observaciones; no representa continuidad.
- Fechas UTC ISO 8601; rango [from, to). Timestamps inválidos, futuros, valores
  no finitos y -999 se descartan. Campos ausentes permanecen null.
- Parámetros extra o repetidos: 422. Dispositivo desconocido: 404.
  InfluxDB inaccesible, sin autorización o respuesta ilegible: 503 sanitizado.
- GET /api/health: `{api: "ok", influxdb: "accessible"}` (200) o
  `{api: "ok", influxdb: "unavailable"}` (503). Hace una consulta autenticada
  mínima: comprueba acceso al bucket, no solo que el puerto esté abierto.
- El servidor acepta únicamente GET. No acepta Flux, bucket, measurement,
  device_id libre ni timestamps suministrados por el navegador.
