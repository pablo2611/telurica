<div align="center">

<img src="docs/banner.png" alt="Telúrica — monitor sísmico de Panamá en tiempo real" width="100%">

# Telúrica

**Sismos en Panamá, en tiempo real.**

[Abre Telúrica en producción](https://telurica-panama.vercel.app)
Detecciones en vivo de EMSC y USGS, filtradas al territorio panameño y su zona marítima, con mapa, historial, análisis y alertas en el navegador.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack-Start-ff4154)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/licencia-MIT-green)
[![CI](https://github.com/pablo2611/telurica/actions/workflows/ci.yml/badge.svg)](https://github.com/pablo2611/telurica/actions/workflows/ci.yml)

</div>

> ⚠️ **No predice terremotos ni reemplaza los avisos oficiales.** Ante una emergencia siga a [SINAPROC](https://www.sinaproc.gob.pa/alertas/) y llame al 911.

## ✨ Qué hace

| Vista | Descripción |
|---|---|
| **Resumen** | Feed en vivo (WebSocket EMSC + USGS), cifras de 30 días, mapa, registro, datos de impacto USGS y titulares |
| **Monitor** | Mapa interactivo (MapLibre) con filtros de magnitud, capas y cronología |
| **Tectónica** | 5 placas, 7 límites y 6 fallas con enlace al mapa y diagrama del subsuelo |
| **Historial** | Archivo hasta 400 días con exportación CSV/GeoJSON |
| **Análisis** | Gráficos de actividad (ECharts) |
| **Alertas** | Reglas por magnitud, zona, provincia, profundidad y fuente; sonido, vibración y notificaciones del navegador |
| **Educación** | Qué hacer antes, durante y después de un sismo |
| **Fuentes** | Estado en vivo de USGS, EMSC y NOAA |

## ⚡ Tiempo real — cómo funciona

```
EMSC WebSocket (push) ─┐
                       ├─► navegador: filtro geográfico ─► "Detección en vivo" + sync inmediata
USGS all_hour (servidor) ─┘                                         │
                                                                 ▼
             servidor (TanStack Start): USGS FDSN + EMSC FDSN ─► dedupe ─► clasificación ─► alertas
```

1. El navegador abre `wss://www.seismicportal.eu/standing_order/websocket` (EMSC) y solicita cada 30 s el feed `all_hour.geojson` de USGS a una server function con caché compartida. El servidor llama al endpoint oficial y filtra su recuadro.
2. Si aparece un sismo dentro de Panamá o a ≤ 150 km de su costa, se muestra al instante como **dato preliminar** y se pide al servidor una sincronización sin caché.
3. El servidor consolida ambas agencias (deduplicación por hora, distancia y magnitud) y las reglas de alerta se evalúan sobre esos datos confirmados.

Todas las APIs son **públicas y sin clave**. Detalles en [`API_SOURCES.md`](API_SOURCES.md) y [`ALERT_SYSTEM.md`](ALERT_SYSTEM.md).

## 🛰️ Mapa satelital 3D

El Monitor usa MapLibre GL (WebGL, fluido incluso en móvil) con:

| Capa | Fuente | Notas |
|---|---|---|
| Satélite + etiquetas | Esri World Imagery / World Boundaries and Places | Atribución obligatoria; revisa los [términos de Esri](https://www.esri.com/en-us/legal/terms/full-master-agreement) si el uso es comercial |
| Mapa oscuro | CARTO dark_all | © OpenStreetMap · © CARTO |
| Relieve 3D real | AWS Terrain Tiles (terrarium) | Datos abiertos, sin clave |
| Fallas y placas | `src/data/tectonics.ts` | Trazas simplificadas (UP, IGC, Kellogg et al.) |

Controles: Satélite/Oscuro, Relieve 3D, Fallas, Columnas (altura por magnitud) y Calor. Los sismos de las últimas 24 h laten en el mapa.

**Demo sin instalar nada:** abre `demo/telurica-mapa-satelital.html` en tu navegador (necesita internet): mapa satelital, relieve 3D y datos en vivo de USGS y EMSC.

## 🚀 Arranque local

Requisitos: **Node.js 22** y npm. La versión está fijada en `.nvmrc`.

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # pruebas (Vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run build      # build de producción (.output/)
npm start          # sirve el build con Node
```

## ☁️ Despliegue

El build usa [Nitro](https://nitro.build), que detecta el proveedor automáticamente:

- **Vercel:** importa el repo `pablo2611/telurica`, selecciona TanStack Start, Node 22 y `npm run build`. Deja la salida en la configuración automática de Nitro y no añadas variables de entorno. Desde CLI, ejecuta `npx vercel link` y `npx vercel --prod`.
- **Node / VPS / Docker:** `npm run build && node .output/server/index.mjs`.
- **Cloudflare:** `NITRO_PRESET=cloudflare_module npm run build`.

## 🧱 Stack

React 19 · TypeScript · Vite · TanStack Start / Router / Query · Tailwind CSS v4 · Motion · MapLibre GL · Apache ECharts · Zod · Radix UI · Lucide.

Componentes animados en [`src/components/reactbits/`](src/components/reactbits) inspirados en [React Bits](https://www.reactbits.dev) (BlurText, CountUp, SpotlightCard, AnimatedList, StarBorder, ShinyText, GradientText, Magnet, DecryptedText, ClickSpark y un fondo de sismograma en canvas), reimplementados sin dependencias extra.

## 📁 Estructura

```
src/
├── routes/                 # Páginas (rutas por archivo)
├── features/seismic/       # Adaptadores, dedupe, geo, alertas, tiempo real
├── components/
│   ├── reactbits/          # Primitivas animadas
│   ├── seismic/            # Piezas de dominio (magnitud, feed en vivo…)
│   ├── map/ charts/ site/  # Mapa, gráficos, layout
│   └── ui/                 # shadcn/ui + Magic UI + Aceternity
├── data/panama-geo.json    # Límites (geoBoundaries, CC BY 4.0)
└── test/                   # Vitest
```

Más documentación: `DATA_ARCHITECTURE.md`, `GEOGRAPHIC_FILTERING.md`, `DESIGN_SYSTEM.md`, `COMPONENTS_SOURCES.md`, `SECURITY.md`, `TESTING.md`, `BROWSER_COMPATIBILITY.md`.

## 🎨 Marca

| Recurso | Archivo |
|---|---|
| Isotipo (SVG) | `public/favicon.svg` · `docs/logo.svg` |
| Logotipo horizontal | `docs/logo-full.png` |
| Imagen social (1200×630) | `public/og-image.png` |
| Iconos app | `public/icon-192.png` · `public/logo-512.png` · `public/apple-touch-icon.png` |
| Componente React | `src/components/brand/Logo.tsx` |

Colores: fondo `#0b1519`, acento `#5fd0d6`, epicentro `#f39a3c`. Tipografía de marca: Inter Tight 600.

## 📜 Licencia

[MIT](LICENSE). Datos: USGS (dominio público), EMSC, NOAA. Límites: geoBoundaries (CC BY 4.0). Mapa base: © OpenStreetMap contributors / OpenFreeMap.

## Savia · conversación con datos

La sección `/savia` usa NVIDIA Nemotron 3.5 Lightning y el catálogo real de Telúrica. No tiene cuotas por usuario, IP, minuto, día o mes. Redis es una caché opcional de un minuto: su caída no bloquea la IA. La infraestructura y NVIDIA conservan sus límites propios de servicio.

### Respuestas y visualizaciones

La pregunta puede solicitar tablas, mapas o gráficas, y varias visualizaciones a la vez. Toda consulta admitida, incluidas tablas y mapas, solicita una explicación a NVIDIA. Las cifras y visualizaciones se calculan con el catálogo. Se incluyen automáticamente dentro de la respuesta y también pueden alternarse con sus botones, sin volver a llamar a NVIDIA. La tabla admite registros, provincias, actividad diaria y fuentes. Las gráficas muestran provincias o evolución temporal. Los mapas se encuadran en los epicentros de la región solicitada y permiten abrir una ficha en el Monitor.

Savia detecta períodos escritos en la pregunta y permite 24 horas, 7, 30 o 90 días y un año. Filtra las provincias mencionadas antes de calcular los agregados. Los seguimientos pueden reutilizar la región de la pregunta anterior. La conversación se mantiene durante la sesión de la página, con las últimas cuatro preguntas como contexto acotado del modelo.

La petición usa eventos SSE para comunicar las fases reales de consulta de fuentes, inferencia y preparación del resultado. Estas fases son estados de la aplicación. El razonamiento interno del modelo no se expone. El usuario puede detener la consulta desde el indicador o el formulario, y limpiar el chat incluso durante una petición. Limpiar cancela la petición y descarta respuestas tardías. El indicador muestra segundos reales y avisa al superar 12 segundos; la espera total del navegador está acotada a 45 segundos; el navegador no reenvía solicitudes automáticamente. Salir de la página cancela la petición activa. Ante un fallo transitorio o una respuesta inválida se realiza un único intento de reparación. No se sustituye la respuesta de IA por prosa automática del catálogo. Si NVIDIA no está disponible tras ambos intentos, se muestra el error real y se conserva la pregunta para volver a enviarla.

Las cifras se calculan mediante el pipeline sísmico y se muestran sin HTML generado por el modelo. Las explicaciones de IA pueden contener errores. El mapa representa densidad observada durante el período. Para decidir sobre un terreno se requieren estudios geotécnicos, microzonificación, normativa y profesionales.

### Configuración privada

| Variable | Uso |
| --- | --- |
| `NVIDIA_API_KEY` | Secreto NVIDIA en Vercel |
| `SAVIA_ENABLED` | `true` para activar la inferencia |
| `UPSTASH_REDIS_REST_URL` o `KV_REST_API_URL` | Caché Redis REST opcional |
| `UPSTASH_REDIS_REST_TOKEN` o `KV_REST_API_TOKEN` | Token de la caché |
| `SAVIA_HASH_SECRET` | Secreto opcional para claves HMAC de caché |

Las preguntas se envían a NVIDIA con un resumen del catálogo. El servidor no guarda el historial de conversaciones. No introducir datos personales. Una clave compartida accidentalmente debe revocarse y reemplazarse.

### Control de infraestructura y despliegues

El proyecto se publica únicamente en `solventeluzclaridadcam12-6345s-projects`, con Node 22 y plan Hobby. `vercel.json` desactiva los despliegues automáticos de Git. Las pruebas y compilaciones se ejecutan en GitHub, y la publicación se hace manualmente tras verificarlas. La concurrencia de CI cancela comprobaciones obsoletas de la misma rama.

Nitro configura un máximo de 60 segundos por ejecución de función. La llamada al modelo tiene un timeout de 12 segundos por intento (máximo dos intentos) y una salida máxima de 1500 tokens. Son protecciones de recursos por operación, sin contadores que bloqueen futuras preguntas. La protección DDoS de Vercel permanece activa. Se desactiva la antigua regla específica de seis POST por minuto para Savia.

La caché usa el plan gratuito de Upstash con autoUpgrade=false, prodPack=false y eviction=false. No se activa facturación automática ni se cambia el plan. Hobby tiene límites de infraestructura establecidos por Vercel y puede suspender recursos al agotarlos. Los límites de NVIDIA son independientes.

### Verificación

CI ejecuta compilación, regeneración de rutas, pruebas, lint y typecheck con Node 22. Comprueba seguridad de entrada, independencia de la caché, consultas repetidas sin cuotas, fases SSE y selección de tablas, mapas, regiones y períodos. Un workflow manual separado verifica el navegador a 390, 1024 y 1366 px en GitHub.


### Mapas estadísticos por zonas

Savia y la opción «Zonas sísmicas» del Monitor muestran hexágonos fijos de ~374 km², con recuentos o magnitud máxima, leyenda numérica y fichas al tocar una zona. La tabla de zonas de Savia permite ordenar, consultar la proporción del catálogo y encuadrar cada zona con teclado o pantalla táctil. La agregación usa todo el catálogo; el límite de 300 aplica únicamente a los puntos individuales. Los colores representan actividad registrada durante el período y filtros elegidos. El enlace a GEM abre el modelo probabilístico oficial de amenaza a largo plazo. Metodología y limitaciones en API_SOURCES.md.


Las consultas «ayer», «anteayer» y «hoy» utilizan días de calendario de Panamá (UTC−5), con fin exclusivo, en lugar del período general seleccionado. Las respuestas con cifras presentes en el contexto ya no se rechazan por contener dígitos. Las cifras ajenas al contexto y las afirmaciones de seguridad siguen rechazándose. Las preguntas y respuestas no se escriben en logs: solo se registra la categoría del fallo por intento.
