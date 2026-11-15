# Sistema de alertas

- **Reglas:** magnitud mínima, zona (tierra/mar), provincia, profundidad máxima, fuentes. Varias reglas por usuario.
- **Persistencia:** `localStorage` del navegador (no hay cuentas). Claves `psw:alert-prefs:v1`, `psw:alert-log:v1`, `psw:seen-events:v1`.
- **Motor** (`AlertWatcher`, montado en todas las páginas): con cada actualización (60 s) aplica `planNotifications`:
  1. La primera carga fija una línea base: no se notifican eventos ya existentes.
  2. Solo eventos nuevos, clasificados y que cumplan la regla.
  3. Cada par regla+evento se registra antes de entregarse; nunca se repite.
  4. Canales: aviso en la página (siempre), notificación del navegador (si hay permiso) y sonido (si está activado).
  5. Resultado o error guardado en el historial.
- **Push en segundo plano:** no implementado (no hay Service Worker ni servidor Web Push). Los avisos funcionan solo con la página abierta, y así se indica en la interfaz.
- Las notificaciones de la plataforma no son avisos oficiales.

## Tiempo real (v2)
- `RealtimeBridge` (en `src/components/site/AlertWatcher.tsx`) inicia `src/features/seismic/realtime.ts`: WebSocket de EMSC con reconexión exponencial (tope 60 s) y sondeo del feed horario de USGS cada 30 s; se reanuda al volver a la pestaña.
- Un sismo nuevo dentro de Panamá o su zona marítima muestra un aviso **preliminar** y fuerza una sincronización del servidor (`fresh: true`, ignora la caché si tiene más de 10 s).
- Las alertas definitivas (sonido, vibración, notificación del navegador y parpadeo del título de la pestaña) se generan sobre los datos consolidados, sin duplicados.
- En `/alertas` hay un botón **Probar alerta** para comprobar los canales.
