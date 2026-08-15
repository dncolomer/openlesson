import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
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
import { createAdminClient } from "@/lib/supabase/admin";

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
      return jsonError(400, "workspaceId and op are required");
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
        return jsonError(400, "blockId is required");
      }
      const lock_until_block_ids = normalizeLockUntilBlockIds(prerequisiteIds || [], blockId);
      const { error } = await supabase
        .from("blocks")
        .update({ lock_until_block_ids })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (error) {
        return jsonError(500, error.message);
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
        return jsonError(400, "blockId and status are required");
      }
      // Learner Done uses completed/done; no "in_progress" product concept here.
      const status = statusBody.trim().toLowerCase();
      const allowed = new Set(["available", "completed", "done", "locked", "skipped"]);
      if (!allowed.has(status)) {
        return jsonError(400, "invalid status");
      }
      // Learners (incl. non-owners with access) must be able to force Mark Done.
      // Auth already verified via guardWorkspaceRoute; write with admin client.
      const writeDb = createAdminClient();
      const { error } = await writeDb
        .from("blocks")
        .update({ status })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (error) {
        return jsonError(500, error.message);
      }
      const { data: blocks } = await writeDb
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
        return jsonError(400, "row and col integers required");
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
        return jsonError(500, error.message);
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
        return jsonError(500, error.message);
      }
      return NextResponse.json({ ok: true, unusableCells: next });
    }

    if (op === "set_local_context") {
      if (!blockId) {
        return jsonError(400, "blockId is required");
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
        return jsonError(500, error.message);
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

    return jsonError(400, `Unknown op: ${op}`);
  } catch (err) {
    console.error("map-ground route error", err);
    return jsonError(500, "Internal error");
  }
}
