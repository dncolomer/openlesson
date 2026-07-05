import type { EvidenceApiDemoDefinition } from "../demo-definition";
import { gridworksDemo } from "./gridworks";
import { nexusfrontDemo } from "./nexusfront";

export const EVIDENCE_API_DEMOS: EvidenceApiDemoDefinition[] = [nexusfrontDemo, gridworksDemo];

export const DEFAULT_DEMO_ID = nexusfrontDemo.id;

export function getDemoById(demoId: string): EvidenceApiDemoDefinition | undefined {
  return EVIDENCE_API_DEMOS.find((demo) => demo.id === demoId);
}

export function resolveDemoId(demoId: string | null | undefined): EvidenceApiDemoDefinition {
  return getDemoById(demoId ?? "") ?? nexusfrontDemo;
}

export { gridworksDemo, nexusfrontDemo };