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
