import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { getAppOrigin } from "@/lib/app-url";
import { requireLtiOrgAdmin } from "@/lib/lti/org-auth";
import { parsePlatformRegistration, presentPlatformRegistration } from "@/lib/lti/platform";
import { listLtiPlatforms, upsertLtiPlatform } from "@/lib/lti/store";
import { ltiToolUrls } from "@/lib/lti/tool-urls";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireLtiOrgAdmin();
    if (!auth.ok) return auth.response;
    const platforms = await listLtiPlatforms(auth.organizationId);
    return NextResponse.json({
      tool: ltiToolUrls(getAppOrigin(req)),
      platforms: platforms.map(presentPlatformRegistration),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load LMS registration";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireLtiOrgAdmin();
    if (!auth.ok) return auth.response;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parsePlatformRegistration(body, auth.organizationId);
    if ("error" in parsed) return jsonError(400, parsed.error);
    const saved = await upsertLtiPlatform(parsed);
    return NextResponse.json({ platform: presentPlatformRegistration(saved) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save LMS registration";
    return jsonError(500, message);
  }
}
