import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Scenario, Turn } from "@/lib/scenario";
import { blendReport } from "@/lib/scoring";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORE_SYSTEM = `You are a senior LucaNet sales coach evaluating a recorded sales call. LucaNet sells financial consolidation, planning (xP&A), ESG reporting, and tax compliance software to mid-market and enterprise finance teams. Key value props: faster close cycles, single source of truth, no IT dependency, 8–12 week implementation, full audit trail.

Score the REP only (not the prospect). Output ONLY a valid JSON object — no prose, no markdown fences — matching exactly this shape:
{
  "rubric": [
    { "name": "Discovery",          "score": 0-10, "rationale": "one sentence", "evidence": "<=15 word verbatim quote from rep" },
    { "name": "Objection Handling", "score": 0-10, "rationale": "one sentence", "evidence": "<=15 word verbatim quote from rep" },
    { "name": "Value Articulation", "score": 0-10, "rationale": "one sentence referencing LucaNet-specific value props", "evidence": "<=15 word verbatim quote from rep" },
    { "name": "Next Step",          "score": 0-10, "rationale": "one sentence", "evidence": "<=15 word verbatim quote from rep" },
    { "name": "Rapport",            "score": 0-10, "rationale": "one sentence", "evidence": "<=15 word verbatim quote from rep" }
  ],
  "questionCount": <integer count of genuine discovery questions the rep asked>,
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "improvements": ["specific actionable improvement 1", "specific actionable improvement 2", "specific actionable improvement 3"],
  "topMove": "the single highest-leverage thing this rep should do differently next time, phrased as concrete advice"
}

Rules:
- evidence must be a real substring from the transcript labelled [REP], max 15 words
- improvements must be specific and actionable — no generic advice like "ask more questions"
- topMove should reference the prospect's specific situation`;

function extractJson(text: string): string {
  // Strip markdown fences if present
  let s = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  // Find first { and last } in case there's surrounding prose
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return s;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const scenario: Scenario = body.scenario;
  const turns: Turn[] = body.turns ?? [];

  if (turns.length === 0) {
    return NextResponse.json({ error: "No turns to score — call was too short." }, { status: 400 });
  }

  const transcript = turns
    .map((t) => `[${t.role === "rep" ? "REP" : "PROSPECT"}]: ${t.text}`)
    .join("\n");

  const userPrompt = `Call Objective: ${scenario.objective}
Prospect: ${scenario.prospect.name}, ${scenario.prospect.title} at ${scenario.prospect.company} (${scenario.prospect.companySize}, ${scenario.prospect.location})
Call type: ${scenario.callType} | Difficulty: ${scenario.difficulty}
Known objections the prospect holds: ${scenario.objections.join("; ")}

TRANSCRIPT:
${transcript}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SCORE_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const rubricData = JSON.parse(extractJson(raw));
    const report = blendReport(turns, rubricData);
    return NextResponse.json(report);
  } catch (e: any) {
    console.error("Scoring error:", e);
    return NextResponse.json({ error: "Scoring failed: " + (e.message ?? "unknown error") }, { status: 500 });
  }
}
