import { createServerCache, hashKey } from "./server-cache";
import { synthesizeSpeech } from "./tts-router";

export interface TtsResult {
  mp3: Buffer;
  provider: string;
}

// Long enough that the same bulletin/summary text is only ever synthesized
// once per day — the first listener pays the real ElevenLabs cost, everyone
// after that within the window gets the identical cached audio.
const TTL_MS = 25 * 60 * 60 * 1000;
const cache = createServerCache<TtsResult>(TTL_MS);
// Dedupes concurrent requests for the same text — without this, two
// requests landing close together (e.g. the fire-and-forget bulletin
// pre-fetch and a user's play click) would trigger two separate (expensive)
// synthesis calls for identical audio.
const inFlight = new Map<string, Promise<TtsResult>>();

function cacheKey(languageCode: string, text: string): string {
  return hashKey(languageCode, text);
}

async function synthesizeAndCache(text: string, languageCode: string, key: string): Promise<TtsResult> {
  const result = await synthesizeSpeech(text, languageCode);
  cache.set(key, result);
  return result;
}

/** Cache hit, join an in-flight request, or start a new synthesis — never duplicates work for the same text. */
export function getOrSynthesizeSpeech(text: string, languageCode: string): Promise<TtsResult> {
  const key = cacheKey(languageCode, text);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = synthesizeAndCache(text, languageCode, key).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/**
 * Fire-and-forget: start synthesizing now instead of waiting for the user to
 * press play. By the time they actually click (after reading the headlines),
 * the audio is often already cached — same result, just computed earlier.
 */
export function warmTtsCache(text: string, languageCode: string): void {
  if (!text?.trim()) return;
  void getOrSynthesizeSpeech(text.trim(), languageCode).catch(() => {
    // Best-effort — if this fails, the real request will just synthesize normally.
  });
}
