# Sensado agroclimático con LoRaWAN

Sistema IoT para la adquisición, transmisión, almacenamiento y visualización de variables agrícolas y agroclimáticas mediante sensores RS485/Modbus, LoRaWAN, The Things Network, Node-RED, InfluxDB y Grafana.

## Arquitectura del sistema

El flujo general implementado es:

```text
Sensores NPK
    ↓
Dragino RS485-LB
    ↓
LoRaWAN
    ↓
Gateway MikroTik
    ↓
The Things Network (TTN)
    ↓ MQTT/TLS
Node-RED
    ↓
InfluxDB 2.x
    ↓
Grafana
```

Para el sensor agroclimático:

```text
Sensor 3001BYX
    ↓ RS485 / Modbus RTU
RAK7431
    ↓ LoRaWAN
Gateway MikroTik
    ↓
The Things Network (TTN)
    ↓ MQTT/TLS
Node-RED
    ↓
InfluxDB 2.x
    ↓
Grafana
```

Los dispositivos actualmente integrados son:

```text
rs485-lb-01      → npk-01
rs485-lb-02      → npk-02
rs485-lb-03      → npk-03
rak7431-byx-01   → byx-01
```

Node-RED recibe los uplinks desde TTN, normaliza las mediciones y almacena los datos en InfluxDB. Grafana utiliza InfluxDB como fuente de datos para visualizar las mediciones.

> Las credenciales, API keys, tokens y contraseñas no se almacenan en este repositorio.

---

# Despliegue

El sistema está preparado para ejecutarse mediante Docker Compose.

Los servicios principales son:

```text
Docker Compose
├── InfluxDB 2.7
├── Node-RED 4.1.10
└── Grafana
```

Los datos de los tres servicios se mantienen mediante almacenamiento persistente.

## 1. Requisitos del servidor

El servidor debe disponer como mínimo de:

- Docker Engine
- Docker Compose
- Git
- Conexión a Internet
- Acceso de red a The Things Network

No es necesario instalar Node.js, Node-RED, InfluxDB ni Grafana directamente en el servidor, ya que estos componentes se ejecutan mediante Docker.

Comprobar la instalación:

```bash
docker --version
docker compose version
docker info
```

---

## 2. Clonar el repositorio

Clonar el proyecto:

```bash
git clone https://github.com/St4lin-39/Sensado-agroclimatico-Dragino-Modbus.git
```

Entrar al repositorio:

```bash
cd Sensado-agroclimatico-Dragino-Modbus
```

Para desplegar el estado actual de desarrollo:

```bash
git checkout develop
git pull origin develop
```

---

## 3. Configurar las variables de entorno

El repositorio contiene:

```text
.env.example
```

Crear `.env` a partir de esta plantilla.

En Linux:

```bash
cp .env.example .env
```

En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completar los valores requeridos dentro de `.env`.

Las variables utilizadas por la infraestructura incluyen la configuración de InfluxDB y Grafana.

Ejemplo:

```text
INFLUXDB_ADMIN_USER=
INFLUXDB_ADMIN_PASSWORD=
INFLUXDB_ORG=
INFLUXDB_BUCKET=
INFLUXDB_ADMIN_TOKEN=

GRAFANA_ADMIN_USER=
GRAFANA_ADMIN_PASSWORD=

GRAFANA_ROOT_URL=
```

Para la configuración actual del proyecto se utilizan:

```text
INFLUXDB_ORG=agricultura
INFLUXDB_BUCKET=sensores_agricolas
```

Las contraseñas y el token deben definirse con valores privados y seguros.

`GRAFANA_ROOT_URL` depende de la dirección desde la cual Grafana será publicado.

Para ejecución local puede utilizarse:

```text
GRAFANA_ROOT_URL=http://localhost:3000/sensado_agroclimatico/
```

En el servidor definitivo debe sustituirse por la URL pública/base path correspondiente.

> Nunca subir el archivo `.env` al repositorio.

---

## 4. Levantar el sistema

Desde la raíz del repositorio ejecutar:

```bash
docker compose up -d --build
```

Este comando construye la imagen de Node-RED y levanta:

```text
iot-influxdb
iot-node-red
iot-grafana
```

Comprobar el estado:

```bash
docker compose ps
```

Los contenedores deben aparecer en estado `Up` o `Running`.

---

## 5. Almacenamiento persistente

El proyecto utiliza los siguientes volúmenes:

```text
iot-agricola-influxdb-data
iot-agricola-node-red-data
iot-agricola-grafana-data
```

Estos permiten conservar respectivamente:

