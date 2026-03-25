"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook wrapping the Web Speech API for word pronunciation.
 * Selects a US English voice, slightly slowed for young learners (ages 9-12).
 * Returns a no-op on unsupported browsers or during SSR.
 */
export function usePronunciation() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;

    function pickVoice() {
      const voices = speechSynthesis.getVoices();
      // Prefer a US English voice, fall back to any English voice
      voiceRef.current =
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang.startsWith("en")) ??
        null;
    }

    pickVoice();
    // Voices load asynchronously in some browsers
    speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () =>
      speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, [supported]);

  const speak = useCallback(
    (word: string) => {
      if (!supported) return;
      // Cancel any in-progress speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    },
    [supported]
  );

  return { speak, isSpeaking, isSupported: supported };
}
