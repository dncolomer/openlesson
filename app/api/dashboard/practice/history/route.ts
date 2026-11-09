import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { loadPracticeHistory } from "@/lib/practice-session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const history = await loadPracticeHistory(auth.user.id);
    return NextResponse.json(history);
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not load practice history",
    );
  }
}
