/**
 * The shipped map-explore handler rejects explore-block.
 * Search, suggest-spot, overview, and area summary stay accepted operations.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

vi.mock("@/lib/api/product-access", () => ({
  requireProductAccess: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/workspace-feature-gate", () => ({
  denyWorkspaceFeatureById: vi.fn(async () => null),
}));

vi.mock("@/lib/xai-client", () => ({
  callXaiJSON: vi.fn(async () => ({ success: false, error: "offline" })),
  systemMessage: (content: string) => ({ role: "system", content }),
  userMessage: (content: string) => ({ role: "user", content }),
  DEFAULT_MODEL: "test-model",
}));

import { POST } from "@/app/api/workspace/map-explore/route";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/workspace/map-explore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("map explore operations", () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
    getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
      error: null,
    });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "ws-1", user_id: "user-1" },
            error: null,
          }),
        }),
      }),
    });
  });

  it("rejects explore-block and accepts the four live operations", async () => {
    const rejected = await post({
      workspaceId: "ws-1",
      op: "explore_block",
      cell: { row: 1, col: 2 },
    });
    expect(rejected.status).toBe(400);
    const rejectedBody = await rejected.json();
    const rejectedMessage = errorMessageFromBody(rejectedBody, "");
    expect(rejectedMessage).toMatch(/search, suggest_spot, overview, area_summary/);
    expect(rejectedMessage).not.toMatch(/explore_block/);

    const search = await post({ workspaceId: "ws-1", op: "search", query: "" });
    expect(search.status).toBe(200);
    expect((await search.json()).op).toBe("search");

    const spot = await post({
      workspaceId: "ws-1",
      op: "suggest_spot",
      blocks: [],
      topic: "bases",
    });
    expect(spot.status).toBe(200);
    expect((await spot.json()).op).toBe("suggest_spot");

    const overview = await post({
      workspaceId: "ws-1",
      op: "overview",
      blocks: [],
    });
    expect(overview.status).toBe(200);
    expect((await overview.json()).op).toBe("overview");

    const area = await post({
      workspaceId: "ws-1",
      op: "area_summary",
      blocks: [],
      polygon: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
    });
    expect(area.status).toBe(200);
    expect((await area.json()).op).toBe("area_summary");
  });

  it("drops the explore-block drawer from the authoring recommendation", () => {
    const doc = read("docs/workspace-authoring-id-lxd-recommendation.md");
    expect(doc).not.toContain("explore_block");
    expect(doc).not.toContain("map_explore_block");
    expect(doc).not.toContain("Explore-block drawer");
  });

  it("keeps the empty-cell marker and drops the identity badge helper", () => {
    expect(resolveEmptyCellMarker({ canEdit: true, learnerMode: false })).toBe("plus");
    expect(resolveEmptyCellMarker({ canEdit: false, learnerMode: true })).toBe("none");
    expect(
      resolveEmptyCellMarker({
        canEdit: true,
        learnerMode: false,
        isUnusable: true,
      }),
    ).toBe("none");
    expect(
      resolveEmptyCellMarker({
        canEdit: true,
        learnerMode: false,
        isGeneratorSpark: true,
      }),
    ).toBe("none");

    const badges = read("lib/map-tile-badges.ts");
    const world = read("components/block-skill-grid/map-world-layer.tsx");
    expect(badges).not.toContain("resolveMapOccupiedTileBadges");
    expect(world).not.toContain("resolveMapOccupiedTileBadges");
    expect(world).not.toContain("practiceOptionsIconKeys");
    expect(world).not.toContain("creatorEffectIconKeys");
    expect(world).toContain("resolveEmptyCellMarker");
  });
});
