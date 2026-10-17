# Del simulador al hardware real

Qué cambia cuando los sensores reales (JXBS-3001-BYX y JXBS-3001-NPK-RS, vía
RS485-LB y TTN) reemplacen a `publisher.py`, y qué se queda igual.

```
HOY:    publisher.py → Mosquitto local → Node-RED → InfluxDB → Grafana

REAL:   Sensores → RS485-LB → Gateway → TTN (+ decoder) → Node-RED → InfluxDB → Grafana
```

## 0. Qué está verificado y qué no

| Pieza | Estado |
|---|---|
| Funciones de Node-RED de las secciones 5 y 6 | Probadas en Node.js con un uplink **sintético** (estructura de TTN v3, valores inventados) |
| Datos del mensaje de TTN (`uplink_message.decoded_payload`, etc.) | De la documentación de formato de TTN v3; contrástenlos con un uplink real |
| Menús de la consola de TTN, nombres de clúster, puertos | **No verificados** aquí: confírmenlos en su consola y en la documentación de TTN |
| Formato de bytes que envía el RS485-LB | **No verificado**: depende de la configuración de comandos; el decoder se escribe contra bytes reales (sección 3) |

## 1. Qué cambia y qué no

| Pieza | Con hardware real |
|---|---|
| `publisher.py` | Sale del camino real (se conserva para pruebas, sección 7) |
| Mosquitto local | Ya no es la fuente de datos reales |
| Decoder de TTN | **Nuevo**: sustituye a `generar_valor()` |
| `mqtt in` | Apunta al broker de TTN |
| Funciones de entrada | **Nuevas**: extraer y separar (sección 5) |
| Limpieza de `-999`, `influxdb out` | Sin cambios |
| InfluxDB y Grafana | Sin cambios |

## 2. Antes de tocar Node-RED: lo que debe estar funcionando

En este orden (cada paso se prueba antes del siguiente):

1. Sensores con alimentación correcta (BYX con fuente externa de 12 V y **GND
   común** con el Dragino; NPK según lo definido en el plan).
2. Dragino configurado para consultar por Modbus (`AT+MOD=1`, comandos,
   `AT+MBFUN`, baudios). Ver la fase de hardware del plan de implementación.
3. Gateway MikroTik en línea y **registrado en TTN** con su Gateway EUI.
4. Banda **AU915** con la misma sub-banda en el Dragino y en el gateway.
5. Aplicación y dispositivo creados en TTN (OTAA con DevEUI, AppEUI y AppKey).
6. El dispositivo hace *join* y aparecen uplinks en **Live data** de la consola.

Solo con el paso 6 cumplido tiene sentido seguir con este documento.

## 3. Decisiones de diseño que hay que tomar antes

### 3.1 Direcciones Modbus

Los dos sensores vienen con dirección `0x01` por defecto. Si comparten el mismo
bus RS485 (A y B conectados al mismo Dragino), **chocan**. Hay que asignar una
dirección distinta a cada uno (el NPK permite cambiarla en el registro `0x0100`;
revisen el procedimiento en el manual de cada sensor) y que los comandos del
Dragino consulten cada dirección.

### 3.2 ¿Un Dragino por sensor, o uno para varios?

| Opción | Efecto en Node-RED |
|---|---|
| **Un Dragino por tipo de sensor** | Un `device_id` por tipo. El flujo actual (`switch` por dispositivo) casi no cambia |
| **Un Dragino con ambos sensores** | Un solo `device_id` entrega clima **y** suelo en el mismo uplink. Hay que separarlo en Node-RED (sección 5) |

Si solo hay un RS485-LB, será la segunda opción. En el simulador cada sensor
era un dispositivo distinto; en la realidad puede no serlo.

Si el uplink trae muchos valores, revisen también el **tamaño máximo de payload**
al data rate que use la red (a velocidades bajas el límite es pequeño) y si el
Dragino reparte las respuestas en varios uplinks.

## 4. El decoder de TTN

El Dragino manda **bytes**. El decoder (JavaScript, en la consola de TTN:
*dispositivo o aplicación → Payload formatters → Uplink → Custom JavaScript*)
los convierte en campos con nombre. Su estructura:

