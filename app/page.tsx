"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Scenario } from "@/lib/scenario";
import { setSession } from "@/lib/session";

type CallType = "cold" | "discovery" | "demo" | "negotiation";
type Difficulty = "easy" | "realistic" | "tough";
type Mode = "crm" | "transcript" | "sample";

const CALL_TYPES: CallType[] = ["cold", "discovery", "demo", "negotiation"];
const DIFFICULTIES: Difficulty[] = ["easy", "realistic", "tough"];

// ─── Sample scenarios ────────────────────────────────────────────────────────

const LUCANET_DISCOVERY = `Gong Transcript – Discovery Call for LucaNet

Participants:
- Sarah (Account Executive – LucaNet)
- Michael (Head of Finance – Prospect, ~700-person manufacturing company)

00:00 – Intro
Sarah: Good morning Michael. Thanks for making the time. I'd love to understand your current financial close process and what prompted you to explore LucaNet.
Michael: Thanks Sarah. We're on Excel for consolidation. It works but it's painful — we've grown through three acquisitions and managing six entities is getting messy.

02:15 – Current State
Sarah: Walk me through month-end close — how does it work today?
Michael: We export trial balances from two ERPs, two subsidiaries send CSVs manually. We consolidate everything in spreadsheets. It's about ten business days.
Sarah: And what would you want that to be?
Michael: Honestly, five. Maybe four.

06:40 – Pain Points
Sarah: What breaks most often?
Michael: Version control. Someone saves over a file, an intercompany elimination gets missed. Our auditors hate it. Last quarter we had a €200K discrepancy we couldn't trace for two days.
Sarah: Audit traceability is a big one for us. What's the cost of that?
Michael: Beyond the stress? Our CFO delayed the board pack twice this year. That's a credibility problem.

15:05 – Qualification
Sarah: Are you evaluating other vendors?
Michael: Yes, we've spoken to Tagetik and briefly to Workiva. You're the third.
Sarah: What matters most in your selection?
Michael: Ease of implementation. I've been burned before — a three-year ERP rollout. I cannot go through that again. And I need finance to own it, not IT.

18:20 – LucaNet fit
Sarah: That's exactly our sweet spot. LucaNet is built for finance teams to own — no dev resources needed for standard consolidation. Most mid-market customers are live in 8–12 weeks.
Michael: How long does implementation take really?
Sarah: For your complexity — six entities, two ERP sources — I'd say 10–12 weeks to full consolidation. Planning and FP&A you layer on after.

23:45 – Stakeholders
Sarah: Who's the decision-maker?
Michael: Our CFO, Kirsten. She'll sign off. IT needs to approve the data connectors but finance is driving this.
Sarah: Would it make sense to involve Kirsten in our next session?
Michael: Yes. She's sceptical but she also hates the current process.

27:30 – Next steps
Sarah: I'd like to do a tailored demo — consolidation, intercompany eliminations, the audit trail, and show you how we connect to your ERPs. Does that work?
Michael: Yes. Especially the audit trail and the ERP connectors. That's what'll sell Kirsten.`;

const LUCANET_CFO_DEMO = `Gong Transcript – CFO Demo Call for LucaNet

Participants:
- James (Senior AE – LucaNet)
- Kirsten (CFO – Prospect manufacturing company)
- Michael (Head of Finance – Champion)

00:00 – Intro
James: Kirsten, thanks for joining. Michael has been great in helping me understand your environment. Today I want to show you exactly how LucaNet would work for your six-entity consolidation.
Kirsten: I'll be honest — Michael is more excited about this than I am. Show me why I should care.

02:00 – Business challenge
James: Completely fair. What would it mean to you if your finance team could close in five days instead of ten?
Kirsten: We'd get board packs out on time. Right now I'm presenting stale numbers. It's embarrassing.
James: And the €200K reconciliation issue Michael mentioned last quarter — has that happened before?
Kirsten: More than once. That's what keeps me up at night.

08:00 – Demo: Consolidation
James: Let me show you exactly how LucaNet handles that. Here's a six-entity consolidation structure — this mirrors your setup. [screen share] Notice the full intercompany elimination workflow — every entry is traceable, auditable, with timestamps and user attribution.
Kirsten: Can our auditors get read-only access?
James: Yes. We have an auditor portal. BDO and Deloitte both use it with LucaNet clients.

15:00 – Pricing concern
Kirsten: What's the cost?
James: For your scope — consolidation, six entities, the planning module — we're looking at €48,000 per year. That includes implementation and support.
Kirsten: That's higher than I expected.
James: Let me put it in context. Your team spends about five extra days per close cycle. At your team size, that's roughly €80,000 in person-hours annually — before the audit risk.
Kirsten: I hadn't thought about it that way. What's included in implementation?

22:00 – Competition
Kirsten: Tagetik quoted us less.
James: Tagetik is strong for very large enterprises. For a six-entity structure, you'd be paying for complexity you don't need, and their implementation runs 6–9 months. We're 10–12 weeks.
Kirsten: Michael mentioned that. Is that realistic?
James: I can give you three references at similar-sized manufacturers who went live in that window.

28:00 – Next steps
Kirsten: Send me the references and a written proposal. If the references check out, I'm willing to move forward.
James: I'll have both to you by end of week. Michael, does Thursday work for a follow-up?
Michael: Thursday works.`;

