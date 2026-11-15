# Filtro geográfico

- **Geometría:** geoBoundaries gbOpen PAN ADM0 y ADM1 (provincias y comarcas), CRI ADM0 y COL ADM0, versión simplificada, licencia CC BY 4.0. Simplificada con Douglas-Peucker (~0.003–0.008°) y redondeada a 3 decimales: `src/data/panama-geo.json`.
- **SRID:** WGS84 (EPSG:4326), orden [longitud, latitud] como en GeoJSON.
- **Clasificación** (`classifyPoint` en `src/features/seismic/geo.ts`):
  1. *Territorio panameño*: punto dentro del multipolígono nacional (ray casting con huecos). Se asigna provincia/comarca por el mismo método.
  2. *Zona marítima próxima*: fuera del territorio, no dentro de Costa Rica ni Colombia, y a ≤ 150 km del límite nacional (distancia punto-segmento con proyección equirectangular local).
  3. *Fuera de cobertura*: se descarta; la cantidad descartada se informa en el Resumen.
- No se filtra por el texto «Panama» del lugar reportado.
- Pruebas: Ciudad de Panamá (dentro), David → Chiriquí, San José de Costa Rica (fuera), Pacífico al sur de Chiriquí (marítimo), Pacífico lejano (fuera).
