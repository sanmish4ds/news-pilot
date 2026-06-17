/** Bhashini.ai — native TTS for all 22 constitutional languages including Maithili */

const BHASHINI_API_KEY = (process.env.BHASHINI_API_KEY || "").trim();
const BHASHINI_BASE = "https://tts.bhashini.ai/v2/synthesize";
const BHASHINI_VOICE = (process.env.BHASHINI_VOICE || "Female1").trim();
const BHASHINI_SPEECH_RATE = Number(process.env.BHASHINI_SPEECH_RATE || "0.95") || 0.95;

/** Map our language codes → Bhashini language names */
export const BHASHINI_LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
  ne: "Nepali",
  mai: "Maithili",
  doi: "Dogri",
  kok: "Konkani",
  mni: "Manipuri",
  brx: "Bodo",
  sat: "Santali",
  sd: "Sindhi",
  sa: "Sanskrit",
  ks: "Kashmiri",
};

export function isBhashiniConfigured(): boolean {
  return BHASHINI_API_KEY.length >= 16;
}

export function supportsBhashini(languageCode: string): boolean {
  return languageCode in BHASHINI_LANGUAGES;
}

function chunkText(text: string, maxLen = 1800): string[] {
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
  bhashiniLang: string
): Promise<Buffer> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
  };
  if (BHASHINI_API_KEY) {
    headers["X-API-KEY"] = BHASHINI_API_KEY;
  }

  const response = await fetch(BHASHINI_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      language: bhashiniLang,
      voiceName: BHASHINI_VOICE,
      voiceStyle: "News",
      speechRate: BHASHINI_SPEECH_RATE,
      ttsModelType: "TTS v3",
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Bhashini TTS failed (${response.status}): ${err.slice(0, 200)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("audio")) {
    throw new Error("Bhashini returned non-audio response");
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function synthesizeBhashiniMp3(
  text: string,
  languageCode: string
): Promise<Buffer> {
  const bhashiniLang = BHASHINI_LANGUAGES[languageCode];
  if (!bhashiniLang) {
    throw new Error(`Language ${languageCode} not supported by Bhashini`);
  }

  const segments = chunkText(text);
  if (!segments.length) throw new Error("Empty text");

  const buffers: Buffer[] = [];
  for (const seg of segments) {
    buffers.push(await synthesizeSegment(seg, bhashiniLang));
  }
  return Buffer.concat(buffers);
}
