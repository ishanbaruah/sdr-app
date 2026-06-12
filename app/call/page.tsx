"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession, setSession } from "@/lib/session";
import type { Scenario, Turn } from "@/lib/scenario";
import { createDevVoiceProvider } from "@/lib/voice/devProvider";
import type { VoiceProvider } from "@/lib/voice/types";
import StatusOrb from "@/components/StatusOrb";
import type { OrbState } from "@/components/StatusOrb";
import ProspectTile from "@/components/ProspectTile";
import SelfView from "@/components/SelfView";

type Phase = "device-check" | "live" | "ending";

export default function CallPage() {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // Device check
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [permError, setPermError] = useState("");
  const [micLevel, setMicLevel]   = useState(0);
  const analyserRef               = useRef<AnalyserNode | null>(null);
  const animFrameRef              = useRef<number>(0);
  const previewVideoRef           = useRef<HTMLVideoElement | null>(null);

  // Call
  const [phase, setPhase]     = useState<Phase>("device-check");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [timer, setTimer]     = useState(0);
  const [muted, setMuted]     = useState(false);

  const voiceRef       = useRef<VoiceProvider | null>(null);
  const turnsRef       = useRef<Turn[]>([]);
  const listeningRef   = useRef<{ start(): void; stop(): void } | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  // Use a ref for phase so async handlers always see the latest value
  const phaseRef       = useRef<Phase>("device-check");
  const busyRef        = useRef(false); // prevent concurrent prospect requests

  function setPhaseSync(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  useEffect(() => {
    const s = getSession().scenario;
    if (!s) { router.replace("/"); return; }
    setScenario(s);
  }, [router]);

  // Wire camera stream to preview video element
  useEffect(() => {
    if (previewVideoRef.current && camStream) {
      previewVideoRef.current.srcObject = camStream;
    }
  }, [camStream]);

  // Mic level meter
  useEffect(() => {
    if (!camStream) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(camStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    function tick() {
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setMicLevel(Math.min(100, (avg / 128) * 100));
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ctx.close();
    };
  }, [camStream]);

  async function requestDevices() {
    setPermError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCamStream(stream);
    } catch (e: any) {
      setPermError(
        e.name === "NotAllowedError"
          ? "Camera and mic access was denied. Allow access in your browser settings and try again."
          : "Could not access camera or microphone: " + e.message
      );
    }
  }

  async function requestMicOnly() {
    setPermError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setCamStream(stream);
    } catch (e: any) {
      setPermError(
        e.name === "NotAllowedError"
          ? "Microphone access was denied. Allow access in your browser settings and try again."
          : "Could not access microphone: " + e.message
      );
    }
  }

  async function fetchProspectReply(currentTurns: Turn[]): Promise<string> {
    const scen = getSession().scenario!;
    const res = await fetch("/api/prospect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: scen, turns: currentTurns }),
    });
    if (!res.ok) throw new Error("Prospect API error");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }
    return fullText.trim();
  }

  async function runProspectTurn(repText?: string) {
    if (busyRef.current || phaseRef.current !== "live") return;
    busyRef.current = true;
    listeningRef.current?.stop();
    setOrbState("thinking");

    // Append rep turn if we have text
    if (repText) {
      const now = Date.now();
      const repTurn: Turn = {
        role: "rep",
        text: repText,
        startMs: now - Math.max(500, repText.split(" ").length * 320),
        endMs: now,
      };
      turnsRef.current = [...turnsRef.current, repTurn];
    }

    try {
      const reply = await fetchProspectReply(turnsRef.current);
      if (phaseRef.current !== "live") { busyRef.current = false; return; }

      const prospectTurn: Turn = {
        role: "prospect",
        text: reply,
        startMs: Date.now(),
        endMs: 0,
      };
      turnsRef.current = [...turnsRef.current, prospectTurn];
      setOrbState("speaking");
      await voiceRef.current?.speak(reply);
      prospectTurn.endMs = Date.now();

      const endSignals = ["another meeting", "got to run", "talk later", "let's reconnect", "have to go", "i'll pass", "goodbye", "good bye", "take care"];
      if (endSignals.some((p) => reply.toLowerCase().includes(p))) {
        busyRef.current = false;
        doEndCall();
        return;
      }
    } catch (e) {
      console.error("Prospect turn error:", e);
    }

    busyRef.current = false;
    if (phaseRef.current === "live") {
      setOrbState("listening");
      listeningRef.current?.start();
    }
  }

  function doEndCall() {
    if (phaseRef.current === "ending") return;
    setPhaseSync("ending");
    listeningRef.current?.stop();
    voiceRef.current?.cancelSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    const now = Date.now();
    const finalTurns = turnsRef.current.map((t) => t.endMs === 0 ? { ...t, endMs: now } : t);
    setSession({ turns: finalTurns });
    router.push("/report");
  }

  function startLiveCall() {
    if (!camStream || !scenario) return;
    const hasCam = camStream.getVideoTracks().length > 0;

    const hasSpeech = !!(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    if (!hasSpeech) {
      setPermError("Voice recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    // Unlock speechSynthesis for iOS fallback path — must run synchronously in gesture.
    // Web Audio (primary path) is unlocked inside voiceRef.current.transcribe() below.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    // Stop the getUserMedia audio track — SpeechRecognition manages mic access on its own.
    // Keeping an active audio track open causes iOS to route all TTS output through the earpiece.
    camStream.getAudioTracks().forEach((t) => t.stop());

    setPhaseSync("live");
    setOrbState("thinking");

    voiceRef.current = createDevVoiceProvider();
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);

    const ctl = voiceRef.current.transcribe((finalText) => {
      if (finalText.trim()) runProspectTurn(finalText);
    });
    listeningRef.current = ctl;

    // Prospect opens the call (no rep text yet)
    runProspectTurn();
  }

  // Cleanup on unmount — stop camera tracks so the browser indicator goes away
  useEffect(() => {
    return () => {
      listeningRef.current?.stop();
      voiceRef.current?.cancelSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
      camStream?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatTime(sec: number) {
    return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
  }

  if (!scenario) return null;

  // ─── Device check ──────────────────────────────────────────────────────────
  if (phase === "device-check") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: "100%" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 24 }}>Device check</h2>
          <p style={{ color: "var(--text-weak)", margin: "0 0 24px" }}>
            Check your camera and mic before the call starts.
          </p>

          {!camStream ? (
            <div>
              {permError && (
                <div style={{ background: "var(--bad-bg)", color: "var(--bad)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 14 }}>
                  {permError}
                </div>
              )}
              {!permError && (
                <div style={{ background: "var(--warn-bg)", color: "var(--warn)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14 }}>
                  Camera and mic access required to start
                </div>
              )}
              <button className="btn-primary" onClick={requestDevices} style={{ width: "100%", padding: "14px 0" }}>
                Allow camera &amp; microphone
              </button>
              <button
                onClick={requestMicOnly}
                style={{
                  width: "100%", padding: "12px 0", marginTop: 12,
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 10, cursor: "pointer",
                  color: "var(--text-weak)", fontSize: 14,
                  fontFamily: "'Figtree', sans-serif",
                }}
              >
                Continue without camera (mic only)
              </button>
            </div>
          ) : (
            <div>
              {camStream.getVideoTracks().length > 0 ? (
                <div style={{ borderRadius: 12, overflow: "hidden", background: "#111", aspectRatio: "16/9", marginBottom: 20 }}>
                  <video
                    ref={previewVideoRef}
                    autoPlay muted playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
                  />
                </div>
              ) : (
                <div style={{ borderRadius: 12, background: "#111", aspectRatio: "16/9", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 32 }}>📵</span>
                  <span style={{ fontSize: 13, color: "var(--text-weak)" }}>No camera</span>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-weak)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Mic level
                </div>
                <div style={{ height: 8, borderRadius: 99, background: "var(--border)" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: "var(--good)", width: `${micLevel}%`, transition: "width 0.1s" }} />
                </div>
                {micLevel < 5 && (
                  <p style={{ fontSize: 12, color: "var(--warn)", marginTop: 6 }}>
                    Speak into your mic — we&apos;re not picking up much signal yet.
                  </p>
                )}
              </div>

              {permError ? (
                <div style={{ background: "var(--bad-bg)", color: "var(--bad)", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 20 }}>
                  {permError}
                </div>
              ) : (
                <div style={{ background: "var(--good-bg)", color: "var(--good)", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 20 }}>
                  {camStream.getVideoTracks().length > 0 ? "✓ Camera and mic ready" : "✓ Mic ready"}
                </div>
              )}

              <button className="btn-primary" onClick={startLiveCall} style={{ width: "100%", padding: "14px 0", fontSize: 16 }}>
                Start call →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Generating report ──────────────────────────────────────────────────────
  if (phase === "ending") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--brand)", animation: "pulse-ring 1.2s ease-in-out infinite" }} />
        <p style={{ fontSize: 18, fontFamily: "'Figtree', sans-serif", fontWeight: 600, color: "#fff" }}>
          Generating your scorecard...
        </p>
      </div>
    );
  }

  // ─── Live call ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0f0d1a", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <ProspectTile scenario={scenario} orbState={orbState} />
        <SelfView stream={camStream} />
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 32px",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Figtree', sans-serif", color: "#fff", minWidth: 72 }}>
          {formatTime(timer)}
        </div>

        <StatusOrb state={orbState} />

        <div style={{ display: "flex", gap: 12, minWidth: 72, justifyContent: "flex-end" }}>
          <button
            onClick={() => setMuted((m) => {
              const next = !m;
              camStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
              return next;
            })}
            title={muted ? "Unmute" : "Mute"}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: muted ? "var(--bad)" : "rgba(255,255,255,0.15)",
              border: "none", cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {muted ? "🔇" : "🎙️"}
          </button>
          <button
            onClick={doEndCall}
            style={{
              padding: "10px 20px", borderRadius: 99,
              background: "var(--bad)", color: "#fff",
              border: "none", cursor: "pointer",
              fontFamily: "'Figtree', sans-serif", fontWeight: 700, fontSize: 14,
            }}
          >
            End call
          </button>
        </div>
      </div>
    </div>
  );
}
