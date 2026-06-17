/** Sarvam AI Bulbul v3 — native Indian language TTS */

const SARVAM_API_KEY = (
  process.env.SARVAM_API_KEY ||
  process.env.NEW_PILOT_API_KEY ||
  ""
).trim();

const SARVAM_BASE = "https://api.sarvam.ai/text-to-speech";
const SARVAM_MODEL = (process.env.SARVAM_MODEL || "bulbul:v3").trim();
const SARVAM_SPEAKER = (process.env.SARVAM_SPEAKER || "shubh").trim();
const SARVAM_PACE = Number(process.env.SARVAM_PACE || "0.92") || 0.92;

/** Direct Sarvam TTS language support (BCP-47) */
export const SARVAM_DIRECT_CODES = new Set([
  "en",
  "hi",
  "bn",
  "ta",
  "te",
  "mr",
  "gu",
  "kn",
  "ml",
  "pa",
  "or",
]);

const CODE_TO_SARVAM: Record<string, string> = {
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
  or: "od-IN",
};

/** Languages without Sarvam TTS — use Hindi voice as fallback */
const SARVAM_FALLBACK_HI = new Set([
  "mai",
  "doi",
  "kok",
  "ne",
  "as",
  "ur",
  "brx",
  "sat",
  "sd",
  "sa",
  "ks",
  "mni",
]);

export function isSarvamConfigured(): boolean {
  return SARVAM_API_KEY.length >= 8;
}

export function supportsSarvam(languageCode: string): boolean {
  return (
    SARVAM_DIRECT_CODES.has(languageCode) || SARVAM_FALLBACK_HI.has(languageCode)
  );
}

export function resolveSarvamLanguage(languageCode: string): {
  targetLanguageCode: string;
  usesFallback: boolean;
} {
  const direct = CODE_TO_SARVAM[languageCode];
  if (direct) return { targetLanguageCode: direct, usesFallback: false };
  if (SARVAM_FALLBACK_HI.has(languageCode)) {
    return { targetLanguageCode: "hi-IN", usesFallback: true };
  }
  return { targetLanguageCode: "hi-IN", usesFallback: true };
}

function chunkText(text: string, maxLen = 2400): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  const parts: string[] = [];
  let rest = t;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("। ", maxLen);
    if (cut < 200) cut = rest.lastIndexOf(". ", maxLen);
    if (cut < 200) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < 200) cut = maxLen;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function synthesizeSegment(
  text: string,
  targetLanguageCode: string
): Promise<Buffer> {
  const response = await fetch(SARVAM_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": SARVAM_API_KEY,
    },
    body: JSON.stringify({
      text,
      target_language_code: targetLanguageCode,
      model: SARVAM_MODEL,
      speaker: SARVAM_SPEAKER,
      pace: SARVAM_PACE,
      speech_sample_rate: "24000",
      output_audio_codec: "mp3",
    }),
  });

  const payload = (await response.json()) as {
    audios?: string[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Sarvam TTS failed (${response.status})`
    );
  }

  if (!payload.audios?.length) {
    throw new Error("Sarvam returned no audio");
  }

  return Buffer.from(payload.audios.join(""), "base64");
}

export async function synthesizeSarvamMp3(
  text: string,
  languageCode: string
): Promise<{ mp3: Buffer; usesFallback: boolean }> {
  if (!isSarvamConfigured()) {
    throw new Error("Set SARVAM_API_KEY in .env.local (get key at dashboard.sarvam.ai)");
  }

  const { targetLanguageCode, usesFallback } = resolveSarvamLanguage(languageCode);
  const segments = chunkText(text);
  if (!segments.length) throw new Error("Empty text");

  const buffers: Buffer[] = [];
  for (const seg of segments) {
    buffers.push(await synthesizeSegment(seg, targetLanguageCode));
  }

  return { mp3: Buffer.concat(buffers), usesFallback };
}
