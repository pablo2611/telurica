# Sistema de diseño

- **Concepto:** atlas científico + publicación editorial. Fondo azul petróleo, superficies de carbón frío, texto blanco cálido, acento turquesa controlado. La página de Educación usa un modo «papel» (fondo crema, tinta oscura).
- **Tokens:** `src/styles.css` (oklch): `--background`, `--surface`, `--surface-raised`, `--primary`, `--ok`, `--warn`, `--destructive`, `--hairline`, `--paper`, `--ink`, escala discreta de magnitud `--mag-0..5`, `--aurora-a/b/c`.
- **Tipografía:** Fraunces (titulares editoriales), IBM Plex Sans (texto), IBM Plex Mono (coordenadas, horas, metadatos, cifras tabulares).
- **Composición por vista:** Resumen = portada editorial con mapa dominante; Monitor = mapa a pantalla completa con herramientas flotantes, panel de detalle deslizable y cronología inferior; Historial = libro de registros a todo el ancho con franja de filtros fija; Análisis = laboratorio con cifras en línea y gráficos grandes; Alertas = filas editables y canales; Educación = lectura larga con índice fijo y diagramas; Fuentes = diagrama de flujo, tabla de estado y registro técnico.
- **Movimiento:** discreto, respeta `prefers-reduced-motion`.
- MapLibre y ECharts no interpretan oklch: `src/lib/css-color.ts` convierte los tokens a rgba en tiempo de ejecución.
