import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = process.cwd();

describe("guest subjects + isolation", () => {
  it("guest PoW upload does not fall back user_id to workspace owner", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "lib/pow-api/upload-workspace-proof-of-work.ts"),
      "utf8",
    );
    expect(src).toContain("participantGuestUserId ? null : participantUserId || billingUserId");
    expect(src).not.toMatch(/user_id:\s*participantUserId\s*\|\|\s*billingUserId\s*,/);
  });

  it("owner-scoped performance context excludes guest_user_id rows", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/pow-api/performance-context.ts"), "utf8");
    expect(src).toContain('.is("guest_user_id", null)');
    expect(src).toContain('.eq("guest_user_id", evidenceFilter.guestUserId)');
  });

  it("Knowledge subjects come from flow embeddings, not Snapshot tables", () => {
    expect(fs.existsSync(path.join(ROOT, "app/api/workspace/knowledge-config/route.ts"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(ROOT, "lib/pow-api/workspace-snapshot-subjects.ts")),
    ).toBe(false);

    const view = fs.readFileSync(path.join(ROOT, "lib/flow-embedding-view.ts"), "utf8");
    expect(view).toContain("subjectsFromFlowEmbeddings");
    expect(view).toContain("guest_user_id");

    const hook = fs.readFileSync(
      path.join(ROOT, "components/knowledge-panel/use-knowledge-embeddings.ts"),
      "utf8",
    );
    expect(hook).toContain("subjectsFromFlowEmbeddings");
    expect(hook).toContain("listWorkspaceFlowEmbeddings");
  });

  it("Knowledge panel does not advertise Snapshot", () => {
    const panel = readKnowledgePanelSurface();
    expect(panel).not.toMatch(/Generate an LWM Snapshot|data-lwm-snapshot-modal/i);
  });
});
