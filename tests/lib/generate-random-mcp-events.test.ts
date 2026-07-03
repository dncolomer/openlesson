import { describe, expect, it } from "vitest";
import { CUSTOM_DEMO_PICKER } from "@/lib/evidence-api-demo/custom-demo";
import { generateRandomMcpEvents } from "@/lib/evidence-api-demo/generate-random-mcp-events";
import { flowstackDemo } from "@/lib/evidence-api-demo/demos";

describe("generate-random-mcp-events", () => {
  it("generates the requested number of pending events", () => {
    const events = generateRandomMcpEvents(7, flowstackDemo, "plan-1");
    expect(events).toHaveLength(7);
    expect(events.every((event) => event.status === "pending")).toBe(true);
    expect(events[0].sourceData.workspace_id).toBe("plan-1");
  });

  it("clamps invalid counts", () => {
    expect(generateRandomMcpEvents(0, CUSTOM_DEMO_PICKER)).toHaveLength(1);
    expect(generateRandomMcpEvents(99, CUSTOM_DEMO_PICKER)).toHaveLength(24);
  });
});