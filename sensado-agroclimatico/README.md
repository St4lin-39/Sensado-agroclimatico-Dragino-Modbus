# Sensado agroclimático

Vista operativa con React, Vite, JavaScript y CSS. Sin librerías de gráficas,
estado global, backend ni conexión directa a InfluxDB.

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

Ver [contrato propuesto](docs/data-contract.md). Cambiar el adaptador del servicio
por la futura API preservando los DTO; los componentes no conocen InfluxDB,
Flux ni credenciales. Infraestructura y adquisición permanecen sin cambios.
