import type { EvidenceApiDemoDefinition } from "../demo-definition";
import { orbitDemo } from "./orbit";

export const EVIDENCE_API_DEMOS: EvidenceApiDemoDefinition[] = [orbitDemo];

export const DEFAULT_DEMO_ID = orbitDemo.id;

export function getDemoById(demoId: string): EvidenceApiDemoDefinition | undefined {
  return EVIDENCE_API_DEMOS.find((demo) => demo.id === demoId);
}

export function resolveDemoId(demoId: string | null | undefined): EvidenceApiDemoDefinition {
  return getDemoById(demoId ?? "") ?? orbitDemo;
}

export { orbitDemo };