# Contrato de consulta v1 (propuesto)

Definido para esta primera versión, pendiente de acuerdo con el futuro backend.
No hay endpoints implementados. Los mocks respetan estas formas JSON.

## Vista general

GET /api/monitoring/overview → monitoringService.getOverview()

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

- source: simulated en mocks, real en la futura API.
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

GET /api/monitoring/history?device_id=rs485-lb-01&metric=nitrogen&hours=24
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

## Adaptación futura

Cambiar services/monitoringService.js por HTTP del mismo origen preservando los
DTO. El adaptador deberá rechazar respuestas HTTP fallidas o inválidas.
Los tokens y consultas InfluxDB permanecen en el servidor con lectura limitada a
organización agricultura, bucket sensores_agricolas, measurement sensores.
No poner secretos en variables VITE_ ni en código del navegador.

El catálogo de dispositivos actual es fijo en data/devices.js. El selector del
histórico podrá consumir un inventario dinámico si posteriormente cambia el alcance.
