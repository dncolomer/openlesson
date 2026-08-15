/**
 * Deferred-after-P10 items: first grid chrome split (contract exists),
 * OpenAPI blocked (envelopes not unified), source-string tests follow extractions.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  apiErrorEnvelopesAreUnified,
  buildNestedApiErrorEnvelope,
  classifyApiErrorEnvelope,
} from "@/lib/api-error-envelope";
import { errorResponse } from "@/lib/pow-api/auth";
import { postWorkspaceGridOp } from "@/lib/workspace-grid-ops-client";
import {
  mapSelectionFromApplyPayload,
  mapSelectionToApplyPayload,
  nextWorkspaceMapSelection,
  emptyWorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import { toolTooltip } from "@/components/block-skill-grid/map-tool-icons";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-71b3c8f22936/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("deferred-after-P10 follow-ups", () => {
  it("grid contract exists; chrome extracted; envelopes not unified", async () => {
    const labels = {
      zoomIn: "In",
      zoomOut: "Out",
      recenter: "Recenter",
    };
    expect(toolTooltip("select", labels).length).toBeGreaterThan(0);
    expect(toolTooltip("clone", labels, { cloneArmed: true })).toMatch(/armed/i);

    const opened = nextWorkspaceMapSelection(emptyWorkspaceMapSelection(), {
      type: "apply_search_blocks",
      blockIds: ["b1"],
    });
    const payload = mapSelectionToApplyPayload(opened, 1);
    expect(mapSelectionFromApplyPayload(payload).expandedBlockId).toBe("b1");

    const posted: string[] = [];
    await postWorkspaceGridOp(
      { workspaceId: "ws", op: "move" },
      async (url) => {
        posted.push(String(url));
        return new Response(JSON.stringify({ updatedNodes: [] }), { status: 200 });
      },
    );
    expect(posted[0]).toBe("/api/workspace/grid-ops");

    const nested = buildNestedApiErrorEnvelope("forbidden", "nope");
    expect(classifyApiErrorEnvelope(nested)).toBe("nested_code");
    expect(classifyApiErrorEnvelope({ error: "Not authenticated" })).toBe("string_error");
    expect(apiErrorEnvelopesAreUnified()).toBe(false);
    const res = errorResponse(403, "forbidden", "nope");
    expect(res.status).toBe(403);

    const grid = read("components/BlockSkillGrid.tsx");
    const icons = read("components/block-skill-grid/map-tool-icons.tsx");
    const badges = read("components/block-skill-grid/map-tile-badges.tsx");
    const sessionChat = read("app/api/session-chat/route.ts");
    const stashAuth = read("lib/pow-api/auth.ts");

    expect(grid).toContain("from \"@/components/block-skill-grid/map-tool-icons\"");
    expect(grid).toContain("from \"@/components/block-skill-grid/map-tile-badges\"");
    expect(read("components/SessionList.tsx")).toContain("postWorkspaceGridOp");
    expect(grid).not.toContain("function ToolIcon");
    expect(grid).not.toContain("function MapCellStatusGlyph");
    expect(icons).toContain("export function ToolIcon");
    expect(badges).toContain("export function MapCellStatusGlyph");

    expect(sessionChat).toContain('{ error: "Missing problem" }');
    expect(stashAuth).toContain("buildNestedApiErrorEnvelope");
    expect(existsSync(join(ROOT, "openapi.yaml"))).toBe(false);
    expect(existsSync(join(ROOT, "openapi.json"))).toBe(false);

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "deferred-p10-followups.txt"),
      [
        `gridContractOps=${posted[0]}`,
        `oneBlockSearch=${mapSelectionFromApplyPayload(payload).expandedBlockId}`,
        `envelopesUnified=${apiErrorEnvelopesAreUnified()}`,
        `nestedKind=${classifyApiErrorEnvelope(nested)}`,
        `stringKind=${classifyApiErrorEnvelope({ error: "Not authenticated" })}`,
        "chrome split: map-tool-icons + map-tile-badges",
        "OpenAPI blocked: product string errors vs v3 nested code envelope",
        "source-string tests retargeted to extracted chrome files",
      ].join("\n"),
      "utf8",
    );
  });
});