- datos históricos de InfluxDB;
- configuración, flows y credenciales locales de Node-RED;
- información persistente de Grafana.

Por esta razón, recrear o reiniciar un contenedor no debe eliminar la información almacenada.

No utilizar durante la operación normal:

```bash
docker compose down -v
```

La opción `-v` elimina los volúmenes y puede provocar pérdida de datos y configuración.

---

# Configuración inicial de Node-RED

## 6. Acceder a Node-RED

Después de levantar los contenedores, Node-RED queda disponible por defecto en:

```text
http://localhost:1880
```

En un servidor remoto se debe acceder utilizando la dirección correspondiente del servidor y la configuración de red implementada.

El flujo base se encuentra versionado en:

```text
node-red/flows.json
```

La imagen de Node-RED se construye utilizando:

```text
node-red/Dockerfile
```

El contenedor incluye:

```text
Node-RED 4.1.10
node-red-contrib-influxdb 0.7.0
```

---

## 7. Configurar MQTT de The Things Network

Las credenciales de TTN no están almacenadas en Git.

Por lo tanto, en el primer despliegue sobre un servidor nuevo se deben configurar manualmente una sola vez en Node-RED.

La conexión utilizada es:

```text
Servidor: nam1.cloud.thethings.network
Puerto: 8883
TLS: habilitado
MQTT: 3.1.1
Topic: v3/+/devices/+/up
```

En Node-RED:

1. Abrir el flujo principal.
2. Editar el nodo MQTT asociado a `Uplink TTN - RAW`.
3. Abrir la configuración del broker.
4. Introducir el username correspondiente a la aplicación de TTN.
5. Introducir la API Key de TTN como contraseña.
6. Guardar la configuración.

La API Key debe disponer de los permisos necesarios para que Node-RED pueda recibir los uplinks MQTT de la aplicación.

No guardar la API Key en el repositorio.

---

## 8. Configurar InfluxDB en Node-RED

En el primer despliegue también debe introducirse manualmente el token de InfluxDB en el nodo correspondiente.

La configuración utilizada dentro de Docker es:

```text
URL: http://influxdb:8086
Organization: agricultura
Bucket: sensores_agricolas
Measurement: sensores
Precision: milliseconds
```

Es importante utilizar:

```text
http://influxdb:8086
```

y no:

```text
http://localhost:8086
```

porque Node-RED e InfluxDB se ejecutan en contenedores diferentes y se comunican mediante la red interna de Docker Compose.

En Node-RED:

1. Editar `InfluxDB - Sensores agrícolas`.
2. Abrir la configuración del servidor InfluxDB.
3. Verificar la versión `2.0`.
4. Verificar la URL `http://influxdb:8086`.
5. Introducir el token definido para InfluxDB.
6. Verificar Organization y Bucket.
7. Guardar los cambios.
8. Pulsar `Deploy`.

---

## 9. Persistencia de las credenciales de Node-RED

Después del primer `Deploy`, Node-RED almacena localmente sus credenciales cifradas dentro de su directorio `/data`.

Este directorio está asociado al volumen:

```text
iot-agricola-node-red-data
```

Por tanto, las credenciales configuradas manualmente sobreviven a reinicios y recreaciones normales del contenedor.

En un servidor nuevo el procedimiento esperado es:

```text
Primer despliegue
      ↓
Configurar credenciales TTN
      ↓
Configurar token de InfluxDB
      ↓
Deploy
      ↓
Credenciales almacenadas en node-red-data
      ↓
Reinicios posteriores no requieren configurarlas nuevamente
```

No se debe copiar ni versionar `flows_cred.json`.

---

# InfluxDB

## 10. Configuración de almacenamiento

InfluxDB utiliza actualmente:

```text
Organization: agricultura
Bucket: sensores_agricolas
Measurement: sensores
```

Los principales tags son:

```text
device_id
node
sensor_type
```

### Sensores NPK

Los fields utilizados son:

```text
nitrogen
phosphorus
potassium
```

Unidad:

```text
mg/kg
```

Los valores `0` son considerados mediciones válidas.

### Sensor agroclimático

Actualmente están integrados:

```text
temperature
humidity
```

El flujo está preparado para incorporar posteriormente otras variables ambientales disponibles en el sensor.

---

# Grafana

## 11. Acceso y provisioning

Grafana se ejecuta dentro de Docker y utiliza InfluxDB como fuente de datos.

Por defecto utiliza el puerto:

```text
3000
```

El proyecto contiene provisioning versionado para Grafana dentro de:

```text
infrastructure/grafana/provisioning/
```

