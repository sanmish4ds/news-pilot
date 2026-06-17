import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { brief, sources, style, houseStyle, wordCount } = await req.json();

    if (!brief) {
      return NextResponse.json(
        { error: "Please provide a story brief." },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const userMessage = `
STORY BRIEF: ${brief}
ARTICLE STYLE: ${style || "Breaking news"}
TARGET WORD COUNT: ${wordCount || "500"} words
${houseStyle ? `HOUSE STYLE NOTES: ${houseStyle}` : ""}
${sources ? `\nSOURCE MATERIAL:\n${sources}` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.draft },
        { role: "user", content: userMessage },
      ],
      max_tokens: 3000,
    });

    const result = response.choices[0]?.message?.content || "";

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
