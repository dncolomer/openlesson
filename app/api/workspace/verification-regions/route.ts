/**
 * Workspace region create is retired. Regions are created by dashboard simulation.
 */
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";

export const runtime = "nodejs";

export async function POST() {
  return jsonError(400, "Regions are created by running a simulation");
}

export async function GET() {
  return NextResponse.json({ error: "Regions are created by running a simulation" }, { status: 400 });
}
