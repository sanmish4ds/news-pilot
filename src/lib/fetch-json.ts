/** Safe JSON fetch — surfaces plain-text/HTML error pages clearly */

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("json")) {
    const text = await res.text();
    throw new Error(
      text.startsWith("Internal")
        ? "Server error loading data. Check Netlify env vars and redeploy."
        : text.slice(0, 120) || `Request failed (${res.status})`
    );
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
