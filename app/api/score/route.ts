import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Scenario, Turn } from "@/lib/scenario";
import { blendReport } from "@/lib/scoring";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORE_SYSTEM = `You are a senior LucaNet sales coach evaluating a recorded sales call. LucaNet sells financial consolidation, planning (xP&A), ESG reporting, and tax compliance software to mid-market and enterprise finance teams. Key value props: faster close cycles, single source of truth, no IT dependency, 8–12 week implementation, full audit trail.

CRITICAL: Your response must be a single valid JSON object and nothing else — no prose, no explanation, no markdown fences, no comments. Start your response with { and end it with }. Even if the transcript is very short, always output the JSON.

Score the REP only (not the prospect). Output this exact JSON shape:
{"rubric":[{"name":"Discovery","score":5,"rationale":"one sentence","evidence":"short quote or n/a"},{"name":"Objection Handling","score":5,"rationale":"one sentence","evidence":"short quote or n/a"},{"name":"Value Articulation","score":5,"rationale":"one sentence","evidence":"short quote or n/a"},{"name":"Next Step","score":5,"rationale":"one sentence","evidence":"short quote or n/a"},{"name":"Rapport","score":5,"rationale":"one sentence","evidence":"short quote or n/a"}],"questionCount":0,"strengths":["strength 1","strength 2","strength 3"],"improvements":["improvement 1","improvement 2","improvement 3"],"topMove":"advice"}

Rules:
- score is an integer 0-10
- evidence must be a real substring from [REP] lines, max 15 words, or "n/a" if rep said nothing relevant
- If the transcript is very short, score conservatively (2-4) and note the brevity in rationale
- improvements must be specific and actionable
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
    let raw = "";
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SCORE_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        raw += chunk.delta.text;
      }
    }

    const extracted = extractJson(raw);
    if (!extracted.startsWith("{")) {
      console.error("Scoring: unexpected Claude response:", raw.slice(0, 300));
      return NextResponse.json({ error: "Scoring model returned unexpected output." }, { status: 500 });
    }
    const rubricData = JSON.parse(extracted);
    const report = blendReport(turns, rubricData);
    return NextResponse.json(report);
  } catch (e: any) {
    console.error("Scoring error:", e);
    return NextResponse.json({ error: "Scoring failed: " + (e.message ?? "unknown error") }, { status: 500 });
  }
}
