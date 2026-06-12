export interface VoiceProvider {
  transcribe(onFinal: (text: string) => void, onInterim?: (text: string) => void): {
    start(): void;
    stop(): void;
  };
  speak(text: string): Promise<void>;
  // Play a pre-fetched queue of audio buffers in order.
  // Each promise is started immediately (parallel fetches); playback is sequential.
  playBufferQueue(queue: Promise<ArrayBuffer | null>[]): Promise<void>;
  cancelSpeech(): void;
}
