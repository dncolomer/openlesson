import { NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/xai-client";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ models: AVAILABLE_MODELS });
}
