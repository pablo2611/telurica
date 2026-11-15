export type PeriodId = "24h" | "7d" | "30d" | "90d" | "365d";
export const PERIODS: { id: PeriodId; label: string; long: string; days: number }[] = [
  { id: "24h", label: "24 h", long: "últimas 24 horas", days: 1 },
  { id: "7d", label: "7 días", long: "últimos 7 días", days: 7 },
  { id: "30d", label: "30 días", long: "últimos 30 días", days: 30 },
  { id: "90d", label: "90 días", long: "últimos 90 días", days: 90 },
  { id: "365d", label: "1 año", long: "último año", days: 365 },
];
export const periodById = (id: PeriodId) => PERIODS.find((p) => p.id === id) ?? PERIODS[2]!;

/** Inicio del período redondeado a la hora para que las consultas compartan caché. */
export function periodStart(id: PeriodId, now = Date.now()): string {
  const d = new Date(now - periodById(id).days * 86400_000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}
