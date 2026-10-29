# Sensado agroclimático

Vista operativa con React, Vite, JavaScript y CSS. Sin librerías de gráficas,
estado global ni conexión directa a InfluxDB. La API de lectura vive en `../api/`.

## Desarrollo

Node compatible con Vite: `^20.19.0 || >=22.12.0`.

```sh
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Funcionalidad

Tres NPK y un BYX simulados; últimas lecturas, vigencia, histórico SVG con
filtros y tabla accesible; actualización, carga, error y reintento. Fechas de
Colombia y estilos para móvil/tablet. Grafana enlaza a http://localhost:3000;
requiere que el servicio local esté disponible y no configura sus dashboards.

El escenario incluye un NPK con lectura de 47 minutos. Umbral inicial: 30 minutos,
pendiente de confirmar contra la cadencia real. Los timestamps se fijan al
cargar la sesión: actualizar no inventa uplinks; recargar reinicia el escenario.

## Organización

- components/: tabla NPK, ambiente, histórico y primitivas de lectura.
- pages/: composición de pantalla.
- hooks/: consulta y ciclo de actualización.
- services/: adaptador asíncrono y cálculo de vigencia.
- data/: catálogo y fixtures.
- styles/: tokens y estilos adaptables.

Ver [contrato](docs/data-contract.md) y [arranque de la API](../api/README.md).
El proveedor predeterminado es mock. Para datos reales, arrancar la API y ejecutar
en PowerShell `$env:VITE_MONITORING_PROVIDER = 'api'` antes de `npm.cmd run dev`.
Para volver a mock, usar `'mock'` y reiniciar Vite. El proxy de desarrollo envía
`/api` a `http://127.0.0.1:8000`; el frontend no recibe credenciales de InfluxDB.
Los proveedores y sus pruebas están en `src/services/providers/`.