const LUCANET_COLD_CALL = `Prospect profile: Andreas Weber, Finance Director at a 400-person logistics company in Germany. The company uses SAP for their ERP but still consolidates in Excel. They have four legal entities. Andreas has not engaged with LucaNet before — this is a cold outreach. He is busy, somewhat sceptical of software vendors, and protective of his team's time. He's had a bad experience with a failed BI tool rollout two years ago. His main pain: the monthly close takes 12 days and the CFO keeps asking for faster reporting.`;

interface SampleScenario {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  transcript: string;
  callType: CallType;
  defaultDifficulty: Difficulty;
  tags: string[];
}

const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: "discovery",
    label: "Discovery — Michael, Head of Finance",
    subtitle: "Mid-market manufacturing · 6 entities · Excel consolidation pain · evaluating Tagetik",
    icon: "🏭",
    transcript: LUCANET_DISCOVERY,
    callType: "discovery",
    defaultDifficulty: "realistic",
    tags: ["discovery", "realistic"],
  },
  {
    id: "cfo-demo",
    label: "CFO Demo — Kirsten, CFO",
    subtitle: "Sceptical CFO · pricing objections · competitive (Tagetik) · champion already in room",
    icon: "💼",
    transcript: LUCANET_CFO_DEMO,
    callType: "demo",
    defaultDifficulty: "tough",
    tags: ["demo", "tough"],
  },
  {
    id: "cold-call",
    label: "Cold Call — Andreas, Finance Director",
    subtitle: "Germany-based logistics · SAP + Excel · 4 entities · never heard of LucaNet",
    icon: "📲",
    transcript: LUCANET_COLD_CALL,
    callType: "cold",
    defaultDifficulty: "tough",
    tags: ["cold call", "tough"],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sample");
  const [callType, setCallType] = useState<CallType>("discovery");
  const [difficulty, setDifficulty] = useState<Difficulty>("realistic");

  const [company, setCompany]         = useState("");
  const [companySize, setCompanySize] = useState("");
  const [location, setLocation]       = useState("");
  const [personName, setPersonName]   = useState("");
  const [personTitle, setPersonTitle] = useState("");
  const [transcript, setTranscript]   = useState("");

  const [selectedSample, setSelectedSample] = useState(SAMPLE_SCENARIOS[0].id);
  const [sampleDifficulty, setSampleDifficulty] = useState<Difficulty>("realistic");

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setScenario(null);
    try {
      let body: Record<string, unknown>;
      if (mode === "crm") {
        body = { mode: "crm", company, companySize, location, personName, personTitle, callType, difficulty };
      } else if (mode === "sample") {
        const sample = SAMPLE_SCENARIOS.find((s) => s.id === selectedSample)!;
        body = { mode: "transcript", transcript: sample.transcript, callType: sample.callType, difficulty: sampleDifficulty };
      } else {
        body = { mode: "transcript", transcript, callType, difficulty };
      }

      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // Scenario route always returns 200 (streams headers immediately for iOS).
      // Error is signalled via { error: string } in the body.
      const data = await res.json().catch(() => ({ error: "Invalid response" }));
      if (!res.ok || (data as any).error) {
        throw new Error((data as any).error || "Something went wrong");
      }
      setScenario(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleStart() {
    if (!scenario) return;
    setSession({ scenario, turns: [], report: null });
    router.push("/call");
  }

  function switchMode(m: Mode) {
    setMode(m);
    setScenario(null);
    setError("");
  }

  const canGenerate = (() => {
    if (mode === "sample") return true;
    if (mode === "transcript") return transcript.trim().length > 50;
    return company.trim().length > 0 && personName.trim().length > 0 && personTitle.trim().length > 0;
  })();

  const TABS: { id: Mode; label: string }[] = [
    { id: "sample",     label: "✨ Try a sample" },
    { id: "crm",        label: "CRM fields" },
    { id: "transcript", label: "Paste transcript" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header className="hero-gradient" style={{ padding: "40px 0 52px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="rgba(255,255,255,0.15)"/>
            <path d="M8 20V10l6-3 6 3v10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="11" y="14" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.8"/>
          </svg>
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: 13, fontFamily: "'Figtree', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            LucaNet · Sales Practice
          </span>
        </div>
        <h1 style={{ color: "#fff", fontSize: 36, margin: "0 0 10px", fontFamily: "'Figtree', sans-serif", fontWeight: 700 }}>
          Practice your next LucaNet call
        </h1>
        <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 16, margin: 0, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
          Voice-driven practice against an AI prospect, then get your Gong-style scorecard.
        </p>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 24px" }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "var(--surface)", borderRadius: 14, padding: 5, border: "1px solid var(--border)" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchMode(tab.id)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "'Figtree', sans-serif", fontWeight: 600, fontSize: 14,
                transition: "all 0.15s",
                background: mode === tab.id ? "var(--brand)" : "transparent",
                color: mode === tab.id ? "#fff" : "var(--text-weak)",
                boxShadow: mode === tab.id ? "0 2px 10px rgba(128,57,233,.3)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Sample mode ── */}
        {mode === "sample" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {SAMPLE_SCENARIOS.map((s) => {
                const selected = selectedSample === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSample(s.id); setSampleDifficulty(s.defaultDifficulty); setScenario(null); }}
                    style={{
                      width: "100%", textAlign: "left", padding: "18px 20px",
                      borderRadius: 14, border: `2px solid ${selected ? "var(--brand)" : "var(--border)"}`,
                      background: selected ? "rgba(128,57,233,.04)" : "var(--surface)",
                      cursor: "pointer",
                      boxShadow: selected ? "0 0 0 3px rgba(128,57,233,.1)" : "var(--shadow-card)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                        background: "linear-gradient(135deg, var(--grad-from), var(--grad-to))",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      }}>
                        {s.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
                            {s.label}
                          </span>
                          {s.tags.map((tag) => (
                            <span key={tag} style={{
                              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                              background: tag === "tough" ? "var(--bad-bg)" : tag === "realistic" ? "var(--warn-bg)" : "var(--good-bg)",
                              color: tag === "tough" ? "var(--bad)" : tag === "realistic" ? "var(--warn)" : "var(--good)",
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-weak)", lineHeight: 1.5 }}>{s.subtitle}</p>
                      </div>
                      {selected && (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                          ✓
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <SelectField label="Difficulty" value={sampleDifficulty} onChange={(v) => setSampleDifficulty(v as Difficulty)} options={DIFFICULTIES} />
            </div>
          </div>
        )}

        {/* ── CRM mode ── */}
        {mode === "crm" && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>Prospect details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Company" value={company} onChange={setCompany} placeholder="Müller Group GmbH" />
              <Field label="Company size" value={companySize} onChange={setCompanySize} placeholder="600–1000 employees" />
              <Field label="Location" value={location} onChange={setLocation} placeholder="Frankfurt, Germany" />
              <Field label="Contact name" value={personName} onChange={setPersonName} placeholder="Thomas Bauer" />
              <Field label="Contact title" value={personTitle} onChange={setPersonTitle} placeholder="Head of Finance" />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
              <SelectField label="Call type" value={callType} onChange={(v) => setCallType(v as CallType)} options={CALL_TYPES} />
              <SelectField label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)} options={DIFFICULTIES} />
            </div>
          </div>
        )}

        {/* ── Transcript mode ── */}
        {mode === "transcript" && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Paste Gong transcript</h2>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your Gong call transcript here. Claude will extract the prospect's persona, pain points, and objections..."
              rows={10}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: "1.5px solid var(--border)", fontSize: 14,
                fontFamily: "'Inter', sans-serif", color: "var(--text)",
                background: "var(--bg)", resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
              <SelectField label="Call type" value={callType} onChange={(v) => setCallType(v as CallType)} options={CALL_TYPES} />
              <SelectField label="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as Difficulty)} options={DIFFICULTIES} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "var(--bad-bg)", color: "var(--bad)", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!scenario && (
          loading ? <ScenarioLoader mode={mode} /> : (
            <button
              className="btn-primary"
              disabled={!canGenerate}
              onClick={handleGenerate}
              style={{ width: "100%", padding: "14px 0", fontSize: 16 }}
            >
              {mode === "sample" ? "Load scenario →" : "Generate scenario →"}
            </button>
          )
        )}

        {scenario && (
          <ScenarioPreview scenario={scenario} onRegenerate={handleGenerate} onStart={handleStart} loading={loading} />
        )}
      </main>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "'Inter', sans-serif", color: "var(--text)", background: "var(--bg)", outline: "none" }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "'Inter', sans-serif", color: "var(--text)", background: "var(--bg)", outline: "none", cursor: "pointer" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
        ))}
      </select>
    </label>
  );
}

function ScenarioPreview({ scenario, onRegenerate, onStart, loading }: {
  scenario: Scenario; onRegenerate: () => void; onStart: () => void; loading: boolean;
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--brand)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 3px", fontSize: 22 }}>{scenario.prospect.name}</h3>
            <p style={{ margin: 0, color: "var(--text-weak)", fontSize: 15 }}>
              {scenario.prospect.title} · {scenario.prospect.company}
            </p>
            <p style={{ margin: "2px 0 0", color: "var(--text-weak)", fontSize: 13 }}>
              {scenario.prospect.companySize} · {scenario.prospect.location}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ background: "var(--good-bg)", color: "var(--good)", padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {scenario.callType.toUpperCase()}
            </span>
            <span style={{ background: scenario.difficulty === "tough" ? "var(--bad-bg)" : scenario.difficulty === "realistic" ? "var(--warn-bg)" : "var(--good-bg)", color: scenario.difficulty === "tough" ? "var(--bad)" : scenario.difficulty === "realistic" ? "var(--warn)" : "var(--good)", padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {scenario.difficulty}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <InfoRow label="Context" value={scenario.context} />
          <InfoRow label="Mood" value={scenario.mood} />
          <InfoRow label="Your objective" value={scenario.objective} />
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Objections to handle
            </span>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {scenario.objections.map((o, i) => (
                <li key={i} style={{ fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{o}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-ghost" onClick={onRegenerate} disabled={loading} style={{ flex: 1 }}>
          {loading ? "Regenerating..." : "Regenerate"}
        </button>
        <button className="btn-primary" onClick={onStart} style={{ flex: 2, padding: "14px 0", fontSize: 16 }}>
          Start call →
        </button>
      </div>
    </div>
  );
}

const LOADER_STEPS: Record<Mode, string[]> = {
  sample:     ["Reading transcript…", "Extracting prospect persona…", "Crafting their objections…", "Setting the scene…", "Almost ready…"],
  transcript: ["Parsing your transcript…", "Identifying prospect persona…", "Crafting their objections…", "Setting the scene…", "Almost ready…"],
  crm:        ["Looking up company profile…", "Crafting prospect persona…", "Building objections…", "Setting the scene…", "Almost ready…"],
};

function ScenarioLoader({ mode }: { mode: Mode }) {
  const steps = LOADER_STEPS[mode];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    }, 3800);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div
      className="card"
      style={{ padding: "28px 28px 24px", textAlign: "center", animation: "fade-in 0.2s ease" }}
    >
      {/* Spinner */}
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: "3.5px solid var(--border)",
        borderTopColor: "var(--brand)",
        animation: "spin 0.75s linear infinite",
        margin: "0 auto 20px",
      }} />

      {/* Cycling status */}
      <p
        key={stepIdx}
        style={{
          margin: "0 0 20px",
          fontSize: 15, fontWeight: 600,
          fontFamily: "'Figtree', sans-serif",
          color: "var(--text)",
          animation: "fade-in 0.3s ease",
        }}
      >
        {steps[stepIdx]}
      </p>

      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          background: "linear-gradient(90deg, var(--grad-from), var(--grad-to))",
          animation: "progress-fill 22s cubic-bezier(0.1, 0.4, 0.6, 1) forwards",
        }} />
      </div>

    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text)" }}>{value}</p>
    </div>
  );
}
