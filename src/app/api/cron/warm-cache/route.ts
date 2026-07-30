import { NextRequest, NextResponse } from "next/server";
import { runCacheWarmOnce } from "@/lib/cache-warmer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual/external trigger for the same warm-up the hourly in-process
 * scheduler runs (see cache-warmer.ts) — lets you test it on demand instead
 * of waiting for the next :01 IST mark, and doubles as the endpoint an
 * external cron would hit if this ever moves off a single always-on server.
 *
 * If CRON_SECRET is set, requests must include it as ?secret=... or an
 * `Authorization: Bearer <secret>` header. If it's unset (e.g. local dev),
 * the endpoint is open — set it before deploying somewhere public.
 */
export async function GET(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (configuredSecret) {
    const provided =
      req.nextUrl.searchParams.get("secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runCacheWarmOnce();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Warm-up failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
