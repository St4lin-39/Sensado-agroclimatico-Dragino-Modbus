# Sensado-agroclimatico-Dragino-Modbus



---



\## Ejecución del sistema



Esta sección describe cómo levantar el sistema en su estado actual de desarrollo.



Actualmente el flujo funcional es:



```text

Sensores NPK

&#x20;   ↓

Dragino RS485-LB

&#x20;   ↓

LoRaWAN

&#x20;   ↓

Gateway MikroTik

&#x20;   ↓

The Things Network (TTN)

&#x20;   ↓ MQTT/TLS

Node-RED

&#x20;   ↓

InfluxDB 2.x

```



Los dos dispositivos actualmente integrados son:



\- `rs485-lb-01` → `npk-01`

\- `rs485-lb-02` → `npk-02`



Node-RED recibe los uplinks desde TTN, normaliza las mediciones y almacena los datos NPK en InfluxDB.



> Las credenciales, API keys, tokens y contraseñas no se almacenan en este repositorio.



\### 1. Requisitos



Antes de levantar el sistema se necesita:



\- Docker Desktop

\- Node.js

\- Node-RED

\- Git

\- Conexión a Internet



Docker Desktop debe estar iniciado antes de ejecutar los servicios Docker.



Se puede comprobar con:



```powershell

docker --version

docker compose version

docker info

```



\### 2. Entrar al repositorio



Abrir PowerShell y ubicarse en la carpeta del proyecto.



Ejemplo:



```powershell

cd "C:\\Fuera de Onedrive\\Proyecto IoT infra 2\\Sensado-agroclimatico-Dragino-Modbus"

```



Comprobar la rama actual:



```powershell

git branch --show-current

```



Durante el desarrollo se utiliza la rama:



```text

develop

```



\### 3. Configurar variables de entorno



El repositorio incluye:



```text

.env.example

```



Este archivo sirve únicamente como plantilla y no contiene credenciales reales.



Crear un archivo `.env` a partir de esta plantilla y completar localmente los valores requeridos.



El archivo debe contener las variables necesarias para InfluxDB y Grafana:



```text

INFLUXDB\_ADMIN\_USER=

INFLUXDB\_ADMIN\_PASSWORD=

INFLUXDB\_ORG=

INFLUXDB\_BUCKET=

INFLUXDB\_ADMIN\_TOKEN=



GRAFANA\_ADMIN\_USER=

GRAFANA\_ADMIN\_PASSWORD=

```



No subir `.env` al repositorio.



El archivo `.gitignore` está configurado para excluirlo.



\### 4. Levantar InfluxDB



Con Docker Desktop iniciado, desde la raíz del repositorio ejecutar:



```powershell

docker compose up -d influxdb

```



Comprobar el estado:



```powershell

docker compose ps

```



El contenedor esperado es:



```text

iot-influxdb

```



InfluxDB queda disponible en:



```text

http://localhost:8086

```



La configuración utilizada actualmente es:



```text

Organization: agricultura

Bucket: sensores\_agricolas

Measurement: sensores

```



Los datos se almacenan en un volumen persistente de Docker:



```text

iot-agricola-influxdb-data

```



Por lo tanto, detener o reiniciar el contenedor no elimina las mediciones almacenadas.



\### 5. Levantar Node-RED



Actualmente Node-RED se ejecuta de forma nativa en Windows utilizando un directorio aislado dentro del proyecto.



Desde la raíz del repositorio ejecutar:



```powershell

node-red --userDir ".\\runtime\\node-red"

```



Mantener esta terminal abierta mientras Node-RED esté funcionando.



Node-RED queda disponible en:



```text

http://localhost:1880

```



El flujo actualmente implementado realiza:



```text

TTN MQTT/TLS

&#x20;   ↓

Normalización del uplink

&#x20;   ↓

Validación de datos NPK

&#x20;   ↓

Preparación de fields, tags y timestamp

&#x20;   ↓

InfluxDB

```



