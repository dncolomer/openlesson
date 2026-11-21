import { NextResponse } from "next/server";
import { toolPublicJwks } from "@/lib/lti/store";

export const runtime = "nodejs";

export async function GET() {
  const jwks = await toolPublicJwks();
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
