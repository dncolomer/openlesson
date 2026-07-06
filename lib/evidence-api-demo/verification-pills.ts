import { CUSTOM_DEMO_ID } from "./custom-demo";
import type { EvidenceApiDemoDefinition } from "./demo-definition";
import { isAppDemo, isExternalDemo, isGameDemo } from "./game-tips";

export type DemoVerificationPill = "Evidence API" | "TAP" | "ILE";

export const ALL_DEMO_VERIFICATION_PILLS: DemoVerificationPill[] = [
  "Evidence API",
  "TAP",
  "ILE",
];

export function getDemoVerificationPills(demo: EvidenceApiDemoDefinition): DemoVerificationPill[] {
  if (demo.id === CUSTOM_DEMO_ID) return ALL_DEMO_VERIFICATION_PILLS;
  if (isGameDemo(demo)) return ["Evidence API"];
  if (isAppDemo(demo) || isExternalDemo(demo)) return ["Evidence API", "TAP"];
  return ["Evidence API"];
}