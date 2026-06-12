"use client";
import type { Turn } from "@/lib/scenario";

export default function TranscriptReview({ turns }: { turns: Turn[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {turns.map((turn, i) => {
        const durationSec = ((turn.endMs - turn.startMs) / 1000).toFixed(1);
        const isRep = turn.role === "rep";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              flexDirection: isRep ? "row-reverse" : "row",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: isRep ? "var(--brand)" : "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: isRep ? "#fff" : "var(--text-weak)",
              }}
            >
              {isRep ? "REP" : "PRO"}
            </div>
            <div style={{ maxWidth: "70%" }}>
              <div
                style={{
                  background: isRep ? "rgba(128,57,233,.08)" : "var(--surface)",
                  border: `1px solid ${isRep ? "rgba(128,57,233,.15)" : "var(--border)"}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "var(--text)",
                  lineHeight: 1.5,
                }}
              >
                {turn.text}
              </div>
              {isRep && (
                <div style={{ fontSize: 11, color: "var(--text-weak)", marginTop: 4, textAlign: "right" }}>
                  {durationSec}s
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
