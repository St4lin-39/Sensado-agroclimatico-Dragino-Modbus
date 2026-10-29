# API de consulta

FastAPI, aislada del publicador MQTT (`requirements.txt` de la raíz). Solo lectura:
usa POST **únicamente** contra `/api/v2/query` de InfluxDB, nunca escribe datos.
El transporte HTTP/CSV usa la biblioteca estándar, con timeout de 5 segundos,
respuesta máxima de 2 MB y redirecciones deshabilitadas. No se registran tokens
ni respuestas de error de InfluxDB.

Estructura: `main.py` contiene configuración, catálogo, consultas y rutas;
`tests/test_api.py` valida rutas y errores con un sustituto de InfluxDB.

## Arranque local (PowerShell, desde la raíz)

Requiere Python 3.12 y Node compatible con el Vite existente.

```powershell
python -m venv api/.venv
api/.venv/Scripts/python.exe -m pip install -r api/requirements.txt
# Crear solo si no existe; nunca sobrescribir un entorno local.
if (!(Test-Path api/.env)) { Copy-Item api/.env.example api/.env }
```

Editar **api/.env**, sin tocar el `.env` de infraestructura:

| Variable | Valor |
|---|---|
| INFLUXDB_URL | http://localhost:8086 |
| INFLUXDB_ORG | agricultura |
| INFLUXDB_BUCKET | sensores_agricolas |
| INFLUXDB_TOKEN | Token privado con Read únicamente sobre ese bucket |

Crear un token personalizado en InfluxDB con lectura sobre sensores_agricolas,
sin permisos de escritura ni administración. La API no crea tokens ni puede
restringir los permisos de uno existente. No reutilizar INFLUXDB_ADMIN_TOKEN.
Los ejemplos solo contienen placeholders; api/.env está ignorado por Git.
Variables ya exportadas en el proceso tienen precedencia sobre el archivo.

```powershell
api/.venv/Scripts/python.exe -m uvicorn api.main:app --env-file api/.env --host 127.0.0.1 --port 8000 --reload --no-access-log
```

Solo ese archivo se carga explícitamente; el código no busca el `.env` raíz.
En Docker bastará cambiar INFLUXDB_URL a http://influxdb:8086. No se ha añadido
un contenedor ni cambiado compose.yaml.

En otra terminal:

```powershell
cd sensado-agroclimatico
npm.cmd ci
$env:VITE_MONITORING_PROVIDER = 'api'
npm.cmd run dev
```

Abrir http://localhost:5173. Vite reenvía /api a http://127.0.0.1:8000.
No se habilita CORS. Para mock: establecer VITE_MONITORING_PROVIDER='mock' y
reiniciar Vite. También puede usarse sensado-agroclimatico/.env.local con esa
variable pública; nunca colocar credenciales allí. El valor predeterminado es mock.
La selección se incorpora al build: configurar la variable antes de compilar.
Vite preview no usa este proxy; en producción se necesita un proxy del mismo
origen para /api. La API local no incluye autenticación de usuarios: mantenerla
ligada a loopback hasta definir acceso, TLS y proxy del despliegue.

## Endpoints

- GET /api/health: estado de API y acceso autenticado a InfluxDB (200/503).
- GET /api/devices: catálogo fijo de cuatro dispositivos.
- GET /api/devices/{device_id}/latest: última lectura, campos ausentes null.
- GET /api/devices/{device_id}/history?metric=nitrogen&hours=24&limit=500:
  hours=6,24,168; limit=1..1000. Métrica limitada al dispositivo.

Ver [contrato](../sensado-agroclimatico/docs/data-contract.md) para DTO y reglas.
No se aceptan consultas Flux, buckets, measurements o dispositivos arbitrarios.
BYX usa environment en InfluxDB y byx en React; solo temperature y humidity.
No se consultan Grafana, TTN ni Node-RED.

Prueba manual sin imprimir credenciales (API ya arrancada):

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/devices
Invoke-RestMethod http://127.0.0.1:8000/api/devices/rs485-lb-01/latest
Invoke-RestMethod 'http://127.0.0.1:8000/api/devices/rs485-lb-01/history?metric=nitrogen&hours=24&limit=500'
```

## Validación

Desde la raíz:

```powershell
api/.venv/Scripts/python.exe -m pip install -r api/requirements-dev.txt
api/.venv/Scripts/python.exe -m unittest discover -s api/tests -v
cd sensado-agroclimatico
node --test src/services/providers/providers.test.js
npm.cmd run build
npm.cmd run lint
```

Las pruebas sustituyen InfluxDB y no necesitan secretos. Para validar contra
mediciones reales se requiere la infraestructura en ejecución y el token de
lectura configurado. Confirmar si el umbral de vigencia de 1800 segundos coincide
con la cadencia real de los sensores.
