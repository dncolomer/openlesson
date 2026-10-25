import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HELIOS_MAP_AGENT_APPLY_TOOL,
  HELIOS_MAP_AGENT_LIST_TOOL,
  heliosMapAgentCatalog,
  heliosMapAgentFeatureDenied,
  parseHeliosMapAgentCalls,
  remapHeliosSnapshotIds,
} from "@/lib/pow-api/helios-map-agent";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-proof-of-work-server";
import { agentToolFeature } from "@/lib/workspace-capabilities";
import {
  HELIOS_MAP_TOOL_IDS,
  heliosMapSnapshotFromBlocks,
} from "@/lib/workspace-helios-tools";
import { WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";

const ROOT = join(__dirname, "../..");

describe("Helios map tools on the public workspace API / MCP", () => {
  it("exposes the same catalog as in-app Helios", () => {
    expect(heliosMapAgentCatalog().map((tool) => tool.id).sort()).toEqual(
      [...HELIOS_MAP_TOOL_IDS].sort(),
    );
    expect(heliosMapAgentCatalog().some((t) => t.family === "overlay")).toBe(
      true,
    );
    expect(heliosMapAgentCatalog().some((t) => t.id === "add_note")).toBe(true);
    expect(
      heliosMapAgentCatalog().some((t) => t.id === "add_drawing_layer"),
    ).toBe(true);
  });

  it("parses a single tool or an atomic tool_calls batch", () => {
    expect(
      parseHeliosMapAgentCalls({
        tool: "add_block",
        arguments: { row: 0, col: 1, title: "Alpha" },
      }),
    ).toEqual([
      { name: "add_block", args: { row: 0, col: 1, title: "Alpha" } },
    ]);
    const batch = parseHeliosMapAgentCalls({
      tool_calls: [
        { name: "add_block", arguments: { row: 0, col: 0 } },
        { name: "add_note", arguments: { body: "hello", x: 10, y: 20 } },
      ],
    });
    expect(batch).toHaveLength(2);
    expect(batch[1]?.name).toBe("add_note");
    expect(parseHeliosMapAgentCalls({ tool: "not_a_helios_tool" })).toEqual([]);
  });

  it("remaps temporary Helios ids onto persisted UUIDs", () => {
    const snapshot = heliosMapSnapshotFromBlocks({
      blocks: [
        {
          id: "helios-1",
          title: "A",
          position_x: 0,
          position_y: 0,
          next_block_ids: ["helios-2"],
        },
        {
          id: "helios-2",
          title: "B",
          position_x: 1,
          position_y: 0,
          lock_until_block_ids: ["helios-1"],
        },
      ],
    });
    const remapped = remapHeliosSnapshotIds(
      snapshot,
      new Map([
        ["helios-1", "uuid-1"],
        ["helios-2", "uuid-2"],
      ]),
    );
    expect(remapped.blocks[0]?.id).toBe("uuid-1");
    expect(remapped.blocks[0]?.next_block_ids).toEqual(["uuid-2"]);
    expect(remapped.blocks[1]?.lock_until_block_ids).toEqual(["uuid-1"]);
  });

  it("gates list/apply on the Learning map feature", () => {
    expect(agentToolFeature(HELIOS_MAP_AGENT_LIST_TOOL)).toBe("map");
    expect(agentToolFeature(HELIOS_MAP_AGENT_APPLY_TOOL)).toBe("map");
    expect(heliosMapAgentFeatureDenied("standard")).toBeNull();
    expect(heliosMapAgentFeatureDenied("knowledge_region")).toMatch(
      /Verification flows/,
    );
    expect(heliosMapAgentFeatureDenied("calibration")).toMatch(
      /Calibration flows/,
    );
  });

  it("has REST + MCP twins on AGENT_TOOL_SURFACE", () => {
    const list = AGENT_TOOL_SURFACE.find(
      (tool) => tool.name === HELIOS_MAP_AGENT_LIST_TOOL,
    );
    const apply = AGENT_TOOL_SURFACE.find(
      (tool) => tool.name === HELIOS_MAP_AGENT_APPLY_TOOL,
    );
    expect(list?.rest).toEqual({
      method: "GET",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/map-tools`,
    });
    expect(apply?.rest).toEqual({
      method: "POST",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/map-tools`,
    });
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain(
      HELIOS_MAP_AGENT_LIST_TOOL,
    );
    expect(MCP_EVIDENCE_TOOLS.map((t) => t.name)).toContain(
      HELIOS_MAP_AGENT_APPLY_TOOL,
    );
    const applySchema = MCP_EVIDENCE_TOOLS.find(
      (t) => t.name === HELIOS_MAP_AGENT_APPLY_TOOL,
    );
    expect(JSON.stringify(applySchema)).toContain("add_block");
    expect(JSON.stringify(applySchema)).toContain("add_note");
    expect(JSON.stringify(applySchema)).toContain("add_drawing_layer");

    const route = join(
      ROOT,
      "app/api/v3/workspaces/[id]/map-tools/route.ts",
    );
    expect(existsSync(route)).toBe(true);
    const src = readFileSync(route, "utf8");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/export async function POST/);
    expect(src).toContain("listHeliosMapToolsForAgent");
    expect(src).toContain("applyHeliosMapToolsForAgent");
  });
});
