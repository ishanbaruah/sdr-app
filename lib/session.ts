import type { Scenario, Turn } from "./scenario";
import type { Report } from "./scoring";

declare global {
  interface Window { __sdrSession?: SDRSession; }
}

export interface SDRSession {
  scenario: Scenario | null;
  turns: Turn[];
  report: Report | null;
}

const STORAGE_KEY = "__sdrSession";

function readStorage(): SDRSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SDRSession) : null;
  } catch {
    return null;
  }
}

function writeStorage(s: SDRSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* quota / private-mode — silent */ }
}

export function getSession(): SDRSession {
  if (typeof window === "undefined") return { scenario: null, turns: [], report: null };

  // Restore from sessionStorage on first access (survives mobile full-page reloads)
  if (!window.__sdrSession) {
    window.__sdrSession = readStorage() ?? { scenario: null, turns: [], report: null };
  }
  return window.__sdrSession;
}

export function setSession(update: Partial<SDRSession>) {
  const s = getSession();
  Object.assign(s, update);
  writeStorage(s); // persist immediately so mobile navigation can't lose it
}
