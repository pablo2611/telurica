# Pruebas

`npm test` — pruebas con Vitest (incluye `src/test/realtime.test.ts` para la capa en vivo):
- Clasificación geográfica: dentro, provincia, fuera, marítimo, mar lejano.
- Deduplicación: agrupa USGS+EMSC conservando mediciones; respeta los límites de tiempo y distancia; no repite reportes.
- Normalización: valores ausentes quedan en null; EMSC descarta eventos que no son sismos; el pipeline excluye eventos fuera de cobertura.
- Alertas: solo eventos nuevos que cumplen la regla; nunca dos veces la misma regla+evento; respeta la línea base y el interruptor global.
- Formato DD/MM/AAAA y hora de Panamá; la media ignora valores desconocidos; las exportaciones contienen las filas consultadas.
- Enrutamiento: `/` tiene página.

Revisión en navegador (Playwright, Chromium): las siete rutas cargan sin errores de consola con datos reales; en el Monitor, el clic abre el detalle; el cambio de período modifica los resultados; las reglas de alerta persisten tras recargar; la exportación CSV del Historial contiene las filas filtradas.

Los datos ficticios solo existen dentro de `src/test/seismic.test.ts`.
