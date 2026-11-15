# Componentes de bibliotecas externas (instalados y en uso)

| Biblioteca | Componente | Archivo | Dónde se usa | Adaptación |
|---|---|---|---|---|
| Magic UI | Number Ticker | `src/components/ui/number-ticker.tsx` | Resumen, Análisis | formato es-PA, color heredado |
| Magic UI | Animated Grid Pattern | `src/components/ui/animated-grid-pattern.tsx` | Cabecera de Análisis | — |
| Magic UI | Animated Beam | `src/components/ui/animated-beam.tsx` | Flujo de datos en Fuentes | colores de tokens |
| Magic UI | Blur Fade | `src/components/ui/blur-fade.tsx` | Resumen, Educación | — |
| Aceternity UI | Aurora Background | `src/components/ui/aurora-background.tsx` | Portada de Resumen | colores de tokens, sin modo claro |
| Aceternity UI | Tracing Beam | `src/components/ui/tracing-beam.tsx` | Lectura en Educación | colores de tokens |
| Motion Primitives | Animated Background | `src/components/ui/animated-background.tsx` | Selectores de período (Monitor, Análisis) | — |
| MapLibre GL JS | Mapa | `src/components/map/SeismicMap.tsx` | Resumen, Monitor | estilo OpenFreeMap «dark» |
| Apache ECharts | Gráficos | `src/components/charts/EChart.tsx` | Análisis | tema desde tokens |

| React Bits (inspiración) | BlurText, CountUp, ShinyText, GradientText, SpotlightCard, AnimatedList, Magnet, StarBorder, DecryptedText, ClickSpark | `src/components/reactbits/` | Resumen, cabecera, Alertas | reimplementados con `motion` + CSS, sin dependencias nuevas, respetan `prefers-reduced-motion` |
| Propio (inspirado en Threads/Waves de React Bits) | SeismoWaves | `src/components/reactbits/SeismoWaves.tsx` | Portada de Resumen | canvas; la amplitud sube con detecciones en vivo |

Instalados con `shadcn add` desde los registries públicos de cada biblioteca.

**No incluidos:** el código de React Bits Pro (requiere licencia; solo se usó como referencia visual), 21st.dev (requiere cuenta e inicio de sesión), Unicorn Studio (requiere una escena publicada), tsParticles y React Three Fiber (no aportaban a ninguna vista sin competir con los datos).
