import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech, getTtsStatus } from "@/lib/tts-router";

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const { text, languageCode = "en" } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text to speak" }, { status: 400 });
    }

    const status = getTtsStatus(languageCode);
    if (!status.enabled) {
      return NextResponse.json(
        {
          error: "Set SARVAM_API_KEY in .env.local (https://dashboard.sarvam.ai)",
        },
        { status: 503 }
      );
    }

    const { mp3, provider, usesFallback } = await synthesizeSpeech(
      String(text).trim(),
      languageCode
    );

    return new NextResponse(new Uint8Array(mp3), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-TTS-Provider": provider,
        "X-TTS-Fallback": usesFallback ? "1" : "0",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Speech synthesis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
