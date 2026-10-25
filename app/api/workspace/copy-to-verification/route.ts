import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE } from "@/lib/copy-learning-to-verification";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  return jsonError(410, COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE);
}
