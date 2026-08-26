import { NextResponse } from "next/server";
import { listTapbenchBenchmarkTasks } from "@/lib/tapbench/catalog";
import { tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public TAPBench Benchmark Task catalog.
 * Tasks are public workspaces owned by tapbench@uncertain.systems.
 * Honest empty catalog when the owner has none or DB is unavailable.
 */
export async function GET() {
  const supabase = tryCreateTapbenchAdminClient();
  const tasks = await listTapbenchBenchmarkTasks(supabase);
  return NextResponse.json({
    owner_email: "tapbench@uncertain.systems",
    tasks,
  });
}
