export async function register() {
  // Only in the actual Node server process (not the edge runtime, and not
  // during `next build`'s static analysis) — the warmer schedules an
  // in-process timer, which only makes sense for a long-running server.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCacheWarmer } = await import("./lib/cache-warmer");
    startCacheWarmer();
  }
}
