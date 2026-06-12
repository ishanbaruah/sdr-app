"use client";
import type { Scenario } from "@/lib/scenario";
import type { OrbState } from "./StatusOrb";

interface Props {
  scenario: Scenario;
  orbState: OrbState;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function ProspectTile({ scenario, orbState }: Props) {
  const isSpeaking = orbState === "speaking";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: 16,
      }}
    >
      {/* Avatar with speaking ring */}
      <div
        style={{
          position: "relative",
          width: 140,
          height: 140,
        }}
      >
        {isSpeaking && (
          <div
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "3px solid var(--brand)",
              animation: "speak-ring 1.2s ease-in-out infinite",
            }}
          />
        )}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--grad-from), var(--grad-to))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            fontFamily: "'Figtree', sans-serif",
            color: "#fff",
            position: "relative",
            zIndex: 1,
          }}
        >
          {initials(scenario.prospect.name)}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Figtree', sans-serif", color: "#fff" }}>
          {scenario.prospect.name}
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
          {scenario.prospect.title} · {scenario.prospect.company}
        </div>
      </div>
    </div>
  );
}
