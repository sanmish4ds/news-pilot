import { createServerCache, hashKey } from "./server-cache";
import { synthesizeSpeech } from "./tts-router";

export interface TtsResult {
  mp3: Buffer;
  provider: string;
}

// Longer than the hourly cache-warmer's cadence (see cache-warmer.ts) plus a
// buffer, so bulletin audio synthesized by one warm-up run stays cached for
// real listeners until the next run replaces it.
const TTL_MS = 75 * 60 * 1000;
const cache = createServerCache<TtsResult>(TTL_MS);
// Dedupes concurrent requests for the same text — without this, a background
// warm-up and a user's play click landing at the same time would trigger two
// separate (expensive) synthesis calls for identical audio.
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
