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
| OpenStreetMap | `tile.openstreetmap.org/{z}/{x}/{y}.png` | Mapa oscuro con tratamiento raster en el navegador |
| AWS Terrain Tiles | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Relieve 3D (terrarium) |

## Daños e impacto y noticias

- USGS ofrece `felt`, `cdi`, `mmi`, `alert` (PAGER) y `tsunami` como campos opcionales del catálogo GeoJSON. Telúrica usa el reporte USGS consolidado del sismo de mayor magnitud de los últimos 30 días. Los valores ausentes se muestran como «Sin datos». PAGER modela el impacto y la marca de tsunami no equivale a un aviso oficial.
- [RSS de Google News](https://news.google.com/rss/search?q=sismo%20Panam%C3%A1&hl=es-419&gl=PA&ceid=PA:es-419): consulta fija desde una server function, con caché de 15 minutos por instancia y tiempo límite de ocho segundos. Se muestran titular, medio, fecha y enlace HTTPS. El sitio no reproduce el texto de los artículos.

El feed horario respondió HTTP 403 sin CORS desde la red de prueba. El sondeo pasa por el servidor de Telúrica para mantener el endpoint oficial y evitar que el navegador falle con CORS.

## Mapa oscuro y Savia

La verificación de producción del 23 de noviembre de 2026 detectó que las teselas públicas CARTO devolvían HTTP 200 con la imagen «API KEY REQUIRED». Se sustituyó esa fuente raster por https://tile.openstreetmap.org/{z}/{x}/{y}.png, con atribución visible de OpenStreetMap y un tratamiento raster desaturado y oscurecido. El satélite Esri y el relieve AWS se mantienen como capas independientes.

Las teselas se solicitan directamente desde el navegador, con su User-Agent y Referer normales y caché HTTP. No se ofrece descarga masiva, precarga de regiones ni uso sin conexión. Política de uso: https://operations.osmfoundation.org/policies/tiles/. La disponibilidad de este servicio comunitario es de mejor esfuerzo.


## Actividad por zonas y amenaza a largo plazo

La antigua interpolación de calor ponderada por magnitud se sustituye por hexágonos de radio 12 km (~374 km²). Se usa una proyección equirectangular local centrada en Panamá (latitud de referencia 8.5°): la variación de área es inferior al 1% entre 6° y 11° N. El identificador y área de cada celda son independientes del zoom. Cada sismo consolidado cuenta una vez; magnitud y profundidad desconocidas conservan null. El color muestra recuentos absolutos (1, 2–4, 5–9, 10–19, ≥20) o magnitud máxima (<3, 3–3.9, 4–4.9, 5–5.9, ≥6). Sin color significa sin registros en la selección; no equivale a amenaza cero. Los porcentajes son proporciones del catálogo, nunca probabilidades futuras.

Savia calcula las celdas en el servidor con todo el catálogo filtrado antes de limitar a 300 los puntos individuales. El Monitor recalcula las celdas al cambiar período, magnitud o capas terrestre/marítima. Las estadísticas no mezclan consultas de períodos diferentes. Los nombres de provincia solo describen la referencia geográfica de cada celda; las celdas pueden cruzar costas o límites provinciales.

Para amenaza probabilística se enlaza el visor oficial de GEM [Global Seismic Hazard Map v2026.1](https://maps.openquake.org/map/gshm-v2026_1/), consultado el 24/11/2026. Describe PGA en roca con 10% de probabilidad de excedencia en 50 años (Vs30=800 m/s); no la probabilidad del próximo sismo. No se digitalizan ni inventan valores PGA, no se copia una capa ArcGIS de terceros ni se sustituye la normativa panameña. [Descripción y licencia GEM](https://www.globalquakemodel.org/product/global-seismic-hazard-map). [USGS: fundamentos de amenaza](https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-hazards-101-basics).
