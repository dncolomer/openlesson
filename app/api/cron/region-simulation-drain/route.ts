import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { drainRegionSimulationJobs } from "@/lib/region-simulation-jobs";
import { regionSimulationCronSecret } from "@/lib/region-simulation-flags";

export const runtime = "nodejs";
// Next.js segment config requires a numeric literal here (same as REGION_SIM_TICK_MAX_DURATION).
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = regionSimulationCronSecret();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  const actual = Buffer.from(bearer, "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

async function drain(req: NextRequest) {
  if (!authorized(req)) return jsonError(401, "Unauthorized");
  const ids = await drainRegionSimulationJobs();
  return NextResponse.json({ ok: true, ticked: ids.length, jobIds: ids });
}

export async function GET(req: NextRequest) {
  return drain(req);
}

export async function POST(req: NextRequest) {
  return drain(req);
}
