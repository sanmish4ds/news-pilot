import { synthesizeSpeechMp3 as synthesizeElevenLabsMp3, isElevenLabsConfigured } from "./elevenlabs";

export type TtsProvider = "elevenlabs";

// Listening is available for English and Hindi only — everything else skips
// TTS/audio entirely for speed (no per-language voice synthesis, no
// background audio warm-up, no tts-status round-trip on tab switch).
const LISTENING_ENABLED_CODES = new Set(["en", "hi"]);

export function getTtsProvider(): TtsProvider {
  return "elevenlabs";
}

export function isTtsConfigured(languageCode?: string): boolean {
  if (languageCode && !LISTENING_ENABLED_CODES.has(languageCode)) return false;
  return isElevenLabsConfigured();
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<{ mp3: Buffer; provider: TtsProvider }> {
  if (!LISTENING_ENABLED_CODES.has(languageCode)) {
    throw new Error("Listening is only available in English and Hindi.");
  }
  if (!isElevenLabsConfigured()) {
    throw new Error("Set ELEVENLABS_API_KEY for voice playback.");
  }

  const mp3 = await synthesizeElevenLabsMp3(text, languageCode);
  return { mp3, provider: "elevenlabs" };
}

export function getTtsStatus(languageCode?: string) {
  return {
    enabled: isTtsConfigured(languageCode),
    elevenlabs: isElevenLabsConfigured(),
    provider: languageCode && LISTENING_ENABLED_CODES.has(languageCode) ? "elevenlabs" : null,
  };
}
