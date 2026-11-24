import { Activity, Archive, BarChart3, BellRing, Bot, BookOpen, Compass, Layers3, Network, Ruler } from "lucide-react";

export const NAV = [
  { to: "/resumen", label: "Resumen", icon: Compass, hint: "Estado actual y feed en vivo" },
  { to: "/monitor", label: "Monitor", icon: Activity, hint: "Mapa interactivo" },
  { to: "/terrenos", label: "Terrenos", icon: Ruler, hint: "Relieve 3D y ficha preliminar" },
  { to: "/tectonica", label: "Tectónica", icon: Layers3, hint: "Placas, límites y fallas" },
  { to: "/historial", label: "Historial", icon: Archive, hint: "Archivo y exportación" },
  { to: "/analisis", label: "Análisis", icon: BarChart3, hint: "Estadísticas y gráficos" },
  { to: "/alertas", label: "Alertas", icon: BellRing, hint: "Reglas y notificaciones" },
  { to: "/savia", label: "Savia IA", icon: Bot, hint: "Consulta los datos con inteligencia artificial" },
  { to: "/educacion", label: "Educación", icon: BookOpen, hint: "Qué hacer antes, durante y después" },
  { to: "/fuentes", label: "Fuentes", icon: Network, hint: "Estado de USGS, EMSC y NOAA" },
] as const;

const PRIMARY = new Set<string>(["/resumen", "/monitor", "/alertas", "/historial"]);
export const PRIMARY_NAV = NAV.filter((n) => PRIMARY.has(n.to));
export const SECONDARY_NAV = NAV.filter((n) => !PRIMARY.has(n.to));
