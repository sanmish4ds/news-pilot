import { NextRequest, NextResponse } from "next/server";
import { getTtsStatus } from "@/lib/tts-router";

export async function GET(req: NextRequest) {
  const languageCode = req.nextUrl.searchParams.get("lang") || undefined;
  return NextResponse.json(getTtsStatus(languageCode));
}
