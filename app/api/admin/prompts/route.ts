import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import inventory from "@/data/prompt-inventory.json";
import type { PromptInventory } from "@/lib/prompt-inventory/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  return NextResponse.json(inventory as PromptInventory);
}