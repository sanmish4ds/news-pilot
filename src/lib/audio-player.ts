/** Browser speech + ElevenLabs playback helpers */

const SPEECH_LANG: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  ur: "ur-IN",
  ne: "ne-NP",
  mai: "hi-IN",
  doi: "hi-IN",
  kok: "hi-IN",
  ks: "hi-IN",
  mni: "hi-IN",
  brx: "hi-IN",
  sat: "hi-IN",
  sd: "ur-PK",
};

const TTS_TIMEOUT_MS = 300_000; // 5 min for full bulletin

export function speechLangFor(code: string): string {
  return SPEECH_LANG[code] || "hi-IN";
}

export function isBrowserSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function fetchSpeechAudio(
  text: string,
  languageCode: string,
  signal?: AbortSignal
): Promise<Blob> {
  const timeout = AbortSignal.timeout(TTS_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, languageCode }),
    signal: combined,
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = "Could not load audio";
    if (contentType.includes("json")) {
      const err = await res.json().catch(() => ({}));
      message = (err as { error?: string }).error || message;
    }
    throw new Error(message);
  }

  if (!contentType.includes("audio")) {
    throw new Error("Voice server returned an invalid response");
  }

  const blob = await res.blob();
  if (blob.size < 200) {
    throw new Error("Audio file too small — generation may have failed");
  }
  return blob;
}

export function speakWithBrowser(text: string, languageCode: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowserSpeechSupported()) {
      reject(new Error("Browser speech is not available"));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLangFor(languageCode);
    utterance.rate = 0.92;
    utterance.pitch = 1;

    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser speech failed"));

    window.speechSynthesis.speak(utterance);
  });
}

export function stopBrowserSpeech(): void {
  if (isBrowserSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (audio.readyState >= 3) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Audio failed to load"));
    };
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("canplaythrough", onReady);
    audio.addEventListener("error", onError);
    audio.load();
  });
}
