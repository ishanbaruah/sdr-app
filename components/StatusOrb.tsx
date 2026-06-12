"use client";

export type OrbState = "listening" | "thinking" | "speaking" | "idle";

const LABELS: Record<OrbState, string> = {
  listening: "Listening",
  thinking:  "Thinking...",
  speaking:  "Prospect speaking",
  idle:      "Ready",
};

export default function StatusOrb({ state }: { state: OrbState }) {
  const isPulsing  = state === "listening";
  const isSpeaking = state === "speaking";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        role="status"
        aria-label={LABELS[state]}
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: state === "idle" ? "var(--border)" : "var(--brand)",
          animation: isPulsing
            ? "pulse-ring 1.6s ease-in-out infinite"
            : isSpeaking
            ? "speak-ring 1.2s ease-in-out infinite"
            : "none",
          opacity: state === "thinking" ? 0.6 : 1,
          transition: "background 0.3s, opacity 0.3s",
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-weak)" }}>
        {LABELS[state]}
      </span>
    </div>
  );
}
