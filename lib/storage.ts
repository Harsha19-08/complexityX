"use client";
import type { ClientSettings, HistoryEntry } from "./types";

const HISTORY_KEY = "complexityx:history:v1";
const SETTINGS_KEY = "complexityx:settings:v1";
const MODE_KEY = "complexityx:mode";
const MAX_HISTORY = 100;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("complexityx:storage", { detail: key }));
  } catch {
    /* quota or privacy mode — non-fatal */
  }
}

export const loadHistory = (): HistoryEntry[] => {
  const h = read<HistoryEntry[]>(HISTORY_KEY, []);
  return Array.isArray(h) ? h.filter((e) => e && e.id && e.analysis) : [];
};
export const saveHistory = (h: HistoryEntry[]) => write(HISTORY_KEY, h.slice(0, MAX_HISTORY));
export function addHistory(entry: HistoryEntry) {
  saveHistory([entry, ...loadHistory()]);
}
export function deleteHistory(id: string) {
  saveHistory(loadHistory().filter((e) => e.id !== id));
}
export const getHistoryEntry = (id: string) => loadHistory().find((e) => e.id === id);

export const loadSettings = (): ClientSettings => read<ClientSettings>(SETTINGS_KEY, {});
export const saveSettings = (s: ClientSettings) => write(SETTINGS_KEY, s);
export const clearSettings = () => {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* noop */ }
};

export const loadMode = (): "analysis" | "learning" => (read<string>(MODE_KEY, "analysis") === "learning" ? "learning" : "analysis");
export const saveMode = (m: "analysis" | "learning") => write(MODE_KEY, m);
