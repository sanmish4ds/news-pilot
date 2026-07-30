import { synthesizeSpeechMp3 as synthesizeElevenLabsMp3, isElevenLabsConfigured } from "./elevenlabs";

export type TtsProvider = "elevenlabs";

// Listening is English-only — everything else skips TTS/audio entirely for
// speed (no per-language voice synthesis, no background audio warm-up, no
// tts-status round-trip on tab switch).
export function getTtsProvider(): TtsProvider {
  return "elevenlabs";
}

export function isTtsConfigured(languageCode?: string): boolean {
  if (languageCode && languageCode !== "en") return false;
  return isElevenLabsConfigured();
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<{ mp3: Buffer; provider: TtsProvider }> {
  if (languageCode !== "en") {
    throw new Error("Listening is only available in English.");
  }
  if (!isElevenLabsConfigured()) {
    throw new Error("Set ELEVENLABS_API_KEY for the English voice.");
  }

  const mp3 = await synthesizeElevenLabsMp3(text, languageCode);
  return { mp3, provider: "elevenlabs" };
}

export function getTtsStatus(languageCode?: string) {
  return {
    enabled: isTtsConfigured(languageCode),
    elevenlabs: isElevenLabsConfigured(),
    provider: languageCode === "en" ? "elevenlabs" : null,
  };
}
