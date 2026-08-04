// Minimal ambient types for the Web Speech API's SpeechRecognition — not
// part of TypeScript's default DOM lib. Covers only what
// src/hooks/use-voice-input.ts actually touches, not the full spec.

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}
