/**
 * Store canvas proof for a calibration run. Not a verification result.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { addCalibrationProof } from "@/lib/calibration-flow-repository";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { events?: unknown; identity?: string };
  const stored = await addCalibrationProof(token, body.events, String(body.identity || ""));
  if (!stored.ok) {
    const status = stored.reason === "not_found" ? 404 : 400;
    return jsonError(status, stored.reason);
  }
  return NextResponse.json({
    ok: true,
    proofId: stored.proof?.id ?? null,
    verificationRun: false,
  });
}
