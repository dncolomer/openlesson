import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const DANTES_BASE_URL = "https://dantes.io";

export async function GET() {
  const apiKey = process.env.DANTES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DANTES_API_KEY not configured" },
      { status: 501 },
    );
  }

  try {
    const response = await fetch(`${DANTES_BASE_URL}/api/partner/topics`, {
      headers: { "X-Api-Key": apiKey },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const error = await readDantesError(response);
      return NextResponse.json(
        { error: error ?? `Dantes topics request failed: ${response.status}` },
        { status: response.status === 401 ? 502 : response.status },
      );
    }

    const topics = await response.json();
    return NextResponse.json(topics, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("[dantes/topics] error", error);
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