y los dashboards versionados se encuentran en:

```text
infrastructure/grafana/dashboards/
```

La URL pública de Grafana puede configurarse mediante:

```text
GRAFANA_ROOT_URL
```

El Compose utiliza además:

```text
GF_SERVER_SERVE_FROM_SUB_PATH=true
```

para permitir el despliegue detrás de un base path.

En el servidor definitivo se debe configurar `GRAFANA_ROOT_URL` según el dominio y ruta pública utilizados por la infraestructura.

---

# Operación del sistema

## 12. Flujo de datos

Una vez configuradas las credenciales, el recorrido esperado es:

```text
Sensor
   ↓
RS485 / Modbus
   ↓
Dragino RS485-LB o RAK7431
   ↓
LoRaWAN
   ↓
Gateway MikroTik
   ↓
The Things Network
   ↓ MQTT/TLS
Node-RED
   ↓
Normalización
   ↓
InfluxDB
   ↓
Grafana
```

Node-RED identifica actualmente:

```text
rs485-lb-01      → npk-01      → npk
rs485-lb-02      → npk-02      → npk
rs485-lb-03      → npk-03      → npk
rak7431-byx-01   → byx-01      → environment
```

---

## 13. Comprobar los logs

Para comprobar Node-RED:

```bash
docker compose logs --tail=100 node-red
```

Una conexión correcta con TTN debe mostrar un mensaje similar a:

```text
Connected to broker: mqtts://nam1.cloud.thethings.network:8883
```

Para seguir los logs en tiempo real:

```bash
docker compose logs -f node-red
```

Para revisar todos los servicios:

```bash
docker compose logs --tail=100
```

---

## 14. Reiniciar servicios

Reiniciar Node-RED:

```bash
docker compose restart node-red
```

Reiniciar todos los servicios:

```bash
docker compose restart
```

Las credenciales y datos persistentes deben mantenerse gracias a los volúmenes Docker.

---

## 15. Detener el sistema

Para detener y eliminar los contenedores y la red creada por Compose:

```bash
docker compose down
```

Los volúmenes permanecen almacenados.

Para volver a levantar el sistema:

```bash
docker compose up -d
```

Si se realizaron cambios en el `Dockerfile`, dependencias o archivos que requieran reconstrucción:

```bash
docker compose up -d --build
```

> No utilizar `docker compose down -v` salvo que se desee eliminar intencionalmente los datos persistentes.

---

# Actualización del proyecto en el servidor

## 16. Actualizar desde Git

Antes de actualizar, comprobar que no existan cambios locales que deban conservarse:

```bash
git status
```

Actualizar la rama:

```bash
git checkout develop
git pull origin develop
```

Si los cambios afectan imágenes, configuración Docker o Node-RED:

```bash
docker compose up -d --build
```

Los volúmenes persistentes existentes no deben eliminarse durante una actualización normal.

---

# Seguridad

## 17. Información que no debe versionarse

No subir al repositorio:

```text
.env
API Keys de TTN
tokens de InfluxDB
contraseñas
flows_cred.json
credenciales de Grafana
```

El archivo:

```text
.env.example
```

debe contener únicamente nombres de variables y valores de ejemplo, nunca credenciales reales.

---

# Estado actual

Actualmente están integrados en el ecosistema:

```text
3 × JXBS-3001-NPK-RS
3 × Dragino RS485-LB
1 × 3001BYX
1 × RAK7431
1 × gateway MikroTik LoRaWAN
The Things Network
Node-RED
InfluxDB 2.x
Grafana
```

La infraestructura de software puede levantarse mediante:

```bash
docker compose up -d --build
```

Node-RED está contenedorizado y utiliza almacenamiento persistente para conservar su configuración y credenciales entre recreaciones.

InfluxDB y Grafana utilizan igualmente volúmenes persistentes.

El provisioning de Grafana y los flows base de Node-RED están versionados en el repositorio.

## Pendiente para el despliegue definitivo

Antes de publicar el sistema en infraestructura institucional se debe definir o confirmar:

- dominio público definitivo;
- base path definitivo;
- configuración del proxy inverso o mecanismo de publicación utilizado por el servidor;
- reglas de firewall y puertos expuestos;
- integración final con el frontend web;
- configuración de TLS/HTTPS según la infraestructura de despliegue.

La configuración interna entre contenedores debe mantenerse independiente del dominio público. Por ejemplo, Node-RED continúa comunicándose con InfluxDB mediante:

```text
http://influxdb:8086
```

aunque Grafana o el frontend sean publicados posteriormente mediante un dominio institucional.