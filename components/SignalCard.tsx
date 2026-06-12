"use client";
import type { SignalState } from "@/lib/signals";

interface Props {
  label: string;
  value: string;
  benchmark: string;
  state: SignalState;
  barPct: number; // 0-100
}

const STATE_COLORS: Record<SignalState, { text: string; bg: string; bar: string; icon: string }> = {
  green: { text: "var(--good)",    bg: "var(--good-bg)",  bar: "var(--good)",   icon: "✓" },
  amber: { text: "var(--warn)",    bg: "var(--warn-bg)",  bar: "var(--warn)",   icon: "~" },
  red:   { text: "var(--bad)",     bg: "var(--bad-bg)",   bar: "var(--bad)",    icon: "✕" },
};

export default function SignalCard({ label, value, benchmark, state, barPct }: Props) {
  const colors = STATE_COLORS[state];
  return (
    <div className="card" style={{ padding: "16px 20px", minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
            background: colors.bg, color: colors.text,
          }}
          aria-label={state}
        >
          {colors.icon} {state.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Figtree', sans-serif", color: "var(--text)", marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-weak)", marginBottom: 10 }}>
        Benchmark: {benchmark}
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--border)" }}>
        <div
          style={{
            height: "100%", borderRadius: 99, background: colors.bar,
            width: `${Math.min(100, barPct)}%`,
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}
