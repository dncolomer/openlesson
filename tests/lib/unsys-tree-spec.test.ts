import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { generateFlowUnsysSeedFromBody } from "@/lib/flow-unsys-generate";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
} from "@/lib/product-flow";
import { exampleAuthorUnsysModel } from "@/lib/author-unsys-model";
import {
  parseUnsysSeedSpec,
  unsysSeedFromRequestBody,
} from "@/lib/unsys-tree-spec";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/evidence-tools";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("generic uncertainty model tree spec", () => {
  it("keeps the canonical { model } seed", () => {
    const seed = { model: exampleAuthorUnsysModel("Decode") };
    const parsed = parseFlowUnsysSeed(seed);
    expect(parsed?.model.rootId).toBe(seed.model.rootId);
    expect(parseFlowUnsysSeed(JSON.stringify(seed))?.model.rootId).toBe(seed.model.rootId);
  });

  it("hydrates nested children with weights", () => {
    const spec = {
      title: "Kernel of T",
      children: [
        { name: "Null space", weight: 12 },
        {
          label: "Rank-nullity",
          weight: 8,
          children: [{ title: "Dimension count", weight: 5 }],
        },
      ],
    };
    const parsed = parseUnsysSeedSpec(spec);
    expect(parsed).toBeTruthy();
    const root = parsed!.model.branches.find((row) => row.id === parsed!.model.rootId);
    expect(root?.title).toContain("Kernel");
    const nullSpace = parsed!.model.branches.find((row) => row.title === "Null space");
    expect(nullSpace).toBeTruthy();
    expect(root?.edges.some((edge) => edge.toId === nullSpace?.id && edge.price === 12)).toBe(
      true,
    );
    const rank = parsed!.model.branches.find((row) => row.title === "Rank-nullity");
    expect(root?.edges.some((edge) => edge.toId === rank?.id && edge.price === 8)).toBe(true);
    const dim = parsed!.model.branches.find((row) => row.title === "Dimension count");
    expect(rank?.edges.some((edge) => edge.toId === dim?.id && edge.price === 5)).toBe(true);
  });

  it("hydrates nodes + edges with weight", () => {
    const spec = {
      nodes: [
        { id: "root", title: "Kernel of T" },
        { id: "null", label: "Null space" },
        { id: "rank", name: "Rank-nullity" },
      ],
      edges: [
        { from: "root", to: "null", weight: 12 },
        { source: "root", target: "rank", price: 8 },
      ],
    };
    const parsed = parseFlowUnsysSeed(spec);
    expect(parsed?.model.rootId).toBe("root");
    expect(parsed?.model.branches).toHaveLength(3);
    const root = parsed!.model.branches.find((row) => row.id === "root");
    expect(root?.edges).toEqual(
      expect.arrayContaining([
        { toId: "null", price: 12 },
        { toId: "rank", price: 8 },
      ]),
    );
  });

  it("hydrates parentId on nodes and JSON strings", () => {
    const spec = {
      nodes: [
        { id: "root", title: "Start" },
        { id: "a", title: "Branch A", parentId: "root", weight: 7 },
      ],
    };
    const parsed = parseFlowUnsysSeed(JSON.stringify({ tree: spec }));
    expect(parsed?.model.rootId).toBe("root");
    const root = parsed!.model.branches.find((row) => row.id === "root");
    expect(root?.edges).toEqual([{ toId: "a", price: 7 }]);
  });

  it("reads uncertainty_model on the request body and publishes it", async () => {
    const spec = {
      nodes: [
        { id: "root", title: "Custom field" },
        { id: "s1", title: "State one" },
      ],
      edges: [{ from: "root", to: "s1", weight: 15 }],
    };
    expect(unsysSeedFromRequestBody({ uncertainty_model: spec })).toEqual(spec);
    const fromBody = await generateFlowUnsysSeedFromBody({
      kind: "solve",
      topic: "Custom field",
      uncertainty_model: spec,
    });
    expect(fromBody?.model.branches.some((row) => row.title === "State one")).toBe(true);
    const accepted = acceptProductFlowPublish({
      ...emptyProductFlowDraft("solve"),
      name: "Custom field flow",
      topic: "Custom field",
      answersModelSeed: parseFlowUnsysSeed(spec),
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.answersModelSeed?.model.branches.some((row) => row.id === "s1")).toBe(true);
    expect(
      accepted.answersModelSeed?.model.branches
        .find((row) => row.id === "root")
        ?.edges.some((edge) => edge.toId === "s1" && edge.price === 15),
    ).toBe(true);
  });

  it("MCP create_flow documents a custom tree spec", () => {
    const create = MCP_EVIDENCE_TOOLS.find((tool) => tool.name === "create_flow");
    const properties = create?.inputSchema.properties ?? {};
    expect(properties).toHaveProperty("answers_model_seed");
    expect(properties).toHaveProperty("uncertainty_model");
    const seedDoc = JSON.stringify(properties.answers_model_seed || {});
    expect(seedDoc).toContain("nodes");
    expect(seedDoc).toContain("weight");
    const dashboard = read("app/api/dashboard/flows/route.ts");
    expect(dashboard).toContain("unsysSeedFromRequestBody");
    const agent = read("lib/pow-api/agent-flow-management.ts");
    expect(agent).toContain("requestHasUnsysSeed");
    const helpers = read("lib/pow-api/mcp-tools/helpers.ts");
    expect(helpers).toContain("uncertainty_model");
  });
});
