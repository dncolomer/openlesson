import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 1800;

const DANTES_BASE_URL = "https://dantes.io";
const TOPIC_SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function GET(request: NextRequest) {
  const apiKey = process.env.DANTES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DANTES_API_KEY not configured" },
      { status: 501 },
    );
  }

  const topic = request.nextUrl.searchParams.get("topic")?.trim() ?? "";
  if (!topic) {
    return NextResponse.json({ error: "Missing required query parameter: topic" }, { status: 400 });
  }
  if (!TOPIC_SLUG_PATTERN.test(topic)) {
    return NextResponse.json({ error: "Invalid topic slug format" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${DANTES_BASE_URL}/api/partner/resources?topic=${encodeURIComponent(topic)}`,
      {
        headers: { "X-Api-Key": apiKey },
        next: { revalidate: 1800 },
      },
    );

    if (!response.ok) {
      const error = await readDantesError(response);
      return NextResponse.json(
        { error: error ?? `Dantes resources request failed: ${response.status}` },
        { status: response.status === 401 ? 502 : response.status },
      );
    }

    const resources = await response.json();
    return NextResponse.json(resources, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("[dantes/resources] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function readDantesError(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
