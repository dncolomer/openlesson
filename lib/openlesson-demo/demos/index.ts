import type { ProofOfWorkApiDemoDefinition } from "../demo-definition";
import { orbitDemo } from "./orbit";

export const PROOF_OF_WORK_API_DEMOS: ProofOfWorkApiDemoDefinition[] = [orbitDemo];

export const DEFAULT_DEMO_ID = orbitDemo.id;

export function getDemoById(demoId: string): ProofOfWorkApiDemoDefinition | undefined {
  return PROOF_OF_WORK_API_DEMOS.find((demo) => demo.id === demoId);
}

export function resolveDemoId(demoId: string | null | undefined): ProofOfWorkApiDemoDefinition {
  return getDemoById(demoId ?? "") ?? orbitDemo;
}

export { orbitDemo };