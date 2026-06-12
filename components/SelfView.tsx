"use client";
import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream | null;
}

export default function SelfView({ stream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 160,
        height: 120,
        borderRadius: 12,
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.2)",
        background: "#111",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />
    </div>
  );
}
