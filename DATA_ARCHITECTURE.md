# Arquitectura de datos

```text
USGS ─┐
      ├─> adaptadores (Zod + normalización) ─> deduplicación ─> filtro geográfico ─> caché 60 s ─> vistas
EMSC ─┘
```
Archivos: `src/features/seismic/{adapters,dedupe,geo,pipeline,seismic.functions}.ts`.

## Modelo normalizado (`SourceReport`)
`sourceId`, `externalId`, `magnitude|null`, `magnitudeType|null`, `latitude`, `longitude`, `depthKm|null`, `occurredAtUtc`, `updatedAt|null`, `placeReported|null`, `reviewStatus|null`, `author|null`, `sourceUrl`.

## Evento consolidado (`SeismicEvent`)
`id` (`fuente:idExterno` del reporte principal), `primary`, `reports[]` (todas las mediciones), `classification` (`panama|maritima`), `province`, `nearestProvince` (solo marítimos, referencia), `receivedAt`.

- Los datos ausentes quedan en `null`; nunca se convierten a 0.
- Fechas en UTC (ISO 8601); la hora visible se deriva con `America/Panama` en formato DD/MM/AAAA y 24 h.
- Persistencia: no hay base de datos propia. Las agencias conservan sus catálogos; la app los consulta por rango. Caché en memoria del servidor (60 s, consulta única compartida entre visitantes).
- Exportación CSV/GeoJSON con los campos de `EXPORT_FIELDS` (`src/features/seismic/export.ts`), respetando los filtros activos.
