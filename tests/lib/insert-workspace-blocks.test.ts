import { describe, expect, it, vi } from "vitest";
import {
  extractGeneratedPlanNodes,
  insertGeneratedWorkspaceBlocks,
} from "@/lib/insert-workspace-blocks";
import type { WorkspaceBlockRef } from "@/lib/workspace-spatial-create";

function makeBlocks(): WorkspaceBlockRef[] {
  return [
    {
      id: "a",
      title: "Start",
      description: "Origin",
      is_start: true,
      next: ["b", "c"],
      position_x: 0,
      position_y: 0,
    },
    {
      id: "b",
      title: "East",
      description: "East arm",
      next: [],
      position_x: 1,
      position_y: 0,
    },
    {
      id: "c",
      title: "West",
      description: "West arm",
      next: [],
      position_x: -1,
      position_y: 0,
    },
  ];
}

describe("extractGeneratedPlanNodes", () => {
  it("reads nodes or blocks arrays", () => {
    expect(extractGeneratedPlanNodes({ nodes: [{ id: "a" }] })).toHaveLength(1);
    expect(extractGeneratedPlanNodes({ blocks: [{ id: "b" }, { id: "c" }] })).toHaveLength(2);
    expect(extractGeneratedPlanNodes({ title: "x" })).toEqual([]);
    expect(extractGeneratedPlanNodes(null)).toEqual([]);
  });
});

describe("insertGeneratedWorkspaceBlocks", () => {
  it("throws when every insert fails (prevents empty workspaces)", async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: null,
          error: { message: "insert denied" },
        }),
      }),
    });
    const supabase = {
      from: vi.fn(() => ({ insert, update: vi.fn() })),
    } as never;

    await expect(
      insertGeneratedWorkspaceBlocks(supabase, "ws-1", makeBlocks()),
    ).rejects.toThrow(/Failed to create any blocks|insert denied/i);
  });

  it("retries without positions when schema lacks position columns", async () => {
    let call = 0;
    const single = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          data: null,
          error: {
            message: "Could not find the 'position_x' column of 'blocks' in the schema cache",
          },
        };
      }
      return { data: { id: `db-${call}` }, error: null };
    });
    const insert = vi.fn().mockReturnValue({
      select: () => ({ single }),
    });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const supabase = {
      from: vi.fn(() => ({ insert, update })),
    } as never;

    const result = await insertGeneratedWorkspaceBlocks(supabase, "ws-1", makeBlocks());
    expect(result.insertedCount).toBe(3);
    expect(result.blockIdMap.size).toBe(3);
    // First attempt with positions fails once, then 3 bare inserts
    expect(insert).toHaveBeenCalled();
    const firstPayload = insert.mock.calls[0][0];
    expect(firstPayload).toHaveProperty("position_x");
    const retryPayload = insert.mock.calls[1][0];
    expect(retryPayload).not.toHaveProperty("position_x");
  });

  it("inserts with positions and wires branch next links", async () => {
    const ids = new Map([
      ["a", "uuid-a"],
      ["b", "uuid-b"],
      ["c", "uuid-c"],
    ]);
    let n = 0;
    const order = ["a", "b", "c"];
    const single = vi.fn(async () => {
      const key = order[n++];
      return { data: { id: ids.get(key) }, error: null };
    });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn(() => ({ insert, update })),
    } as never;

    const result = await insertGeneratedWorkspaceBlocks(supabase, "ws-1", makeBlocks());
    expect(result.insertedCount).toBe(3);
    expect(result.blockIdMap.get("a")).toBe("uuid-a");
    // Branch a → b,c
    expect(update).toHaveBeenCalledWith({ next_block_ids: ["uuid-b", "uuid-c"] });
  });
});

describe("generate route wiring", () => {
  it("uses insertGeneratedWorkspaceBlocks and rolls back empty workspaces", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "app/api/workspace/generate/route.ts"), "utf8");
    expect(src).toContain("insertGeneratedWorkspaceBlocks");
    expect(src).toContain("extractGeneratedPlanNodes");
    expect(src).toMatch(/delete\(\)\.eq\("id", plan\.id\)/);
    expect(src).toContain("normalizeGeneratedPlanNodes");
  });
});
