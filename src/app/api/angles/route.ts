import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { brief, audience, publicationTone } = await req.json();

    if (!brief) {
      return NextResponse.json(
        { error: "Please provide a story brief or topic." },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const userMessage = `
STORY BRIEF: ${brief}
${audience ? `TARGET AUDIENCE: ${audience}` : ""}
${publicationTone ? `PUBLICATION TONE: ${publicationTone}` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.angles },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
    });

    const result = response.choices[0]?.message?.content || "";

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
