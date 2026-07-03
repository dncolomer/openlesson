import { CUSTOM_DEMO_ID, parseCustomDefinitionFromBody } from "./custom-demo";
import { resolveDemoId } from "./demos";
import type { EvidenceApiDemoDefinition } from "./demo-definition";

export function parseDemoIdFromBody(body: Record<string, unknown>): string | undefined {
  return typeof body.demoId === "string" && body.demoId.trim() ? body.demoId.trim() : undefined;
}

export function getDemoFromBody(body: Record<string, unknown>): EvidenceApiDemoDefinition {
  const demoId = parseDemoIdFromBody(body);
  if (demoId === CUSTOM_DEMO_ID) {
    const custom = parseCustomDefinitionFromBody(body);
    if (custom) return custom;
  }
  return resolveDemoId(demoId);
}