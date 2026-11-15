# Seguridad

- Sin secretos: todas las fuentes son públicas. No hay claves en el código.
- Las funciones de servidor validan la entrada con Zod (fechas ISO, rango ≤ 400 días) y las respuestas externas también.
- No existe un endpoint de sincronización manual: el navegador no puede forzar consultas a las fuentes; la caché compartida de 60 s limita el tráfico.
- Middleware CSRF de TanStack Start activo para funciones de servidor.
- No se almacenan datos personales; las preferencias quedan en el navegador del usuario.
