import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Scenario, CRMFields } from "@/lib/scenario";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCENARIO_SCHEMA = `Return ONLY a valid JSON object — no prose, no markdown fences, no comments:
{
  "prospect": { "name": string, "title": string, "company": string, "companySize": string, "location": string },
  "context": string,
  "mood": string,
  "objections": string[],
  "objective": string,
  "callType": "cold" | "discovery" | "demo" | "negotiation",
  "difficulty": "easy" | "realistic" | "tough"
}`;

function extractJson(text: string): string {
  let s = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return s;
}

async function generateScenario(userPrompt: string): Promise<Scenario> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You generate realistic B2B sales call scenarios for LucaNet sales training. LucaNet sells financial consolidation, planning (xP&A), ESG reporting, and tax compliance software. Output only the JSON object — no explanation, no markdown.",
    messages: [{ role: "user", content: `${userPrompt}\n\n${SCENARIO_SCHEMA}` }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  return JSON.parse(extractJson(raw)) as Scenario;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.mode === "transcript") {
    const prompt = `A LucaNet sales rep pasted this call transcript or prospect profile. Extract the prospect's persona, deal context, mood, likely objections, and define a clear call objective for the rep to practice.\n\nTranscript/Profile:\n${body.transcript}\n\nCallType: ${body.callType ?? "discovery"}, Difficulty: ${body.difficulty ?? "realistic"}`;
    try {
      return NextResponse.json(await generateScenario(prompt));
    } catch (e: any) {
      console.error("Scenario error:", e);
      return NextResponse.json({ error: "Failed to generate scenario. Check your input and try again." }, { status: 500 });
    }
  }

  if (body.mode === "crm") {
    const crm = body as CRMFields & { mode: string };
    const prompt = `Generate a realistic LucaNet sales scenario for a ${crm.callType ?? "discovery"} call with:
- Company: ${crm.company}
- Company size: ${crm.companySize}
- Location: ${crm.location}
- Contact: ${crm.personName}, ${crm.personTitle}
- Difficulty: ${crm.difficulty ?? "realistic"}

Invent a plausible financial consolidation / planning challenge (Excel pain, slow close, multi-entity complexity, audit issues), a realistic mood, 2–4 objections this buyer typically has (e.g. implementation effort, IT involvement, cost vs incumbent), and a clear call objective for the LucaNet rep.`;
    try {
      return NextResponse.json(await generateScenario(prompt));
    } catch (e: any) {
      console.error("Scenario error:", e);
      return NextResponse.json({ error: "Failed to generate scenario. Check your input and try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}
