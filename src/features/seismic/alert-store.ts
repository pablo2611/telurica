import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, type AlertPrefs, type DeliveredAlert } from "./alerts";

// Persistencia local del navegador (sin cuentas de usuario). Clave versionada.
const PREFS_KEY = "psw:alert-prefs:v1";
const LOG_KEY = "psw:alert-log:v1";
const SEEN_KEY = "psw:seen-events:v1";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
let prefsSnap: AlertPrefs | null = null;
let logSnap: DeliveredAlert[] | null = null;

export function getPrefs(): AlertPrefs {
  if (!prefsSnap) prefsSnap = read(PREFS_KEY, DEFAULT_PREFS);
  return prefsSnap;
}
export function setPrefs(next: AlertPrefs) {
  prefsSnap = next;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  emit();
}
export function getLog(): DeliveredAlert[] {
  if (!logSnap) logSnap = read<DeliveredAlert[]>(LOG_KEY, []);
  return logSnap;
}
export function appendLog(entry: DeliveredAlert) {
  logSnap = [entry, ...getLog()].slice(0, 200);
  window.localStorage.setItem(LOG_KEY, JSON.stringify(logSnap));
  emit();
}
export function updateLog(key: string, patch: Partial<DeliveredAlert>) {
  logSnap = getLog().map((e) => (e.key === key ? { ...e, ...patch } : e));
  window.localStorage.setItem(LOG_KEY, JSON.stringify(logSnap));
  emit();
}
export function clearLog() {
  logSnap = [];
  window.localStorage.setItem(LOG_KEY, "[]");
  emit();
}
export function getSeen(): Set<string> | null {
  const arr = read<string[] | null>(SEEN_KEY, null);
  return arr ? new Set(arr) : null;
}
export function setSeen(ids: Set<string>) {
  window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-3000)));
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = () => { prefsSnap = null; logSnap = null; l(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}
export const usePrefs = () => useSyncExternalStore(subscribe, getPrefs, () => DEFAULT_PREFS);
const EMPTY: DeliveredAlert[] = [];
export const useAlertLog = () => useSyncExternalStore(subscribe, getLog, () => EMPTY);
