import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, SYSTEM_PROMPTS } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { subject, background, topic, interviewType } = await req.json();

    if (!subject && !topic) {
      return NextResponse.json(
        { error: "Please provide a subject or interview topic." },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const userMessage = `
INTERVIEW SUBJECT: ${subject || "Unknown"}
INTERVIEW TOPIC: ${topic || "General"}
INTERVIEW TYPE: ${interviewType || "News interview"}
${background ? `\nSUBJECT BACKGROUND / CONTEXT:\n${background}` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.interviewPrep },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "";

    return NextResponse.json({ result: content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
