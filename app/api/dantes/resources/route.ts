import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";

export const runtime = "nodejs";
export const revalidate = 1800;

const DANTES_BASE_URL = "https://dantes.io";
const TOPIC_SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function GET(request: NextRequest) {
  const apiKey = process.env.DANTES_API_KEY;
  if (!apiKey) {
    return jsonError(501, "DANTES_API_KEY not configured");
  }

  const topic = request.nextUrl.searchParams.get("topic")?.trim() ?? "";
  if (!topic) {
    return jsonError(400, "Missing required query parameter: topic");
  }
  if (!TOPIC_SLUG_PATTERN.test(topic)) {
    return jsonError(400, "Invalid topic slug format");
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
      return jsonError(response.status === 401 ? 502 : response.status, error ?? `Dantes resources request failed: ${response.status}`);
    }

    const resources = await response.json();
    return NextResponse.json(resources, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("[dantes/resources] error", error);
    return jsonError(500, "Internal server error");
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
