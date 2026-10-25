import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE } from "@/lib/workspace-kind";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  return jsonError(410, AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE);
}
