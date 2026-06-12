"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, setSession } from "@/lib/session";
import type { Report } from "@/lib/scoring";
import {
  talkRatioState, monologueState, interactivityState, patienceState, questionCountState,
} from "@/lib/signals";
import ScoreGauge from "@/components/ScoreGauge";
import SignalCard from "@/components/SignalCard";
import RubricList from "@/components/RubricList";
import TranscriptReview from "@/components/TranscriptReview";

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport]   = useState<Report | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();

    // If report was already generated (e.g., back navigation), show it
    if (session.report) {
      setReport(session.report);
      setLoading(false);
      return;
    }

    if (!session.scenario) {
      router.replace("/");
      return;
    }

    if (session.turns.length === 0) {
      setError("The call ended before any speech was captured. This can happen on mobile if microphone permissions weren't granted, or if the call was ended immediately. Please try again.");
      setLoading(false);
      return;
    }

    async function generate() {
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: session.scenario, turns: session.turns }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any).error || `Scoring failed (${res.status})`);
        }
        const r: Report = await res.json();
        setSession({ report: r });
        setReport(r);
      } catch (e: any) {
        setError(e.message || "Scoring failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    generate();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--brand)", animation: "pulse-ring 1.2s ease-in-out infinite" }} />
        <p style={{ fontSize: 18, fontFamily: "'Figtree', sans-serif", fontWeight: 600, color: "var(--text)" }}>
          Analyzing your call...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: "0 0 12px" }}>Scoring failed</h2>
          <p style={{ color: "var(--text-weak)", marginBottom: 24 }}>{error}</p>
          <button className="btn-primary" onClick={() => router.push("/")} style={{ padding: "12px 32px" }}>
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const session = getSession();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header className="hero-gradient" style={{ padding: "40px 0 48px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 16 }}>
          Call scorecard
        </p>
        <h1 style={{ color: "#fff", fontSize: 34, margin: "0 0 8px", fontFamily: "'Figtree', sans-serif" }}>
          {session.scenario?.prospect.name} · {session.scenario?.prospect.company}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", margin: 0, fontSize: 15 }}>
          {session.scenario?.callType} call · {session.scenario?.difficulty} difficulty
        </p>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>
        {/* Score + summary */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 40, marginBottom: 32, flexWrap: "wrap" }}>
          <ScoreGauge score={report.overallScore} size={180} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 28 }}>
              {report.overallScore >= 75 ? "Strong call" : report.overallScore >= 55 ? "Solid effort" : "Room to grow"}
            </h2>
            <p style={{ color: "var(--text-weak)", margin: "0 0 20px", fontSize: 15 }}>
              Overall performance score
            </p>

            {report.topMove && (
              <div style={{
                background: "linear-gradient(135deg, rgba(62,0,117,.06), rgba(128,57,233,.06))",
                border: "1px solid rgba(128,57,233,.2)",
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                  Top move
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{report.topMove}</p>
              </div>
            )}
          </div>
        </div>

        {/* Signal cards */}
        <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Call signals</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
          <SignalCard
            label="Talk ratio"
            value={`${report.signals.talkRatioPct.toFixed(0)}%`}
            benchmark="40–55%"
            state={talkRatioState(report.signals.talkRatioPct)}
            barPct={report.signals.talkRatioPct}
          />
          <SignalCard
            label="Longest mono."
            value={`${report.signals.longestMonologueSec.toFixed(0)}s`}
            benchmark="<90s"
            state={monologueState(report.signals.longestMonologueSec)}
            barPct={Math.min(100, (report.signals.longestMonologueSec / 200) * 100)}
          />
          <SignalCard
            label="Interactivity"
            value={`${report.signals.interactivity}/10`}
            benchmark="≥6"
            state={interactivityState(report.signals.interactivity)}
            barPct={report.signals.interactivity * 10}
          />
          <SignalCard
            label="Patience"
            value={`${report.signals.patienceSec.toFixed(1)}s`}
            benchmark="0.6–1.2s"
            state={patienceState(report.signals.patienceSec)}
            barPct={Math.min(100, (report.signals.patienceSec / 2) * 100)}
          />
          <SignalCard
            label="Questions"
            value={`${report.questionCount}`}
            benchmark="≥8"
            state={questionCountState(report.questionCount)}
            barPct={Math.min(100, (report.questionCount / 12) * 100)}
          />
        </div>

        {/* Strengths & improvements */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ borderTop: "3px solid var(--good)" }}>
            <h4 style={{ margin: "0 0 12px", color: "var(--good)", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Strengths
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {report.strengths.map((s, i) => (
                <li key={i} style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, lineHeight: 1.5 }}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ borderTop: "3px solid var(--warn)" }}>
            <h4 style={{ margin: "0 0 12px", color: "var(--warn)", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Improvements
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {report.improvements.map((s, i) => (
                <li key={i} style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, lineHeight: 1.5 }}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Rubric */}
        <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Detailed rubric</h3>
        <div style={{ marginBottom: 40 }}>
          <RubricList items={report.rubric} />
        </div>

        {/* Transcript */}
        {session.turns && session.turns.length > 0 && (
          <>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Transcript review</h3>
            <div className="card" style={{ marginBottom: 40 }}>
              <TranscriptReview turns={session.turns} />
            </div>
          </>
        )}

        {/* Practice again */}
        <div style={{ textAlign: "center" }}>
          <button
            className="btn-primary"
            onClick={() => { setSession({ scenario: null, turns: [], report: null }); router.push("/"); }}
            style={{ padding: "14px 48px", fontSize: 16 }}
          >
            Practice again
          </button>
        </div>
      </main>
    </div>
  );
}
