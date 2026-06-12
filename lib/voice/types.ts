export interface VoiceProvider {
  transcribe(onFinal: (text: string) => void, onInterim?: (text: string) => void): {
    start(): void;
    stop(): void;
  };
  speak(text: string): Promise<void>;
  cancelSpeech(): void;
}
