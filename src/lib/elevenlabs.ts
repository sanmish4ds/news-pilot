/** ElevenLabs TTS — server-side only (pattern from SQLclMCP/sql-learn-server.js) */

function sanitizeApiKey(raw: string): string {
  let k = String(raw || "").trim().replace(/^\uFEFF/, "");
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, "").trim();
  return k;
}

export const ELEVENLABS_API_KEY = sanitizeApiKey(process.env.ELEVENLABS_API_KEY || "");
export const ELEVENLABS_VOICE_ID = (process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM").trim();
export const ELEVENLABS_MODEL_ID = (process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5").trim();
export const ELEVENLABS_FALLBACK_MODEL_ID = (
  process.env.ELEVENLABS_FALLBACK_MODEL_ID || "eleven_multilingual_v2"
).trim();
export const ELEVENLABS_OUTPUT_FORMAT = (process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128").trim();
export const ELEVENLABS_TIMEOUT_MS = Number(process.env.ELEVENLABS_TIMEOUT_MS || 120000) || 120000;

function formatErrorBody(errBody: string, httpStatus: number): string {
  const raw = String(errBody || "").trim();
  if (!raw) return `ElevenLabs HTTP ${httpStatus}`;
  try {
    const j = JSON.parse(raw) as { detail?: { message?: string; status?: string } | string };
    const d = j.detail;
    if (typeof d === "object" && d?.message) {
      let msg = String(d.message);
      if (d.status === "invalid_api_key" || httpStatus === 401) {
        msg += " Check ELEVENLABS_API_KEY in .env.local.";
      }
      return msg;
    }
    if (typeof d === "string") return d;
  } catch {
    /* not JSON */
  }
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

export function chunkText(text: string, maxLen = 4500): string[] {
  const t = String(text || "").trim();
  if (!t) return [];
  const max = Math.min(Math.max(500, maxLen), 4500);
  if (t.length <= max) return [t];
  const parts: string[] = [];
  let rest = t;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < 240) cut = rest.lastIndexOf(". ", max);
    if (cut < 240) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function ttsOneSegment(
  segmentText: string,
  modelId: string,
  voiceId: string,
  prevSlice?: string | null,
  nextSlice?: string | null
): Promise<Buffer> {
  const payload: Record<string, string> = { text: segmentText, model_id: modelId };
  if (prevSlice) payload.previous_text = prevSlice;
  if (nextSlice) payload.next_text = nextSlice;

  const q = new URLSearchParams({ output_format: ELEVENLABS_OUTPUT_FORMAT });
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?${q.toString()}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ELEVENLABS_TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      const err = new Error(formatErrorBody(errBody, r.status)) as Error & { statusCode?: number };
      err.statusCode = r.status;
      throw err;
    }

    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function ttsWithFallback(
  segmentText: string,
  voiceId: string,
  prevSlice?: string | null,
  nextSlice?: string | null
): Promise<Buffer> {
  const models = [ELEVENLABS_MODEL_ID];
  if (ELEVENLABS_FALLBACK_MODEL_ID && ELEVENLABS_FALLBACK_MODEL_ID !== ELEVENLABS_MODEL_ID) {
    models.push(ELEVENLABS_FALLBACK_MODEL_ID);
  }

  let lastErr: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    try {
      return await ttsOneSegment(segmentText, models[i], voiceId, prevSlice, nextSlice);
    } catch (e) {
      lastErr = e as Error;
      const sc = (e as Error & { statusCode?: number }).statusCode;
      if (sc === 401 || sc === 403) throw e;
      if (i === models.length - 1) throw e;
    }
  }
  throw lastErr || new Error("TTS failed");
}

export async function synthesizeSpeechMp3(fullText: string): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const segments = chunkText(fullText);
  if (!segments.length) throw new Error("Empty text");

  const parallel = Math.min(6, Math.max(2, Number(process.env.ELEVENLABS_TTS_PARALLEL || 4) || 4));

  if (segments.length === 1) {
    return ttsWithFallback(segments[0], ELEVENLABS_VOICE_ID, null, null);
  }

  // Parallel synthesis for long bulletins (SQLclMCP pattern)
  const buffers: Buffer[] = new Array(segments.length);
  let idx = 0;

  async function worker() {
    while (idx < segments.length) {
      const i = idx++;
      const prev = i > 0 ? segments[i - 1] : null;
      const next = i < segments.length - 1 ? segments[i + 1] : null;
      const prevSlice = prev ? (prev.length > 800 ? prev.slice(prev.length - 800) : prev) : null;
      const nextSlice = next ? (next.length > 800 ? next.slice(0, 800) : next) : null;
      buffers[i] = await ttsWithFallback(segments[i], ELEVENLABS_VOICE_ID, prevSlice, nextSlice);
    }
  }

  await Promise.all(Array.from({ length: Math.min(parallel, segments.length) }, () => worker()));

  return Buffer.concat(buffers);
}

export function isElevenLabsConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
}
