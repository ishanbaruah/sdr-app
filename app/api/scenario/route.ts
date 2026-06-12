import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Scenario, CRMFields } from "@/lib/scenario";

export const maxDuration = 60;

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
  let raw = "";
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You generate realistic B2B sales call scenarios for LucaNet sales training. LucaNet sells financial consolidation, planning (xP&A), ESG reporting, and tax compliance software. Output only the JSON object — no explanation, no markdown.",
    messages: [{ role: "user", content: `${userPrompt}\n\n${SCENARIO_SCHEMA}` }],
  });
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      raw += chunk.delta.text;
    }
  }

  const extracted = extractJson(raw);
  if (!extracted.startsWith("{")) {
    console.error("Scenario: unexpected model output:", raw.slice(0, 200));
    throw new Error("Model returned unexpected output");
  }
  return JSON.parse(extracted) as Scenario;
}

// Build prompt from request body, return null for invalid requests
function buildPrompt(body: any): string | null {
  if (body.mode === "transcript") {
    return `A LucaNet sales rep pasted this call transcript or prospect profile. Extract the prospect's persona, deal context, mood, likely objections, and define a clear call objective for the rep to practice.\n\nTranscript/Profile:\n${body.transcript}\n\nCallType: ${body.callType ?? "discovery"}, Difficulty: ${body.difficulty ?? "realistic"}`;
  }
  if (body.mode === "crm") {
    const crm = body as CRMFields & { mode: string };
    return `Generate a realistic LucaNet sales scenario for a ${crm.callType ?? "discovery"} call with:
- Company: ${crm.company}
- Company size: ${crm.companySize}
- Location: ${crm.location}
- Contact: ${crm.personName}, ${crm.personTitle}
- Difficulty: ${crm.difficulty ?? "realistic"}

Invent a plausible financial consolidation / planning challenge (Excel pain, slow close, multi-entity complexity, audit issues), a realistic mood, 2–4 objections this buyer typically has (e.g. implementation effort, IT involvement, cost vs incumbent), and a clear call objective for the LucaNet rep.`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = buildPrompt(body);

  if (!prompt) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  // Stream the response so the browser receives HTTP 200 + headers immediately.
  // iOS Safari shows "this page could not load" when a request takes 12-15s with
  // no response at all — keep-alive pings (whitespace) prevent that timeout.
  // JSON.parse() ignores leading whitespace so the client needs no changes.
  const readable = new ReadableStream({
    async start(controller) {
      // Flush headers immediately
      controller.enqueue(encoder.encode(" "));

      // Ping every 3s to keep the mobile connection alive
      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(" ")); } catch (_) {}
      }, 3000);

      try {
        const scenario = await generateScenario(prompt);
        clearInterval(ping);
        controller.enqueue(encoder.encode(JSON.stringify(scenario)));
      } catch (e: any) {
        clearInterval(ping);
        console.error("Scenario error:", e);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: "Failed to generate scenario. Please try again." }))
        );
      }

      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
