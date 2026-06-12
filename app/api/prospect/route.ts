import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
import { buildProspectSystemPrompt } from "@/lib/scenario";
import type { Scenario, Turn } from "@/lib/scenario";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const scenario: Scenario = body.scenario;
  const turns: Turn[] = body.turns ?? [];

  // Build message list. Anthropic requires:
  //   1. At least one message
  //   2. First message must be role "user"
  // We always prepend a synthetic user message so the conversation starts correctly,
  // whether turns is empty (opening) or starts with a prospect/assistant turn.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: turns.length === 0
        ? "(The phone rings. You pick up and start the call.)"
        : "(Conversation so far shown above. Continue as the prospect.)",
    },
  ];

  for (const t of turns) {
    messages.push({
      role: t.role === "rep" ? "user" : "assistant",
      content: t.text,
    });
  }

  // If the last message we added was a "user" (rep) turn, the model replies as prospect — correct.
  // If the list ends on "assistant" (prospect just spoke), Anthropic needs the next user message.
  // That only happens when opening (turns=[]) which is handled by the synthetic opener above.

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: buildProspectSystemPrompt(scenario),
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
