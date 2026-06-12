import { describe, it, expect } from "vitest";
import { computeSignals } from "./signals";
import type { Turn } from "./scenario";

// Fixture A: balanced back-and-forth, ~10 min call
// Rep ~45% talk time, no long monologue, good interactivity
const fixtureA: Turn[] = [
  { role: "prospect", text: "Hello?",                startMs: 0,     endMs: 2000  },
  { role: "rep",      text: "Hi, this is Alex...",   startMs: 2800,  endMs: 10000 }, // 7.2s, pause 0.8s
  { role: "prospect", text: "Right, I remember...",  startMs: 10600, endMs: 18000 }, // pause 0.6s
  { role: "rep",      text: "Great. Can you tell me what your biggest challenge is?", startMs: 18900, endMs: 26000 }, // 7.1s, pause 0.9s
  { role: "prospect", text: "Honestly it's the onboarding time.", startMs: 26800, endMs: 34000 }, // pause 0.8s
  { role: "rep",      text: "How long does it take today?",       startMs: 35000, endMs: 38000 }, // 4s, pause 1.0s
  { role: "prospect", text: "About six weeks.",                   startMs: 38800, endMs: 41000 }, // pause 0.8s
  { role: "rep",      text: "And what's the impact of that?",     startMs: 42200, endMs: 45000 }, // 2.8s, pause 1.2s
  { role: "prospect", text: "Lost revenue, frustrated customers.", startMs: 45600, endMs: 50000 }, // pause 0.6s
  { role: "rep",      text: "Got it. We've helped companies like yours cut that to two weeks.", startMs: 50700, endMs: 60000 }, // 9.3s, pause 0.7s
];

// Rep speaking time: 7200+7100+4000+2800+9300 = 30400ms
// Prospect speaking time: 2000+7400+7200+2200+4400 = 23200ms
// Total = 53600ms
// Rep ratio = 30400/53600 = 56.7%
// Longest monologue: 9.3s (last turn)
// Speaker switches: 9 transitions (10 turns)
// Interactivity: 9 / (60000/1000/60) = 9/1 = 9 per minute; normalized ~10 (capped)
// Patience (rep pauses after prospect): 0.8, 0.9, 1.0, 1.2, 0.7 → median = 0.9s

describe("computeSignals – fixture A (balanced)", () => {
  const s = computeSignals(fixtureA);

  it("talk ratio near 56%", () => {
    expect(s.talkRatioPct).toBeCloseTo(55.9, 0);
  });

  it("longest monologue is ~9s", () => {
    expect(s.longestMonologueSec).toBeCloseTo(9.3, 0);
  });

  it("interactivity is high (>=6)", () => {
    expect(s.interactivity).toBeGreaterThanOrEqual(6);
  });

  it("patience median ~0.9s (green range 0.6-1.2)", () => {
    expect(s.patienceSec).toBeGreaterThanOrEqual(0.6);
    expect(s.patienceSec).toBeLessThanOrEqual(1.2);
  });
});

// Fixture B: rep dominates — long monologue, rarely pauses, low interactivity
const fixtureB: Turn[] = [
  { role: "prospect", text: "Hello.",                 startMs: 0,      endMs: 1000   },
  { role: "rep",      text: "Hi! Great to connect. Let me tell you about our platform. We do A, B, C, D, E, F, G, H, I, J, K.", startMs: 1100, endMs: 181100 }, // 180s monologue, 0.1s pause
  { role: "prospect", text: "Um, okay.",               startMs: 182000, endMs: 184000 },
  { role: "rep",      text: "And also we do X, Y, Z.", startMs: 184200, endMs: 200000 }, // 15.8s, pause 0.2s
  { role: "prospect", text: "I need to go.",           startMs: 200800, endMs: 203000 },
];

// Rep time: 180000+15800 = 195800ms
// Prospect time: 1000+2000+2200 = 5200ms
// Total = 201000ms
// Rep ratio = 195800/201000 = 97.4%
// Longest monologue = 180s
// Switches = 4 over ~3.4 min → ~1.2 per min → low
// Patience: pauses before rep starts = 0.1, 0.2 → median ~0.15 (interrupting, red)

describe("computeSignals – fixture B (rep dominates)", () => {
  const s = computeSignals(fixtureB);

  it("talk ratio > 90%", () => {
    expect(s.talkRatioPct).toBeGreaterThan(90);
  });

  it("longest monologue > 150s (red)", () => {
    expect(s.longestMonologueSec).toBeGreaterThan(150);
  });

  it("interactivity < 4 (red)", () => {
    expect(s.interactivity).toBeLessThan(4);
  });

  it("patience < 0.6 (interrupting, red)", () => {
    expect(s.patienceSec).toBeLessThan(0.6);
  });
});

// Fixture C: prospect-heavy call (rep asks great questions, prospect opens up)
const fixtureC: Turn[] = [
  { role: "prospect", text: "Hi there.",                        startMs: 0,     endMs: 1500  },
  { role: "rep",      text: "What brings you to explore this?", startMs: 2500,  endMs: 7000  }, // 4.5s, pause 1.0s
  { role: "prospect", text: "We've been struggling with our pipeline — nothing converts.",  startMs: 8000,  endMs: 16000 }, // pause 1.0s
  { role: "rep",      text: "What's your current conversion rate?", startMs: 17200, endMs: 21000 }, // 3.8s, pause 1.2s
  { role: "prospect", text: "About 8%, way below our 15% target.", startMs: 21800, endMs: 30000 }, // pause 0.8s
  { role: "rep",      text: "How long has that been the case?",    startMs: 31000, endMs: 34000 }, // 3s, pause 1.0s
  { role: "prospect", text: "Past two quarters. It's becoming a board issue.", startMs: 35200, endMs: 44000 }, // pause 1.2s
  { role: "rep",      text: "Got it. What have you tried so far?", startMs: 45000, endMs: 49000 }, // 4s, pause 1.0s
  { role: "prospect", text: "New tools, retraining — nothing sticks. We need a different approach.", startMs: 50000, endMs: 62000 },
  { role: "rep",      text: "Sounds like a system problem, not a people problem. Does that resonate?", startMs: 63000, endMs: 70000 }, // 7s, pause 1.0s
  { role: "prospect", text: "Exactly. That's exactly it.", startMs: 71000, endMs: 74000 },
];

// Rep: 4500+3800+3000+4000+7000 = 22300ms
// Prospect: 1500+8000+8200+8800+12000+3000 = 41500ms
// Total: 63800ms
// Rep ratio = 22300/63800 = 34.9% (under benchmark but ok for question-heavy)
// Longest: 7s (green)
// Switches: 10 over ~1.23 min → high
// Patience pauses: 1.0, 1.2, 1.0, 1.0, 1.0 → median 1.0 (green)

describe("computeSignals – fixture C (prospect-heavy, question-led)", () => {
  const s = computeSignals(fixtureC);

  it("longest monologue < 90s (green)", () => {
    expect(s.longestMonologueSec).toBeLessThan(90);
  });

  it("interactivity >= 6 (green)", () => {
    expect(s.interactivity).toBeGreaterThanOrEqual(6);
  });

  it("patience in green range (0.6-1.2s)", () => {
    expect(s.patienceSec).toBeGreaterThanOrEqual(0.6);
    expect(s.patienceSec).toBeLessThanOrEqual(1.2);
  });
});
