import { computeSignals } from "./signals";
import type { Turn } from "./scenario";

export interface RubricItem {
  name: string;
  score: number;
  rationale: string;
  evidence: string;
}

export interface Report {
  overallScore: number;
  signals: {
    talkRatioPct: number;
    longestMonologueSec: number;
    interactivity: number;
    patienceSec: number;
  };
  rubric: RubricItem[];
  questionCount: number;
  strengths: string[];
  improvements: string[];
  topMove: string;
}

export function blendReport(
  turns: Turn[],
  rubricResponse: {
    rubric: RubricItem[];
    questionCount: number;
    strengths: string[];
    improvements: string[];
    topMove: string;
  }
): Report {
  const signals = computeSignals(turns);

  // Computed signal scores (0-100)
  const talkScore = signalToScore_talkRatio(signals.talkRatioPct);
  const monoScore = signalToScore_monologue(signals.longestMonologueSec);
  const interScore = signals.interactivity * 10; // already 0-10 -> 0-100
  const patienceScore = signalToScore_patience(signals.patienceSec);
  const qScore = signalToScore_questions(rubricResponse.questionCount);

  const computedAvg = (talkScore + monoScore + interScore + patienceScore + qScore) / 5;

  // LLM rubric avg (each 0-10 -> 0-100)
  const rubricAvg = rubricResponse.rubric.length > 0
    ? rubricResponse.rubric.reduce((sum, r) => sum + r.score, 0) / rubricResponse.rubric.length * 10
    : 50;

  // Weight: 40% computed signals, 60% LLM rubric
  const overallScore = Math.round(computedAvg * 0.4 + rubricAvg * 0.6);

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    signals,
    rubric: rubricResponse.rubric,
    questionCount: rubricResponse.questionCount,
    strengths: rubricResponse.strengths,
    improvements: rubricResponse.improvements,
    topMove: rubricResponse.topMove,
  };
}

function signalToScore_talkRatio(pct: number): number {
  if (pct >= 40 && pct <= 55) return 100;
  if (pct > 55 && pct <= 65) return 65;
  if (pct > 65 && pct <= 75) return 35;
  return 10;
}

function signalToScore_monologue(sec: number): number {
  if (sec < 90) return 100;
  if (sec <= 150) return 60;
  return 20;
}

function signalToScore_patience(sec: number): number {
  if (sec >= 0.6 && sec <= 1.2) return 100;
  if ((sec >= 0.3 && sec < 0.6) || (sec > 1.2 && sec <= 2)) return 65;
  return 20;
}

function signalToScore_questions(count: number): number {
  if (count >= 8) return 100;
  if (count >= 4) return 65;
  return 20;
}
