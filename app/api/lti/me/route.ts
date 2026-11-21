import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { readLtiLaunchSession } from "@/lib/lti/request-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await readLtiLaunchSession();
  if (!session) return jsonError(401, "No LTI launch");
  return NextResponse.json({
    identity: session.identity,
    displayName: session.displayName,
    instructor: session.instructor,
    flowToken: session.flowToken || null,
    flowKind: session.flowKind || null,
    regionId: session.regionId || null,
    action: session.action || null,
    contextId: session.contextId,
  });
}
