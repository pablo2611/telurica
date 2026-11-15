## Project rules
- Seismic data flows through `src/features/seismic/` (adapters → dedupe → geo filter) inside TanStack server functions; UI never calls agency APIs directly, so all visitors share one cached upstream request.
- No mock/demo seismic data outside `src/test/`; unknown values stay `null` and the UI says so.
- Geographic classification uses `src/data/panama-geo.json` (geoBoundaries, simplified); do not filter by place-name text.
- MapLibre/ECharts colors must come from CSS tokens via `src/lib/css-color.ts` (they cannot parse oklch).
- Browser-only libs (maplibre-gl, echarts) are dynamically imported inside effects to keep SSR safe.
- Real-time layer (`src/features/seismic/realtime.ts`) is the only client-side code that talks to agencies directly (EMSC WebSocket + USGS summary feed, both public and CORS-enabled). It never replaces the server pipeline: it only signals new events and asks the server for a fresh sync.
- Animated UI primitives live in `src/components/reactbits/` (dependency-free, built on `motion`). Respect `prefers-reduced-motion`.
