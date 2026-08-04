import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceInputStatus = "idle" | "unsupported" | "listening" | "processing" | "error";

const ERROR_MESSAGE: Record<string, string> = {
  "not-allowed": "Permissão de microfone negada.",
  "no-speech": "Não ouvi nada — tente de novo.",
  "audio-capture": "Nenhum microfone encontrado.",
  network: "Falha de rede no reconhecimento de voz.",
};

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * Thin wrapper around the browser's native Web Speech API for one-shot
 * "listen, get a transcript, stop" voice capture. Free — no server round-trip
 * for the speech-to-text step itself. Unreliable on iOS Safari in standalone
 * PWA mode (same iOS-only-in-specific-ways territory as push notifications,
 * see memory ios-web-push-constraints) — `status` reports "unsupported"
 * there so callers can hide the feature instead of offering a mic that
 * silently never returns anything.
 *
 * Only owns the recognition lifecycle. What happens with the transcript
 * (sending it off for parsing) is the caller's job — `setProcessing`/
 * `setIdle`/`setFailed` let the caller fold that async step into the same
 * status the mic button reflects.
 */
export function useVoiceInput() {
  const [status, setStatus] = useState<VoiceInputStatus>(() => (getRecognitionCtor() ? "idle" : "unsupported"));
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Stop any in-flight recognition if the component unmounts mid-listen
  // (e.g. navigating away) so it doesn't keep the mic open in the background.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback((onResult: (transcript: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onResult(transcript);
    };
    recognition.onerror = (event) => {
      setError(ERROR_MESSAGE[event.error] ?? "Não foi possível reconhecer a fala.");
      setStatus("error");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      // onresult (success) or onerror already moved status past "listening"
      // by the time onend fires. Still "listening" here means recognition
      // ended with neither — e.g. silence with no "no-speech" error on this
      // browser — so fall back to idle instead of getting stuck.
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognition.start();
    setStatus("listening");
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);
  const setProcessing = useCallback(() => setStatus("processing"), []);
  const setIdle = useCallback(() => setStatus("idle"), []);
  const setFailed = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  return { status, error, start, stop, setProcessing, setIdle, setFailed };
}
