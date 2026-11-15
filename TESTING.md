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

## Verificación del despliegue

- `npm test`: 25 pruebas, incluida la conservación de los indicadores de impacto de USGS.
- `npm run typecheck` y `npm run build` forman parte de CI. ESLint valida reglas de código y Prettier se ejecuta mediante `npm run format`.
- Avisos conocidos: 10 de Fast Refresh por módulos que también exportan utilidades, y uno de dependencias de hooks en Análisis. TanStack avisa que `.inputValidator()` está obsoleto, pero el proyecto conserva la API solicitada. Vite informa del tamaño de los paquetes dinámicos de MapLibre y ECharts.
- En el entorno local, el feed horario de USGS devolvió HTTP 403. En producción, la consulta al mismo endpoint desde Vercel respondió correctamente. El indicador distingue una respuesta satisfactoria de una fuente sin respuesta.
