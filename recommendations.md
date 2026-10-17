# InfluxDB y cambios en Node-RED

Guía para el siguiente tramo del proyecto: guardar las lecturas en InfluxDB
y, después, mostrarlas en Grafana. Complementa el README principal.

```
publisher.py → Mosquitto → Node-RED (mqtt in → switch → limpieza) → InfluxDB → Grafana
                                                                    ^ estamos aquí
```

## 0. Qué está verificado y qué no

| Pieza | Estado |
|---|---|
| Flujo `mqtt in → switch → function (limpieza)` | Probado en un Node-RED 5.0.8 real con Mosquitto |
| Código de la función de la sección 5 (tags/fields) | Probado en Node.js, incluido el caso borde de todos los campos inválidos |
| Instalación de InfluxDB, rutas de su interfaz web | **No probado**: copien los comandos de la documentación oficial |
| Comportamiento exacto del nodo `influxdb out` | **No probado**: confírmenlo en la pestaña *help* del nodo (ver sección 5) |

Cuando algo de esta guía contradiga la documentación oficial de la versión que
instalen, manda la documentación oficial.

## 1. Qué versión de InfluxDB usar

Usen **InfluxDB v2**. Existe también InfluxDB 3, pero es una línea distinta, con
otra forma de instalar y de consultar; no mezclen sus instrucciones con las de
esta guía. Antes de instalar, confirmen con el profesor qué versión espera.

## 2. Instalación (Ubuntu)

Agregar el repositorio de InfluxData es una operación sensible (instala una
clave GPG en el sistema), así que **copien los comandos directamente de la
página oficial**, que incluye la verificación de la clave y cambia con el tiempo:

- <https://docs.influxdata.com/influxdb/v2/install/> → pestaña Ubuntu/Debian

Después de agregar el repositorio:

```bash
sudo apt-get update
sudo apt-get install influxdb2
sudo systemctl enable --now influxdb
sudo systemctl status influxdb
sudo ss -tlnp | grep 8086        # debe aparecer algo escuchando en el puerto 8086
```

## 3. Configuración inicial

1. Abrir <http://localhost:8086> y pulsar **Get Started**.
2. Crear usuario y contraseña, una **organización** (ej. `universidad`) y un
   **bucket** (ej. `agro`). El bucket es donde se guardan los datos.
3. **Retención:** decidan a propósito. "Never" conserva todo (cómodo para el
   proyecto); un límite como 90 días borra datos viejos automáticamente.
4. La pantalla final muestra un token de administrador. **Guárdenlo** en un
   gestor de contraseñas, no en el repo.

### Tokens: uno por función

No usen el token de administrador en Node-RED ni en Grafana. En la interfaz,
sección *Load Data → API Tokens → Generate API Token → Custom API Token*:

| Nombre | Permiso | Para qué |
|---|---|---|
| `nodered-write` | **Write** sobre el bucket `agro` | Node-RED escribe lecturas |
| `grafana-read` | **Read** sobre el bucket `agro` | Grafana solo consulta |

Si un token se filtra, el daño queda limitado a lo que ese token puede hacer.

## 4. Modelo de datos

| Concepto | Valor | Por qué |
|---|---|---|
| Measurement (clima) | `lecturas_clima` | Una "tabla" por tipo de sensor |
| Measurement (suelo) | `lecturas_suelo` | Idem |
| **Tag** | `device_id` | Texto con pocos valores distintos, sirve para filtrar y agrupar (ej. parcela 1 vs parcela 2) |
| **Fields** | humedad, temperatura, co2, pm25, pm10, gas, iluminancia, presion, ruido / nitrogeno, fosforo, potasio | Los valores medidos |
| Timestamp | hora de llegada al escribir | Suficiente por ahora (ver nota abajo) |

**Tag vs field:** el tag es la etiqueta por la que se busca (`device_id`); el
field es el número que se mide. No pongan como tag algo que cambia siempre
(como un valor medido), porque degrada el rendimiento.

**Tipos:** un field de InfluxDB tiene un solo tipo. Si un día llega un texto
donde antes había un número, InfluxDB rechaza la escritura. Por eso los valores
inválidos se **descartan** (no se reemplazan por texto como "N/A"). Nota: JavaScript
trata `26` y `26.0` como el mismo número, así que con Node-RED en medio el riesgo
no es mezclar enteros con decimales, sino mezclar texto con números.

**Timestamp:** por ahora se usa la hora en que Node-RED escribe. Con el hardware
real los sensores mandan cada 10-30 minutos y la diferencia es mínima. Si luego
quieren usar la hora del mensaje (en TTN, `received_at`), revisen en la ayuda
del nodo cómo pasarla.

## 5. Cambios en Node-RED

### 5.1 Instalar los nodos de InfluxDB

