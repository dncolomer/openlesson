/**
 * Gating: verification-only Protocols, Protocol Challenge, no Solve/Calibration
 * products, no insight-craft routes, verification embeddings, marketing name.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptProtocolPublish,
  DASHBOARD_PROTOCOLS_PATH,
  emptyProtocolDraft,
  parseProductFlowKind,
  productFlowNewPath,
  productFlowPagePath,
  PROTOCOL_PRODUCT_NAME,
  rejectedProtocolKind,
} from "@/lib/product-flow";
import {
  FLOW_API_BASE,
  PROTOCOL_API_BASE,
  PUBLIC_AGENT_API_FAMILIES,
} from "@/lib/api/agent-api-paths";
import { AGENT_TOOL_SURFACE, agentToolNames } from "@/lib/pow-api/agent-tool-surface";
import { presentAgentProtocol } from "@/lib/pow-api/agent-flow-management";
import {
  EMBEDDING_FAMILIES,
  EMBEDDING_MODEL_IDS,
  VERIFY_EMBEDDING_MODEL_ID,
} from "@/lib/core-data-model";
import { homepageCopyText, PLATFORM_HERO, PLATFORM_PRODUCT_LIST } from "@/lib/marketing/platform";
import { MAIN_NAV_PRODUCT_LINKS } from "@/lib/marketing/nav";
import { USE_CASES_COPY } from "@/lib/marketing/use-cases";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";
import { CREDIT_PACK_CARDS } from "@/lib/pricing/modules";
import { FLOW_SESSION_KINDS } from "@/lib/credits/constants";
import { WORKSPACE_ONTOLOGY, WORKSPACE_ONTOLOGY_COMPACT } from "@/lib/prompt-kernel/ontology";
import { SCIENCE_LEARNING_MODEL_COPY } from "@/lib/science/learning-model-copy";
import { unifiedSessionInsertPayload } from "@/lib/unified-sessions";
import { presentDashboardRecentFlow } from "@/lib/dashboard-home";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("knowledge verification protocols only", () => {
  it("rejects retired kinds and has no kind picker", () => {
    expect(parseProductFlowKind("solve")).toBeNull();
    expect(parseProductFlowKind("calibration")).toBeNull();
    expect(parseProductFlowKind("verification")).toBeNull();
    expect(rejectedProtocolKind("solve")).toBe(true);
    expect(rejectedProtocolKind("calibration")).toBe(true);
    expect(productFlowNewPath()).toBe("/protocols/new");
    expect(productFlowPagePath("p1")).toBe("/protocols/p1");
    expect(DASHBOARD_PROTOCOLS_PATH).toBe("/api/dashboard/protocols");
    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    expect(wizard).not.toMatch(/data-flow-kind/);
    expect(wizard).toContain("PROTOCOL_CHALLENGE_LABEL");
    expect(wizard).toContain("PROTOCOL_LABEL");
    expect(wizard).not.toContain("PRODUCT_FLOW_KINDS");
  });

  it("create/present path uses Protocol Challenge and no kind enum", () => {
    const draft = {
      ...emptyProtocolDraft(),
      name: "Bayes protocol",
      challenge: "State Bayes rule on a medical test",
    };
    const accepted = acceptProtocolPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.challenge).toBe("State Bayes rule on a medical test");
    expect(accepted).not.toHaveProperty("kind");

    const presented = presentAgentProtocol({
      id: "proto-1",
      name: accepted.name,
      topic: accepted.challenge,
      questions: accepted.questions,
      artifacts: accepted.artifacts,
      durationMinutes: accepted.durationMinutes,
      actionCatalog: 4,
      exactProblemOnCanvas: accepted.exactProblemOnCanvas,
      generateProblemOnOpen: accepted.generateProblemOnOpen,
      publicToken: "tok",
      workspaceId: "",
      ownerUserId: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(presented.challenge).toBe("State Bayes rule on a medical test");
    expect(presented).not.toHaveProperty("kind");
    expect(presented.name).toBe("Bayes protocol");
    if (process.env.PROTOCOL_API_OUT) {
      writeFileSync(
        process.env.PROTOCOL_API_OUT,
        `${JSON.stringify(
          {
            rejectedSolve: rejectedProtocolKind("solve"),
            rejectedCalibration: rejectedProtocolKind("calibration"),
            accepted,
            presented,
            presentedKeys: Object.keys(presented),
          },
          null,
          2,
        )}\n`,
      );
    }
  });

  it("public agent REST/MCP advertise protocols not multi-kind flows", () => {
    expect(PROTOCOL_API_BASE).toBe("/api/v3/protocols");
    expect(FLOW_API_BASE).toBe("/api/v3/protocols");
    expect([...PUBLIC_AGENT_API_FAMILIES]).toEqual(["protocol", "knowledge_region"]);
    expect(agentToolNames()).toEqual(
      expect.arrayContaining([
        "list_protocols",
        "create_protocol",
        "get_protocol",
        "update_protocol",
        "delete_protocol",
      ]),
    );
    expect(agentToolNames()).not.toEqual(expect.arrayContaining(["create_flow", "list_flows"]));
    expect(existsSync(join(ROOT, "app/api/v3/protocols/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/v3/flows/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/api/dashboard/protocols/route.ts"))).toBe(true);
    const create = AGENT_TOOL_SURFACE.find((t) => t.name === "create_protocol");
    expect(create?.rest.path).toBe("/api/v3/protocols");
    const route = read("app/api/v3/protocols/route.ts");
    expect(route).toContain("createAgentProtocol");
    expect(route).toContain("rejectedProtocolKind");
  });

  it("keeps verification embeddings only", () => {
    expect([...EMBEDDING_FAMILIES]).toEqual(["verify"]);
    expect([...EMBEDDING_MODEL_IDS]).toEqual([VERIFY_EMBEDDING_MODEL_ID]);
    const migration = read("supabase/migrations/20261126120000_protocols_only.sql");
    expect(migration).toContain("DROP TABLE IF EXISTS public.solve_flows");
    expect(migration).toContain("DROP TABLE IF EXISTS public.calibrate_flows");
    expect(migration).toContain("DROP TABLE IF EXISTS public.insights");
    expect(migration).toContain("DROP COLUMN IF EXISTS product");
    expect(migration).toContain("solve-flowcfg-v1-d96");
    expect(read("lib/pow-api/custom-verification-model-crud.ts")).not.toContain(
      "learn-flowcfg-v1-d96",
    );
    expect(read("lib/flow-embedding-client.ts")).toContain('flowKind: "verify"');
    expect(existsSync(join(ROOT, "app/play/calibrate/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/calibrate/session/[token]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/VerificationFlowsPanel.tsx"))).toBe(false);
    expect(read("lib/guest-link-access.ts")).not.toContain('return "/calibrate/session"');
    expect(read("lib/session-pow-api-paths.ts")).not.toContain("/api/calibrate/session");
    expect(read("lib/session-pow-api-paths.ts")).not.toContain("/api/solve/session");
  });

  it("deletes insight-craft routes and helpers", () => {
    expect(existsSync(join(ROOT, "app/api/insights/route.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "app/insights/[id]/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/insights.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/learn-turn-insights.ts"))).toBe(false);
    const prompt = read("components/excalidraw-canvas/canvas-prompt-bar.tsx");
    expect(prompt).not.toContain("IleCanvasCraftInsightForm");
  });

  it("marketing sells Embeddable Knowledge Verification Protocols", () => {
    expect(PROTOCOL_PRODUCT_NAME).toBe("Embeddable Knowledge Verification Protocols");
    expect(PLATFORM_HERO.h1).toContain("Embeddable Knowledge Verification Protocols");
    expect(homepageCopyText()).toContain("Embeddable Knowledge Verification Protocols");
    expect(homepageCopyText().toLowerCase()).not.toContain("solve protocol");
    expect(homepageCopyText().toLowerCase()).not.toContain("map protocol");
    expect(MAIN_NAV_PRODUCT_LINKS).toHaveLength(1);
    expect(MAIN_NAV_PRODUCT_LINKS[0]?.label).toContain("Knowledge Verification");
    expect(PLATFORM_PRODUCT_LIST).toHaveLength(1);
    expect(USE_CASES_COPY.lead.join(" ")).toContain("Embeddable Knowledge Verification Protocols");
    expect(USE_CASES_COPY.ideas.some((idea) => idea.title === "The Protocol Challenge")).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "app/solve-protocols/page.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "app/mapping-protocols/page.tsx"))).toBe(false);
    const readme = read("README.md");
    expect(readme).toContain("Embeddable Knowledge Verification Protocols");
    expect(readme).toContain("The Protocol Challenge");
    expect(readme).not.toContain("Calibrate / Learn / Verify practice links");
    expect(readme).not.toContain("Verification Flows");
    const authoring = read("docs/course-authoring-tools-report.md");
    expect(authoring).toContain("Embeddable Knowledge Verification Protocols");
    expect(authoring).not.toContain("Create and manage calibration flows");
    expect(authoring).not.toContain("Create and manage verification flows");
    expect(authoring).not.toContain("mountsCalibrationFlowsPanel");
    expect(read("docs/learn-pow-resources.md")).not.toContain("Crafting insights stays on the work canvas");
  });

  it("pricing, ontology, science, and dashboard payloads are protocol-only", () => {
    expect(UNIFIED_PRICING_COPY.lead).toContain("Embeddable Knowledge Verification Protocols");
    expect(UNIFIED_PRICING_COPY.lead).not.toMatch(/Calibrate|Solve/);
    expect(UNIFIED_PRICING_COPY.free.body).toContain("Protocols");
    expect(CREDIT_PACK_CARDS.every((card) => card.features.join(" ").includes("protocol"))).toBe(
      true,
    );
    const skuSrc = read("lib/pricing/modules.ts");
    expect(skuSrc).not.toContain("Calibration flows");
    expect(skuSrc).not.toContain("Verification flows");
    expect([...FLOW_SESSION_KINDS]).toEqual(["learn", "verify"]);
    expect(WORKSPACE_ONTOLOGY).toContain("Protocols");
    expect(WORKSPACE_ONTOLOGY).toContain("The Protocol Challenge");
    expect(WORKSPACE_ONTOLOGY).not.toContain("Solve, Calibration, and Verification flows");
    expect(WORKSPACE_ONTOLOGY).not.toContain("Insights form when Infer crafts");
    expect(WORKSPACE_ONTOLOGY_COMPACT).not.toContain("Solve, Calibration");
    expect(SCIENCE_LEARNING_MODEL_COPY.pipelinesTitle).toBe("Learn and Verify");
    expect(SCIENCE_LEARNING_MODEL_COPY.pipelinesTitle).not.toContain("Calibrate");
    const docs = read("docs/core-data-model.md");
    expect(docs).toContain("Embeddable Knowledge Verification Protocols");
    expect(docs).not.toContain("two product flows");
    const listRoute = read("app/api/dashboard/protocols/route.ts");
    expect(listRoute).toContain("protocols: listed");
    expect(listRoute).not.toContain("flows: listed");
    expect(listRoute).not.toContain("flow: created.flow");
    expect(listRoute).not.toContain("flowPath:");
    const oneRoute = read("app/api/dashboard/protocols/[id]/route.ts");
    expect(oneRoute).not.toContain("flow: loaded.flow");
    expect(oneRoute).not.toContain("flowPath:");
    const presented = presentDashboardRecentFlow({
      id: "p1",
      name: "Bayes",
      challenge: "State Bayes rule",
    });
    expect(presented?.protocolPath).toBe("/protocols/p1");
    expect(presented).not.toHaveProperty("flowPath");
    const payload = unifiedSessionInsertPayload({
      kind: "verify",
      user_id: "u1",
    });
    expect(payload.kind).toBe("verify");
    expect(payload).not.toHaveProperty("calibrate_flow_id");
    const sim = read("app/api/dashboard/region-simulation/route.ts");
    expect(sim).toContain("protocols: listed");
    expect(sim).not.toContain("flows: listed");
    expect(sim).toContain("protocolIdsFromRequestBody");
    expect(sim).not.toContain("body.flowIds");
    const ltiSim = read("app/api/lti/region-simulation/route.ts");
    expect(ltiSim).toContain("protocols: listed");
    expect(ltiSim).not.toContain("flows: listed");
    const catalog = read("app/api/lti/catalog/route.ts");
    expect(catalog).toContain("protocols,");
    expect(catalog).toContain('type: "protocol"');
    expect(catalog).not.toContain("flows:");
    const launch = read("app/lti/launch/route.ts");
    expect(launch).toContain("protocolPublicPathForSession");
    expect(launch).toContain("protocolPath");
    expect(launch).not.toContain("flowPublicPathForSession");
    expect(read("lib/sales/platform-pitch-deck.ts")).not.toContain("Three flows.");
  });
});
