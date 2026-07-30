import { synthesizeBhashiniMp3, isBhashiniConfigured, supportsBhashini } from "./bhashini-tts";
import {
  isSarvamConfigured,
  supportsSarvam,
  synthesizeSarvamMp3,
  resolveSarvamLanguage,
} from "./sarvam-tts";
import { synthesizeSpeechMp3 as synthesizeElevenLabsMp3, isElevenLabsConfigured } from "./elevenlabs";

export type TtsProvider = "sarvam" | "bhashini" | "elevenlabs";

/** Sarvam is used only for these languages — everything else (including English) uses ElevenLabs. */
const SARVAM_ONLY_CODES = new Set(["hi", "mai"]);

export function getTtsProvider(languageCode: string): TtsProvider {
  // English is ElevenLabs, full stop — never silently fall back to Sarvam
  // just because ELEVENLABS_API_KEY happens to be missing in an environment;
  // that produced the wrong voice with no visible warning. Better to fail
  // loudly (see synthesizeSpeech below) than switch voices without saying so.
  if (languageCode === "en") return "elevenlabs";

  if (SARVAM_ONLY_CODES.has(languageCode) && isSarvamConfigured() && supportsSarvam(languageCode)) {
    return "sarvam";
  }
  // Other low-resource langs: Bhashini if available
  if (isBhashiniConfigured() && supportsBhashini(languageCode)) {
    return "bhashini";
  }
  if (isElevenLabsConfigured()) return "elevenlabs";
  if (isSarvamConfigured() && supportsSarvam(languageCode)) return "sarvam";
  return "elevenlabs";
}

export function isTtsConfigured(languageCode?: string): boolean {
  if (languageCode === "en") return isElevenLabsConfigured();
  return (
    isSarvamConfigured() ||
    isBhashiniConfigured() ||
    isElevenLabsConfigured() ||
    !languageCode
  );
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<{ mp3: Buffer; provider: TtsProvider; usesFallback?: boolean }> {
  const provider = getTtsProvider(languageCode);

  if (provider === "sarvam") {
    const { mp3, usesFallback } = await synthesizeSarvamMp3(text, languageCode);
    return { mp3, provider: "sarvam", usesFallback };
  }

  if (provider === "bhashini") {
    const mp3 = await synthesizeBhashiniMp3(text, languageCode);
    return { mp3, provider: "bhashini" };
  }

  if (!isElevenLabsConfigured()) {
    throw new Error(
      languageCode === "en"
        ? "Set ELEVENLABS_API_KEY for the English voice."
        : "Set SARVAM_API_KEY for Indian language voices (dashboard.sarvam.ai)"
    );
  }

  const mp3 = await synthesizeElevenLabsMp3(text, languageCode);
  return { mp3, provider: "elevenlabs" };
}

export function getTtsStatus(languageCode?: string) {
  const provider = languageCode ? getTtsProvider(languageCode) : null;
  const sarvamFallback =
    languageCode && isSarvamConfigured()
      ? resolveSarvamLanguage(languageCode).usesFallback
      : false;

  return {
    enabled: isTtsConfigured(languageCode),
    sarvam: isSarvamConfigured(),
    bhashini: isBhashiniConfigured(),
    elevenlabs: isElevenLabsConfigured(),
    provider,
    sarvamFallback,
    sarvamNote: sarvamFallback
      ? `${languageCode} uses Hindi voice via Sarvam. Add BHASHINI_API_KEY for native voice`
      : null,
  };
}
