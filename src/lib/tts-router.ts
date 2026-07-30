import { synthesizeBhashiniMp3, isBhashiniConfigured, supportsBhashini } from "./bhashini-tts";
import { synthesizeSpeechMp3 as synthesizeElevenLabsMp3, isElevenLabsConfigured } from "./elevenlabs";

export type TtsProvider = "bhashini" | "elevenlabs";

export function getTtsProvider(languageCode: string): TtsProvider {
  // English is ElevenLabs, full stop.
  if (languageCode === "en") return "elevenlabs";

  // Low-resource langs: Bhashini if available (government TTS, native voices
  // for languages ElevenLabs doesn't cover well).
  if (isBhashiniConfigured() && supportsBhashini(languageCode)) {
    return "bhashini";
  }
  return "elevenlabs";
}

export function isTtsConfigured(languageCode?: string): boolean {
  if (languageCode === "en") return isElevenLabsConfigured();
  return isBhashiniConfigured() || isElevenLabsConfigured() || !languageCode;
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<{ mp3: Buffer; provider: TtsProvider; usesFallback?: boolean }> {
  const provider = getTtsProvider(languageCode);

  if (provider === "bhashini") {
    const mp3 = await synthesizeBhashiniMp3(text, languageCode);
    return { mp3, provider: "bhashini" };
  }

  if (!isElevenLabsConfigured()) {
    throw new Error(
      languageCode === "en"
        ? "Set ELEVENLABS_API_KEY for the English voice."
        : "Set ELEVENLABS_API_KEY or BHASHINI_API_KEY for this language's voice."
    );
  }

  const mp3 = await synthesizeElevenLabsMp3(text, languageCode);
  return { mp3, provider: "elevenlabs" };
}

export function getTtsStatus(languageCode?: string) {
  const provider = languageCode ? getTtsProvider(languageCode) : null;

  return {
    enabled: isTtsConfigured(languageCode),
    bhashini: isBhashiniConfigured(),
    elevenlabs: isElevenLabsConfigured(),
    provider,
  };
}
