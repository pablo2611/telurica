import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSeismicData, getSyncLog, getTsunamiBulletins } from "./seismic.functions";
import { periodStart, type PeriodId } from "./periods";
import { wantsFreshSync } from "./realtime";

export const REFRESH_MS = 60_000;

export const seismicQuery = (start: string, end: string | null = null) =>
  queryOptions({
    queryKey: ["seismic", start, end],
    queryFn: () => getSeismicData({ data: { start, end, fresh: end === null && wantsFreshSync() } }),
    refetchInterval: end ? false : REFRESH_MS,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

export function useSeismicPeriod(period: PeriodId) {
  return useQuery(seismicQuery(periodStart(period)));
}
export function useSeismicRange(start: string, end: string | null) {
  return useQuery(seismicQuery(start, end));
}
export const tsunamiQuery = queryOptions({
  queryKey: ["tsunami"],
  queryFn: () => getTsunamiBulletins(),
  refetchInterval: 5 * REFRESH_MS,
});
export const syncLogQuery = queryOptions({
  queryKey: ["synclog"],
  queryFn: () => getSyncLog(),
  refetchInterval: 30_000,
});
