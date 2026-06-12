"use client";
/// <reference path="./speech.d.ts" />
import type { VoiceProvider } from "./types";

export function createDevVoiceProvider(): VoiceProvider {
  let SpeechRecognitionCtor: any = null;
  let recognition: SpeechRecognition | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let pendingStart = false;
  let currentAudio: HTMLAudioElement | null = null;
  const SILENCE_MS = 1400;

  // Spawns a fresh recognition instance with all handlers wired up.
  // Called on first start and on every restart (iOS needs a fresh instance
  // after onend fires — restarting the same instance is unreliable on Safari).
  function spawnRecognition(
    onFinal: (text: string) => void,
    onInterim?: (text: string) => void,
  ): SpeechRecognition {
    const r = new SpeechRecognitionCtor() as SpeechRecognition;
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onstart = () => { isRunning = true; };

    r.onend = () => {
      isRunning = false;
      if (pendingStart) {
        pendingStart = false;
        // Always spawn fresh — reusing the stopped instance fails on iOS
        recognition = spawnRecognition(onFinal, onInterim);
        try { recognition.start(); } catch (_) {}
      }
    };

    r.onresult = (e: SpeechRecognitionEvent) => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (interim && onInterim) onInterim(interim);
      if (finalText.trim()) {
        silenceTimer = setTimeout(() => onFinal(finalText.trim()), SILENCE_MS);
      }
    };

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      console.warn("SpeechRecognition error:", e.error);
    };

    return r;
  }

  return {
    transcribe(onFinal, onInterim) {
      SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionCtor)
        throw new Error("SpeechRecognition not supported in this browser. Please use Chrome.");

      recognition = spawnRecognition(onFinal, onInterim);

      return {
        start() {
          if (isRunning) {
            // Recognition is still winding down — schedule restart for onend
            pendingStart = true;
            return;
          }
          pendingStart = false;
          // Spawn fresh instance every time for iOS reliability
          recognition = spawnRecognition(onFinal, onInterim);
          try {
            recognition.start();
          } catch (_) {
            // Still shutting down — fall back to pending mechanism
            pendingStart = true;
          }
        },
        stop() {
          pendingStart = false;
          if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
          if (isRunning) {
            try { recognition?.stop(); } catch (_) {}
          }
        },
      };
    },

    async speak(text: string): Promise<void> {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
        currentAudio = null;
      }

      // Try ElevenLabs first; fall back to speechSynthesis if it fails
      let blobUrl: string | null = null;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
        } else {
          console.warn("ElevenLabs TTS failed, falling back to speechSynthesis:", res.status);
        }
      } catch (e) {
        console.warn("ElevenLabs TTS fetch failed, falling back to speechSynthesis:", e);
      }

      if (blobUrl) {
        return new Promise((resolve) => {
          const audio = new Audio(blobUrl!);
          currentAudio = audio;

          let settled = false;
          // Always resolve within 20s — iOS can swallow onended events
          const timeoutId = setTimeout(() => settle(), 20000);

          const settle = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
            if (currentAudio === audio) currentAudio = null;
            resolve();
          };

          audio.onended = settle;
          audio.onerror = settle;
          audio.play().catch(settle);
        });
      }

      // speechSynthesis fallback
      return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout>;
        const settle = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve();
        };
        timeoutId = setTimeout(() => { window.speechSynthesis.cancel(); settle(); }, 15000);
        utter.onend = settle;
        utter.onerror = settle;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((v) => v.lang === "en-US") || voices[0];
        if (preferred) utter.voice = preferred;
        window.speechSynthesis.speak(utter);
      });
    },

    cancelSpeech() {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
        currentAudio = null;
      }
    },
  };
}
