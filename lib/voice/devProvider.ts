"use client";
/// <reference path="./speech.d.ts" />
import type { VoiceProvider } from "./types";

export function createDevVoiceProvider(): VoiceProvider {
  let SpeechRecognitionCtor: any = null;
  let recognition: SpeechRecognition | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let pendingStart = false;

  // Web Audio API for playback — on iOS, AudioContext uses AVAudioSessionCategoryPlayback
  // (speaker) even when SpeechRecognition has the mic in "voice" mode.
  let audioCtx: AudioContext | null = null;
  let currentSource: AudioBufferSourceNode | null = null;
  let currentGain: GainNode | null = null;

  const SILENCE_MS = 1400;

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
        throw new Error("SpeechRecognition not supported. Please use Chrome.");

      recognition = spawnRecognition(onFinal, onInterim);

      // Create + resume AudioContext synchronously inside the user-gesture handler.
      // This unlocks Web Audio on iOS — all subsequent source.start() calls will
      // play through the speaker regardless of SpeechRecognition audio session state.
      if (!audioCtx) audioCtx = new AudioContext();
      audioCtx.resume().catch(() => {});

      return {
        start() {
          if (isRunning) {
            pendingStart = true;
            return;
          }
          pendingStart = false;
          recognition = spawnRecognition(onFinal, onInterim);
          try {
            recognition.start();
          } catch (_) {
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

    async speak(rawText: string): Promise<void> {
      // Strip stage directions Claude occasionally generates despite prompt instructions:
      // *sighs*, [beat], (pause), (laughs), etc.
      const text = rawText
        .replace(/\*[^*\n]+\*/g, " ")          // *action*
        .replace(/\[[^\]\n]+\]/g, " ")          // [action]
        .replace(/\((?:pause|laugh|chuckle|sigh|smile|nod|beat|breath|clears?\s+(?:his|her|their|my)?\s*throat)[^)]*\)/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      // Cancel any in-progress audio
      if (currentSource) {
        try { currentSource.stop(); } catch (_) {}
        currentSource = null;
      }

      // Fetch ElevenLabs audio as raw bytes
      let arrayBuffer: ArrayBuffer | null = null;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
        } else {
          console.warn("ElevenLabs TTS failed:", res.status);
        }
      } catch (e) {
        console.warn("TTS fetch failed:", e);
      }

      // Play via Web Audio API (forces speaker on iOS, bypasses voice-call routing)
      if (arrayBuffer && audioCtx) {
        return new Promise(async (resolve) => {
          try {
            await audioCtx!.resume();
            const audioBuffer = await audioCtx!.decodeAudioData(arrayBuffer!);
            const source = audioCtx!.createBufferSource();
            source.buffer = audioBuffer;

            // Route through a GainNode so we can schedule a smooth fade-out.
            // Without this, AudioBufferSourceNode cuts the waveform mid-sample
            // at whatever amplitude it's at, producing an audible click/pop.
            const gain = audioCtx!.createGain();
            source.connect(gain);
            gain.connect(audioCtx!.destination);
            currentSource = source;
            currentGain = gain;

            const duration = audioBuffer.duration;
            const FADE = Math.min(0.08, duration * 0.1); // 80ms or 10% of clip
            const now = audioCtx!.currentTime;
            gain.gain.setValueAtTime(1, now + Math.max(0, duration - FADE));
            gain.gain.linearRampToValueAtTime(0.0001, now + duration);

            let settled = false;
            const timeoutId = setTimeout(() => {
              if (settled) return;
              settled = true;
              try { source.stop(); } catch (_) {}
              if (currentSource === source) currentSource = null;
              if (currentGain === gain) currentGain = null;
              resolve();
            }, 20000);

            source.onended = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timeoutId);
              if (currentSource === source) currentSource = null;
              if (currentGain === gain) currentGain = null;
              resolve();
            };

            source.start(0);
          } catch (e) {
            console.warn("Web Audio playback failed, falling back:", e);
            resolve();
          }
        });
      }

      // speechSynthesis fallback (desktop or when AudioContext unavailable)
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
      if (currentSource) {
        // Quick 50ms fade before stopping to avoid a click/pop on forced cutoff
        if (currentGain && audioCtx) {
          try {
            const now = audioCtx.currentTime;
            currentGain.gain.cancelScheduledValues(now);
            currentGain.gain.setValueAtTime(currentGain.gain.value, now);
            currentGain.gain.linearRampToValueAtTime(0.0001, now + 0.05);
          } catch (_) {}
        }
        const src = currentSource;
        currentSource = null;
        currentGain = null;
        try { src.stop(audioCtx ? audioCtx.currentTime + 0.05 : undefined); } catch (_) {}
      }
    },
  };
}