☰ → **Manage palette** → pestaña **Install** → buscar
`node-red-contrib-influxdb` → **Install**.

### 5.2 Ajustar el final de las dos funciones de limpieza

El nodo de salida recibe `msg.payload` como `[ campos, tags ]`. Reemplacen el
final de cada función (las líneas `msg.payload = limpio; return msg;`) por esto,
así que el código completo queda:

```javascript
const INVALIDO = -999;
const limpio = {};
const descartados = [];

for (const [campo, valor] of Object.entries(msg.payload)) {
    if (valor === INVALIDO) {
        descartados.push(campo);
    } else {
        limpio[campo] = valor;
    }
}

if (descartados.length > 0) {
    node.warn(`Descartados en ${msg.payload.device_id}: ${descartados.join(", ")}`);
}

// Separar metadatos (tags) de mediciones (fields)
const { device_id, type, timestamp, ...campos } = limpio;

// Si todos los campos eran invalidos, no hay nada que guardar
// (InfluxDB rechaza un punto sin campos)
if (Object.keys(campos).length === 0) {
    node.warn(`Sin campos validos en ${device_id}: no se guarda`);
    return null;
}

msg.payload = [campos, { device_id }];
return msg;
```

Qué hace la parte nueva: saca `device_id`, `type` y `timestamp` del objeto y deja
en `campos` solo las mediciones. `type` ya no hace falta porque el measurement
distingue clima de suelo, y `timestamp` lo pone InfluxDB al escribir.

### 5.3 Reemplazar los `debug` por `influxdb out`

1. Arrastren un nodo **`influxdb out`** por cada rama.
2. Doble clic → **Server** → lápiz ✏ para crear la conexión:

   | Campo | Valor |
   |---|---|
   | Version | **2.0** |
   | URL | `http://localhost:8086` |
   | Token | el token `nodered-write` |
   | Organization | la que crearon (ej. `universidad`) |
   | Bucket | `agro` (en el nodo) |

3. En el nodo de clima, **Measurement**: `lecturas_clima`. En el de suelo:
   `lecturas_suelo`.
4. **Antes de seguir, confirmen el formato de entrada:** seleccionen el nodo
   `influxdb out` y abran la pestaña **help** (ícono de libro, panel derecho).
   Ahí está documentado qué estructura de `msg.payload` espera. Si difiere de
   `[campos, tags]`, ajusten la sección 5.2.
5. **Recomendación:** no borren los `debug`. Conecten la salida de cada función
   a **ambos** nodos (el `debug` y el `influxdb out`). Así ven en el panel lo
   que se envía y los errores de escritura aparecen junto a los datos.
6. **Deploy.**

### 5.4 Exportar al repo

☰ → **Export** → *all flows* → guardar como `node-red/flows.json`.

La exportación **no incluye el token** (es una característica de Node-RED).
Cada persona que importe el flujo debe escribir su token en el nodo de
configuración de InfluxDB. Eso es lo correcto: el token no debe llegar al repo.

## 6. Verificar que los datos llegan

Con Mosquitto, el publisher y Node-RED corriendo:

1. En la interfaz de InfluxDB: **Data Explorer**.
2. Elegir bucket `agro` → measurement `lecturas_clima` → los fields → **Submit**.

O con una consulta Flux (botón *Script Editor*):

```flux
from(bucket: "agro")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement == "lecturas_clima")
```

Con el publisher a 10 segundos deberían verse unos 6 puntos por minuto en cada
field. Para el suelo, filtren por `r.device_id` para ver cada parcela por
separado. Es normal que algún campo tenga huecos: son los `-999` descartados.

## 7. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `401 unauthorized` en el panel debug | Token mal copiado, sin permiso de escritura, o sobre otro bucket |
| `404` o "bucket not found" | Nombre de bucket u organización distinto al creado |
| `connection refused` al puerto 8086 | Servicio apagado: `sudo systemctl start influxdb` |
| No error, pero Data Explorer vacío | Rango de tiempo muy corto, o measurement mal escrito |
| Error de "field type conflict" | Un field recibió texto donde antes había número |
| Error de punto sin campos | La función no descartó la lectura vacía (revisar el `return null`) |

## 8. Qué no subir al repo

Agreguen al `.gitignore`:

```
.env
flows_cred.json
*.token
```

- Los tokens van en un gestor de contraseñas o en un `.env` local.
- Si versionan la carpeta `~/.node-red` completa (no lo recomendamos), el archivo
  `flows_cred.json` contiene las credenciales cifradas: no debe subirse.

## 9. Siguiente paso: Grafana

Grafana se conecta a InfluxDB como *data source* usando la URL, la organización,
el bucket y el token **`grafana-read`** (el de solo lectura). Eso será la
siguiente guía.