El flujo versionado se encuentra en:



```text

node-red/flows.json

```



El directorio:



```text

runtime/node-red/

```



es local y está excluido de Git porque contiene información de ejecución y configuración privada.



\### 6. Credenciales de Node-RED



Para recibir datos desde TTN, la configuración MQTT de Node-RED requiere credenciales privadas de The Things Network.



Estas credenciales no están incluidas en `flows.json` ni en el repositorio.



La conexión utilizada actualmente corresponde a:



```text

Servidor MQTT: nam1.cloud.thethings.network

Puerto TLS: 8883

Protocolo: MQTT 3.1.1

Topic: v3/+/devices/+/up

```



Las credenciales deben configurarse localmente en Node-RED.



La conexión de Node-RED con InfluxDB utiliza:



```text

URL: http://localhost:8086

Organization: agricultura

Bucket: sensores\_agricolas

Measurement: sensores

```



El token de InfluxDB debe configurarse localmente y nunca almacenarse en Git.



\### 7. Comprobar recepción de datos



Con InfluxDB y Node-RED funcionando, los uplinks enviados por los sensores deberían recorrer:



```text

Sensor

&#x20; ↓

Dragino

&#x20; ↓

LoRaWAN

&#x20; ↓

MikroTik

&#x20; ↓

TTN

&#x20; ↓

Node-RED

&#x20; ↓

InfluxDB

```



En Node-RED se pueden comprobar los mensajes mediante los nodos Debug del flujo.



En InfluxDB se pueden consultar las mediciones desde Data Explorer utilizando:



```text

Bucket: sensores\_agricolas

Measurement: sensores

```



Los fields NPK almacenados actualmente son:



```text

nitrogen

phosphorus

potassium

```



y los principales tags son:



```text

device\_id

node

sensor\_type

```



Ejemplos de identificación:



```text

device\_id = rs485-lb-01

node = npk-01

sensor\_type = npk

```



```text

device\_id = rs485-lb-02

node = npk-02

sensor\_type = npk

```



Las mediciones de nitrógeno, fósforo y potasio se manejan en `mg/kg`.



\### 8. Detener los servicios



Para detener los servicios administrados por Docker Compose:



```powershell

docker compose down

```



Este comando detiene y elimina los contenedores y la red del Compose, pero conserva los volúmenes persistentes.



No utilizar:



```powershell

docker compose down -v

```



salvo que se desee eliminar intencionalmente los volúmenes y sus datos.



Node-RED se detiene con:



```text

Ctrl + C

```



en la terminal donde está ejecutándose.



\### 9. Volver a levantar el sistema



Después de reiniciar el computador, el procedimiento actual es:



1\. Iniciar Docker Desktop.

2\. Abrir PowerShell en la raíz del repositorio.

3\. Levantar InfluxDB:



```powershell

docker compose up -d influxdb

```



4\. Levantar Node-RED:



```powershell

node-red --userDir ".\\runtime\\node-red"

```



5\. Comprobar Node-RED:



```text

http://localhost:1880

```



6\. Comprobar InfluxDB:



```text

http://localhost:8086

```



7\. Verificar que los uplinks de TTN estén llegando y almacenándose.



\## Estado actual



Actualmente están validados de extremo a extremo:



```text

rs485-lb-01 → TTN → Node-RED → InfluxDB

rs485-lb-02 → TTN → Node-RED → InfluxDB

```



Los dos sensores NPK físicos escriben correctamente datos reales en InfluxDB.



\### Pendiente



Las siguientes etapas son:



\- Configurar Grafana con InfluxDB.

\- Crear dashboards para los sensores NPK.

\- Versionar el provisioning de Grafana.

\- Contenedizar Node-RED.

\- Validar el ecosistema completo mediante Docker Compose.

\- Documentar el despliegue final.

\- Integrar posteriormente el sensor ambiental.

