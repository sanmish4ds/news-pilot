import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Please provide content to fact-check." },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.factCheck },
        {
          role: "user",
          content: `Please fact-check the following content:\n\n${content}`,
        },
      ],
      max_tokens: 2500,
    });

    const result = response.choices[0]?.message?.content || "";

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
