import type { Turn } from "./scenario";

export interface ComputedSignals {
  talkRatioPct: number;
  longestMonologueSec: number;
  interactivity: number;
  patienceSec: number;
}

export function computeSignals(turns: Turn[]): ComputedSignals {
  if (turns.length === 0) {
    return { talkRatioPct: 0, longestMonologueSec: 0, interactivity: 0, patienceSec: 0 };
  }

  let repMs = 0;
  let prospectMs = 0;
  let longestRepMs = 0;
  const repPausesMs: number[] = [];

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const durationMs = t.endMs - t.startMs;

    if (t.role === "rep") {
      repMs += durationMs;
      if (durationMs > longestRepMs) longestRepMs = durationMs;
    } else {
      prospectMs += durationMs;
    }

    // Pause before rep starts = gap between end of prospect turn and start of next rep turn
    if (t.role === "prospect" && i + 1 < turns.length && turns[i + 1].role === "rep") {
      const pause = turns[i + 1].startMs - t.endMs;
      if (pause >= 0) repPausesMs.push(pause);
    }
  }

  const totalMs = repMs + prospectMs;
  const talkRatioPct = totalMs > 0 ? (repMs / totalMs) * 100 : 0;
  const longestMonologueSec = longestRepMs / 1000;

  // Interactivity: speaker switches per minute, normalized to 0-10
  const callDurationMin = (turns[turns.length - 1].endMs - turns[0].startMs) / 60000;
  let switches = 0;
  for (let i = 1; i < turns.length; i++) {
    if (turns[i].role !== turns[i - 1].role) switches++;
  }
  const switchesPerMin = callDurationMin > 0 ? switches / callDurationMin : 0;
  // ~6 switches/min = score 10; scale linearly, cap at 10
  const interactivity = Math.min(10, Math.round((switchesPerMin / 6) * 10));

  // Patience: median of rep pause durations after prospect speaks
  const patienceSec = repPausesMs.length > 0 ? median(repPausesMs) / 1000 : 0;

  return { talkRatioPct, longestMonologueSec, interactivity, patienceSec };
}

export type SignalState = "green" | "amber" | "red";

export function talkRatioState(pct: number): SignalState {
  if (pct >= 40 && pct <= 55) return "green";
  if (pct > 55 && pct <= 65) return "amber";
  return "red";
}

export function monologueState(sec: number): SignalState {
  if (sec < 90) return "green";
  if (sec <= 150) return "amber";
  return "red";
}

export function interactivityState(score: number): SignalState {
  if (score >= 6) return "green";
  if (score >= 4) return "amber";
  return "red";
}

export function patienceState(sec: number): SignalState {
  if (sec >= 0.6 && sec <= 1.2) return "green";
  if ((sec >= 0.3 && sec < 0.6) || (sec > 1.2 && sec <= 2)) return "amber";
  return "red";
}

export function questionCountState(count: number): SignalState {
  if (count >= 8) return "green";
  if (count >= 4) return "amber";
  return "red";
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
