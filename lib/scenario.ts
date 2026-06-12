export interface Scenario {
  prospect: {
    name: string;
    title: string;
    company: string;
    companySize: string;
    location: string;
  };
  context: string;
  mood: string;
  objections: string[];
  objective: string;
  callType: "cold" | "discovery" | "demo" | "negotiation";
  difficulty: "easy" | "realistic" | "tough";
}

export interface Turn {
  role: "rep" | "prospect";
  text: string;
  startMs: number;
  endMs: number;
}

export interface CRMFields {
  company: string;
  companySize: string;
  location: string;
  personName: string;
  personTitle: string;
  callType: Scenario["callType"];
  difficulty: Scenario["difficulty"];
}

export function buildProspectSystemPrompt(s: Scenario): string {
  return `You are ${s.prospect.name}, ${s.prospect.title} at ${s.prospect.company} (${s.prospect.companySize}, ${s.prospect.location}).
You are on a ${s.callType} call. Context: ${s.context}. Your current mood: ${s.mood}.
You are the BUYER. The other person is a salesperson practicing. Behave like a real, busy buyer:
- Speak naturally, the way someone talks on a phone call. 1-3 sentences. Never use lists or markdown.
- Do not be a helpful assistant. Make the rep earn information.
- Hold these concerns and raise them when relevant: ${s.objections.join("; ")}.
- If the rep asks strong discovery questions, gradually open up. If they pitch without listening, push back or disengage.
- Never coach, never explain what you're doing, never break character.
- You may end the call if it's going nowhere or the objective is clearly resolved; signal it naturally ("I've got another meeting...").
Difficulty: ${s.difficulty}.`;
}
