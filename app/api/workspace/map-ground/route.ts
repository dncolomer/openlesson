import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  loadMapGroundRules,
  normalizeLockUntilBlockIds,
  normalizeUnusableCells,
  toggleUnusableCell,
} from "@/lib/map-ground-rules";
import {
  normalizeBlockLocalContext,
  parseBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";

type MapGroundOp =
  | "set_lock_until"
  | "toggle_unusable"
  | "set_unusable_cells"
  | "set_local_context"
  | "set_block_status"
  | "get";

/**
 * Persist map-ground rules (lock-until, unusable cells) and block-local context.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspaceId,
      op,
      blockId,
      prerequisiteIds,
      row,
      col,
      unusableCells,
      localContext,
      status: statusBody,
    } = body as {
      workspaceId?: string;
      op?: MapGroundOp;
      blockId?: string;
      prerequisiteIds?: string[];
      row?: number;
      col?: number;
      unusableCells?: Array<{ row: number; col: number }>;
      localContext?: BlockLocalContextInput | null;
      /** Learner mark-done / status flip. */
      status?: string;
    };

    if (!workspaceId || !op) {
      return NextResponse.json({ error: "workspaceId and op are required" }, { status: 400 });
    }

    // Practice-tier AYCL may mark done / read ground; cannot reshape map.
    const authoringOps = new Set([
      "set_lock_until",
      "toggle_unusable",
      "set_unusable_cells",
      "set_local_context",
    ]);
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: authoringOps.has(String(op || "")),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    if (op === "get") {
      const { data: plan } = await supabase
        .from("workspaces")
        .select("unusable_cells")
        .eq("id", workspaceId)
        .single();
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, title, status, lock_until_block_ids, local_context")
        .eq("workspace_id", workspaceId);
      const rules = loadMapGroundRules({
        unusable_cells: plan?.unusable_cells,
        blocks: blocks || [],
      });
      return NextResponse.json({
        unusableCells: rules.unusableCells,
        blocks: (blocks || []).map((b) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          lock_until_block_ids: normalizeLockUntilBlockIds(
            b.lock_until_block_ids,
            b.id,
          ),
          local_context: parseBlockLocalContext(b.local_context),
        })),
      });
    }

    if (op === "set_lock_until") {
      if (!blockId) {
        return NextResponse.json({ error: "blockId is required" }, { status: 400 });
      }
      const lock_until_block_ids = normalizeLockUntilBlockIds(prerequisiteIds || [], blockId);
      const { error } = await supabase
        .from("blocks")
        .update({ lock_until_block_ids })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: blocks } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);
      return NextResponse.json({
        ok: true,
        lock_until_block_ids,
        updatedNodes: blocks || [],
      });
    }

    if (op === "set_block_status") {
      if (!blockId || typeof statusBody !== "string" || !statusBody.trim()) {
        return NextResponse.json(
          { error: "blockId and status are required" },
          { status: 400 },
        );
      }
      // Learner Done uses completed/done; no "in_progress" product concept here.
      const status = statusBody.trim().toLowerCase();
      const allowed = new Set(["available", "completed", "done", "locked", "skipped"]);
      if (!allowed.has(status)) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 });
      }
      const { error } = await supabase
        .from("blocks")
        .update({ status })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: blocks } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);
      return NextResponse.json({
        ok: true,
        status,
        updatedNodes: blocks || [],
      });
    }

    if (op === "toggle_unusable") {
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return NextResponse.json({ error: "row and col integers required" }, { status: 400 });
      }
      const { data: plan } = await supabase
        .from("workspaces")
        .select("unusable_cells")
        .eq("id", workspaceId)
        .single();
      const next = toggleUnusableCell(
        normalizeUnusableCells(plan?.unusable_cells),
        row!,
        col!,
      );
      const { error } = await supabase
        .from("workspaces")
        .update({ unusable_cells: next })
        .eq("id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, unusableCells: next });
    }

    if (op === "set_unusable_cells") {
      const next = normalizeUnusableCells(unusableCells || []);
      const { error } = await supabase
        .from("workspaces")
        .update({ unusable_cells: next })
        .eq("id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, unusableCells: next });
    }

    if (op === "set_local_context") {
      if (!blockId) {
        return NextResponse.json({ error: "blockId is required" }, { status: 400 });
      }
      const normalized = normalizeBlockLocalContext(localContext || null);
      const payload =
        normalized.hasLocalMaterials
          ? {
              notes: normalized.notes,
              local_files: normalized.localFiles,
              global_file_refs: normalized.globalFileRefs,
              ...(normalized.externalResourceIds.length
                ? { external_resource_ids: normalized.externalResourceIds }
                : {}),
            }
          : null;
      const { error } = await supabase
        .from("blocks")
        .update({ local_context: payload })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: blocks } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);
      return NextResponse.json({
        ok: true,
        local_context: payload,
        updatedNodes: blocks || [],
      });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    console.error("map-ground route error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
