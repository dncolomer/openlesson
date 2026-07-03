import type { EvidenceApiDemoDefinition } from "../demo-definition";
import { flowstackDemo } from "./flowstack";
import { helphiveDemo } from "./helphive";
import { ledgerlineDemo } from "./ledgerline";
import { metricpulseDemo } from "./metricpulse";

export const EVIDENCE_API_DEMOS: EvidenceApiDemoDefinition[] = [
  flowstackDemo,
  ledgerlineDemo,
  metricpulseDemo,
  helphiveDemo,
];

export const DEFAULT_DEMO_ID = flowstackDemo.id;

export function getDemoById(demoId: string): EvidenceApiDemoDefinition | undefined {
  return EVIDENCE_API_DEMOS.find((demo) => demo.id === demoId);
}

export function resolveDemoId(demoId: string | null | undefined): EvidenceApiDemoDefinition {
  return getDemoById(demoId ?? "") ?? flowstackDemo;
}

export { flowstackDemo, ledgerlineDemo, metricpulseDemo, helphiveDemo };