```javascript
function decodeUplink(input) {
    // input.bytes = arreglo de bytes, input.fPort = puerto
    const data = {};
    // ... aquí se interpretan los bytes ...
    return { data: data, warnings: [], errors: [] };
}
```

### Cómo construirlo sin adivinar

1. Con el dispositivo funcionando, miren un uplink real en **Live data** y anoten
   los bytes (`frm_payload`, en hexadecimal).
2. Comparen con el manual del RS485-LB (qué antepone el módulo a la respuesta
   Modbus) y con las respuestas Modbus de cada sensor.
3. Dragino publica decoders para sus productos: busquen el del RS485-LB y úsenlo
   como base, verificándolo contra los bytes reales.
4. Prueben el decoder con el panel de pruebas de TTN antes de activarlo.

### Reglas que el decoder debe cumplir

- **Mismos nombres** que usa todo lo demás: `humedad`, `temperatura`, `co2`,
  `pm25`, `pm10`, `gas`, `iluminancia`, `presion`, `ruido`, `nitrogeno`,
  `fosforo`, `potasio`. Son la lista de referencia (`COLUMNAS_*` del script).
- **Aplicar las escalas** de los sensores:

| Campo | Registro | Conversión |
|---|---|---|
| humedad | `0x0000` | valor ÷ 10 (%RH) |
| temperatura | `0x0001` | valor ÷ 10 (°C), **con signo** (complemento a dos) |
| pm25 | `0x0004` | directo (µg/m³) |
| co2 | `0x0005` | directo (ppm) |
| gas | `0x0006` | valor ÷ 10 (ppm) |
| iluminancia | `0x0007`–`0x0008` | **dos registros** de 16 bits unidos en uno de 32 (lux) |
| pm10 | `0x0009` | directo (µg/m³) |
| presion | `0x000A`–`0x000B` | **dos registros** unidos en 32 bits, × 0,01 (kPa) |
| ruido | `0x000C` | valor ÷ 10 (dB) |
| nitrogeno / fosforo / potasio | `0x001E` / `0x001F` / `0x0020` | directo (mg/kg) |

- **Dato inválido → `-999`.** Confirmen en el manual qué valor devuelve cada
  sensor cuando no tiene lectura y conviértanlo a `-999`, para que la limpieza
  que ya existe lo siga descartando.

## 5. Node-RED: conectarse a TTN

### 5.1 Datos de conexión

En la consola de TTN: la aplicación → **Integrations → MQTT**. Ahí aparecen:

| Dato | Dónde |
|---|---|
| Servidor | Dirección de su clúster (es la misma que aparece en la URL de su consola) |
| Usuario | `{id-de-la-aplicacion}@ttn` (o el tenant que corresponda) |
| Contraseña | Una **API key** que se genera en esa misma página |

La API key **se muestra una sola vez**: cópienla en ese momento.

### 5.2 Nodo de configuración del broker

Creen un broker nuevo en Node-RED (el de Mosquitto local se queda aparte):

- Server: el de TTN. Preferir la conexión **cifrada** (puerto 8883 con TLS
  activado en el nodo) a la de texto plano.
- Pestaña **Security**: usuario y contraseña (la API key).

### 5.3 Nodo `mqtt in`

- Topic: `v3/{id-de-la-aplicacion}@ttn/devices/+/up`
- Output: **a parsed JSON object**

## 6. Node-RED: las dos funciones nuevas

El mensaje de TTN no se parece al del simulador: los valores están anidados.
Se agregan dos funciones entre el `mqtt in` y la limpieza.

```
[mqtt in TTN] → [Extraer de TTN] → [Separar por sensor] ─┬─ salida 1 → [Limpiar clima] → [influxdb out]
                                                         └─ salida 2 → [Limpiar suelo] → [influxdb out]
```

Con esto el nodo `switch` ya no hace falta en la rama real. Si usan un Dragino
por tipo de sensor (sección 3.2) pueden seguir usando un `switch` por `device_id`.

