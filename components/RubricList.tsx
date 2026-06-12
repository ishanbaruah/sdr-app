"use client";
import type { RubricItem } from "@/lib/scoring";

export default function RubricList({ items }: { items: RubricItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => {
        const pct = item.score * 10;
        const color = item.score >= 7 ? "var(--good)" : item.score >= 5 ? "var(--warn)" : "var(--bad)";
        return (
          <div key={item.name} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontFamily: "'Figtree', sans-serif", fontSize: 16 }}>
                {item.name}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'Figtree', sans-serif" }}>
                {item.score}/10
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--border)", marginBottom: 10 }}>
              <div style={{ height: "100%", borderRadius: 99, background: color, width: `${pct}%`, transition: "width 0.8s ease" }} />
            </div>
            <p style={{ fontSize: 14, color: "var(--text)", margin: "0 0 6px" }}>{item.rationale}</p>
            {item.evidence && (
              <blockquote style={{
                margin: 0, padding: "6px 12px",
                borderLeft: "3px solid var(--border)",
                color: "var(--text-weak)", fontSize: 13, fontStyle: "italic",
              }}>
                "{item.evidence}"
              </blockquote>
            )}
          </div>
        );
      })}
    </div>
  );
}
