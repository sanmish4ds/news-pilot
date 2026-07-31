import { getOpenAIClient, openaiStructured } from "@/lib/openai";
import { TopNewsItem } from "./top-news";

const CHUNK_SIZE = 5;

/**
 * Google News' RSS feed has no real per-article summary — its `contentSnippet`
 * is a "related coverage" cluster of other stories' headlines, not a summary
 * of this one (see top-news.ts). So a brief, genuine one-sentence summary per
 * headline is generated here instead, in small parallel chunks to keep it
 * fast. Runs once per top-news cache window (15 min), not per request.
 */
export async function generateBriefSummaries(
  items: Pick<TopNewsItem, "id" | "title" | "source">[]
): Promise<Record<string, string>> {
  if (!items.length) return {};

  const client = getOpenAIClient();
  const chunks: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }

  const systemPrompt = `You write brief one-sentence summaries of news stories for a radio news app, based only on the headline and source outlet (no article text is available). Write a plain factual sentence (12-20 words) explaining what the story is likely about — do not repeat the headline verbatim, and do not invent specific facts, numbers, or quotes not implied by the headline. If the headline is already fully self-explanatory, give a bit of likely context or why it matters instead of just rephrasing it.`;

  const chunkResults = await Promise.all(
    chunks.map((chunk) =>
      openaiStructured<{ summaries: { id: string; summary: string }[] }>(client, {
        system: systemPrompt,
        userContent: JSON.stringify(chunk.map((i) => ({ id: i.id, title: i.title, source: i.source }))),
        maxTokens: 700,
        toolName: "return_summaries",
        toolDescription: "Return the one-sentence summaries.",
        inputSchema: {
          type: "object",
          properties: {
            summaries: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, summary: { type: "string" } },
                required: ["id", "summary"],
              },
            },
          },
          required: ["summaries"],
        },
      }).catch(() => ({ summaries: [] as { id: string; summary: string }[] }))
    )
  );

  const result: Record<string, string> = {};
  for (const { summaries } of chunkResults) {
    for (const s of summaries) {
      if (s.id && s.summary) result[s.id] = s.summary.trim();
    }
  }
  return result;
}