### Función 1: `Extraer de TTN` (1 salida)

```javascript
const up = msg.payload;
const decoded = up.uplink_message && up.uplink_message.decoded_payload;

if (!decoded) {
    node.warn("Uplink sin decoded_payload (falta el payload formatter?)");
    return null;
}

msg.payload = {
    device_id: up.end_device_ids.device_id,
    timestamp: up.received_at,
    ...decoded
};
return msg;
```

### Función 2: `Separar por sensor` (**2 salidas**: ajústenlo en la pestaña Setup)

```javascript
const CLIMA = ["humedad","temperatura","pm25","co2","gas","iluminancia","pm10","presion","ruido"];
const SUELO = ["nitrogeno","fosforo","potasio"];

const base = msg.payload;
const clima = {};
const suelo = {};
for (const k of CLIMA) if (k in base) clima[k] = base[k];
for (const k of SUELO) if (k in base) suelo[k] = base[k];

const meta = { device_id: base.device_id, timestamp: base.timestamp };
const salidas = [null, null];
if (Object.keys(clima).length > 0) salidas[0] = { ...msg, payload: { ...meta, type: "clima", ...clima } };
if (Object.keys(suelo).length > 0) salidas[1] = { ...msg, payload: { ...meta, type: "suelo", ...suelo } };
return salidas;
```

Esta función entrega a la limpieza el mismo formato que daba el simulador
(`device_id`, `type`, `timestamp` y los campos), por eso la limpieza no cambia.

### Si usan dos Dragino distintos

Cada uno tiene su `device_id`; la función 2 no es necesaria y un `switch` por
`msg.payload.device_id` reparte a cada rama.

## 7. Qué hacer con el simulador

No lo borren: sirve para probar Grafana y los cambios en el flujo sin esperar
los 10-30 minutos entre lecturas reales, y para trabajar sin el hardware a mano.

**Pero no mezclen datos simulados con reales.** Dos formas de separarlos:

- **Bucket aparte** (ej. `agro_test`) con su propio token, y el simulador en una
  pestaña de Node-RED distinta (*Simulador*) que escriba ahí.
- O identificadores claramente falsos (`sim-byx-01`) para poder filtrarlos.

La opción del bucket aparte es la más limpia: lo real queda sin contaminar y
Grafana puede apuntar a uno u otro.

## 8. Orden de trabajo y cuándo está "listo"

| Paso | Está listo cuando |
|---|---|
| 1. Hardware y TTN (sección 2) | Hay uplinks en Live data |
| 2. Decoder | El panel de pruebas de TTN devuelve campos con nombre y escala correctos |
| 3. Uplinks decodificados | Live data muestra `decoded_payload` con valores razonables |
| 4. `mqtt in` de TTN | El nodo muestra *connected* y el debug muestra el mensaje completo |
| 5. Funciones nuevas | La salida 1 y 2 muestran objetos con `type`, `device_id` y campos |
| 6. Limpieza + InfluxDB | Los datos aparecen en el bucket real |
| 7. Grafana | Los paneles muestran lo mismo que Live data |

## 9. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El `mqtt in` de TTN no conecta | Usuario o API key mal copiados, puerto/TLS no coinciden |
| Llegan mensajes pero la función 1 avisa "sin decoded_payload" | Falta el decoder o no está guardado en el dispositivo/aplicación |
| Valores absurdos (temperatura ×10, presión enorme) | Falta aplicar la escala o unir los dos registros |
| Temperaturas negativas aparecen como 6553x | Falta interpretar el signo (complemento a dos) |
| Nada llega a TTN | Problema de hardware/red: volver a la sección 2 |
| Datos del simulador mezclados con los reales | Ver sección 7 |

## 10. Qué no subir al repo

- La **API key de TTN** y la contraseña del broker: nunca en `flows.json`
  (Node-RED no las exporta) ni en archivos del repo.
- Las claves del dispositivo (**AppKey**, DevEUI, AppEUI): tampoco.
- Guárdenlas en un gestor de contraseñas o en un `.env` local, y agreguen
  `.env` al `.gitignore`.