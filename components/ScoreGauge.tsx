"use client";

interface Props {
  score: number; // 0-100
  size?: number;
}

export default function ScoreGauge({ score, size = 200 }: Props) {
  const r = (size / 2) * 0.78;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);
  const gradId = "scoreGrad";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3e0075" />
          <stop offset="100%" stopColor="#8039e9" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#ece8f3"
        strokeWidth={size * 0.09}
      />
      {/* Progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={size * 0.09}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      {/* Score label */}
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: "'Figtree', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.22,
          fill: "#1a1626",
        }}
      >
        {score}
      </text>
      <text
        x={cx} y={cy + size * 0.14}
        textAnchor="middle"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: size * 0.09,
          fill: "#6b6577",
        }}
      >
        / 100
      </text>
    </svg>
  );
}
