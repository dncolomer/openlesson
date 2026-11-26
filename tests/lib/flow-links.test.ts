import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFlowLink,
  flowLinkDefinesReference,
  flowLinkLabelFromMetadata,
  flowLinkLabelKind,
  flowLinkPublicPath,
  getFlowLinkByToken,
  listFlowLinksForFlow,
  normalizeFlowLinkLabel,
  resetFlowLinksStore,
  withFlowLinkMetadata,
} from "@/lib/flow-links";
import { persistCompletedFlowEmbedding, resetFlowEmbeddingStore } from "@/lib/flow-embedding-store";
import {
  getVerificationFlowByToken,
  resetVerificationFlowRepository,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";
import { knowledgeRegionPointKind } from "@/lib/knowledge-region-figure";

const root = join(__dirname, "../..");

describe("flow link labels", () => {
  beforeEach(() => {
    resetFlowLinksStore("memory");
    resetVerificationFlowRepository();
    resetFlowEmbeddingStore("memory");
  });

  it("treats empty and test as Test, reference and custom as Reference", () => {
    expect(normalizeFlowLinkLabel("  ")).toBeNull();
    expect(normalizeFlowLinkLabel("  alumni  cohort ")).toBe("alumni cohort");
    expect(flowLinkLabelKind(null)).toBe("test");
    expect(flowLinkLabelKind("test")).toBe("test");
    expect(flowLinkLabelKind("Test")).toBe("test");
    expect(flowLinkLabelKind("reference")).toBe("reference");
    expect(flowLinkLabelKind("alumni")).toBe("custom");
    expect(flowLinkDefinesReference(null)).toBe(false);
    expect(flowLinkDefinesReference("test")).toBe(false);
    expect(flowLinkDefinesReference("reference")).toBe(true);
    expect(flowLinkDefinesReference("alumni")).toBe(true);
    expect(flowLinkLabelKind("ai-use")).toBe("ai_use");
    expect(flowLinkDefinesReference("ai-use")).toBe(false);
    expect(
      knowledgeRegionPointKind({
        origin: "simulated",
        identity: "AI · Claude Sonnet · high",
        linkLabel: "ai-use",
      }),
    ).toBe("ai_use");
    expect(flowLinkPublicPath("verification", "abc")).toBe("/v/abc");
    expect(flowLinkPublicPath("solve", "abc")).toBe("/s/abc");
    expect(
      knowledgeRegionPointKind({ origin: "human", identity: "K4M9Q2" }),
    ).toBe("analysis");
    expect(
      knowledgeRegionPointKind({ origin: "human", identity: "K4M9Q2", linkLabel: "test" }),
    ).toBe("analysis");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "K4M9Q2",
        linkLabel: "reference",
      }),
    ).toBe("cohort");
    expect(
      knowledgeRegionPointKind({ origin: "human", identity: "K4M9Q2", linkLabel: "alumni" }),
    ).toBe("cohort");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "ada",
        subjects: [{ label: "ada" }],
      }),
    ).toBe("cohort");
    expect(
      knowledgeRegionPointKind({
        origin: "human",
        identity: "ada",
        linkLabel: "test",
        subjects: [{ label: "ada" }],
      }),
    ).toBe("analysis");
  });

  it("resolves an extra labeled token to the flow and stamps embeddings", async () => {
    const created = await runVerificationCommand({
      type: "create",
      ownerUserId: "owner-1",
      topic: "Bayes",
      publicToken: "vbayes-default",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;
    const link = await createFlowLink({
      ownerUserId: "owner-1",
      flowKind: "verification",
      flowId: created.flow.id,
      label: "reference",
      publicToken: "vbayes-reference",
    });
    expect(link.label).toBe("reference");
    expect(await getVerificationFlowByToken("vbayes-default")).toMatchObject({
      id: created.flow.id,
    });
    expect(await getVerificationFlowByToken("vbayes-reference")).toMatchObject({
      id: created.flow.id,
    });
    expect(await getFlowLinkByToken("vbayes-default")).toBeNull();
    expect((await getFlowLinkByToken("vbayes-reference"))?.id).toBe(link.id);
    const listed = await listFlowLinksForFlow({
      ownerUserId: "owner-1",
      flowKind: "verification",
      flowId: created.flow.id,
    });
    expect(listed.map((row) => row.publicToken)).toEqual(["vbayes-reference"]);
    const stored = await persistCompletedFlowEmbedding({
      ownerUserId: "owner-1",
      flowKind: "verify",
      flowId: created.flow.id,
      identity: "K4M9Q2",
      source: "runner",
      linkLabel: link.label,
      pow: [{ type: "speech", tool_name: "runner", timestamp_ms: 1, payload: "path" }],
    });
    expect(stored.link_label).toBe("reference");
    expect(
      withFlowLinkMetadata({ exactProblemOnCanvas: true }, link),
    ).toMatchObject({
      exactProblemOnCanvas: true,
      flowLinkLabel: "reference",
      flowLinkId: link.id,
    });
    expect(flowLinkLabelFromMetadata({ flowLinkLabel: "reference" })).toBe("reference");
  });

  it("keeps dashboard add/remove link actions and the flow-page UI", () => {
    const route = readFileSync(join(root, "app/api/dashboard/flows/[id]/route.ts"), "utf8");
    expect(route).toContain('action === "addLink"');
    expect(route).toContain('action === "removeLink"');
    expect(route).toContain("listFlowLinksForFlow");
    const page = readFileSync(join(root, "components/product-flow/product-flow-page.tsx"), "utf8");
    expect(page).toContain("FlowPublicLinks");
    const chrome = readFileSync(
      join(root, "components/product-flow/copy-flow-url-button.tsx"),
      "utf8",
    );
    expect(chrome).toContain("data-flow-links");
    expect(chrome).toContain("data-flow-link-add");
    expect(chrome).toContain("Add link");
    const migration = readFileSync(
      join(root, "supabase/migrations/20261121200000_flow_links_and_embedding_label.sql"),
      "utf8",
    );
    expect(migration).toContain("create table if not exists public.flow_links");
    expect(migration).toContain("add column if not exists link_label text");
  });
});
