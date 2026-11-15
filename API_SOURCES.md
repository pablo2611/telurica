# Fuentes de datos

| Fuente | Endpoint verificado | Método | Estado |
|---|---|---|---|
| USGS | `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` | FDSN Event, recuadro lat 3.5–11.5, lon −85.5 a −75.5 | Integrada |
| EMSC | `https://www.seismicportal.eu/fdsnws/event/1/query?format=json` | FDSN Event, mismo recuadro; 204 = sin eventos | Integrada |
| EMSC (tiempo real) | `wss://www.seismicportal.eu/standing_order/websocket` | WebSocket push desde el navegador; filtro por recuadro + clasificación | Integrada |
| USGS (tiempo real) | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` | Sondeo cada 30 s a través de una server function (caché por instancia) | Integrada |
| NOAA | `https://www.tsunami.gov/events/xml/PHEBAtom.xml`, `PAAQAtom.xml` | Lectura de boletines Atom | Integrada (solo lectura) |
| UP Geociencias | `https://sismosgeociencias.up.ac.pa/` | — | No integrada: sin API pública documentada |
| SINAPROC | `https://www.sinaproc.gob.pa/alertas/` | — | No integrada: sin canal automatizable; se enlaza |

- Timeout 15 s, 1 reintento con espera progresiva, respuestas validadas con Zod.
- Estados: `operativa` (respuesta < 8 s), `con_retraso` (≥ 8 s), `sin_respuesta` (timeout), `desconectada` (error de red/HTTP), `no_integrada`.
- El fallo de una fuente no detiene a las demás (`Promise.all` sobre resultados que nunca lanzan).

## Teselas del mapa (navegador)
| Servicio | URL | Uso |
|---|---|---|
| Esri World Imagery | `server.arcgisonline.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}` | Vista satelital |
| Esri Reference | `.../Reference/World_Boundaries_and_Places/...` | Etiquetas sobre satélite |
| CARTO | `basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png` | Mapa oscuro |
| AWS Terrain Tiles | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Relieve 3D (terrarium) |

## Daños e impacto y noticias

- USGS ofrece `felt`, `cdi`, `mmi`, `alert` (PAGER) y `tsunami` como campos opcionales del catálogo GeoJSON. Telúrica usa el reporte USGS consolidado del sismo de mayor magnitud de los últimos 30 días. Los valores ausentes se muestran como «Sin datos». PAGER modela el impacto y la marca de tsunami no equivale a un aviso oficial.
- [RSS de Google News](https://news.google.com/rss/search?q=sismo%20Panam%C3%A1&hl=es-419&gl=PA&ceid=PA:es-419): consulta fija desde una server function, con caché de 15 minutos por instancia y tiempo límite de ocho segundos. Se muestran titular, medio, fecha y enlace HTTPS. El sitio no reproduce el texto de los artículos.

El feed horario respondió HTTP 403 sin CORS desde la red de prueba. El sondeo pasa por el servidor de Telúrica para mantener el endpoint oficial y evitar que el navegador falle con CORS.
