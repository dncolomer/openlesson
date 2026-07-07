import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ keys: [] }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}