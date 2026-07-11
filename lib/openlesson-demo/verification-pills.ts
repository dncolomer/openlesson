import type { ProofOfWorkApiDemoDefinition } from "./demo-definition";
import { isAppDemo, isExternalDemo, isGameDemo } from "./game-tips";

export type DemoVerificationPill = "Proof-of-Work API" | "TAP" | "ILE";

export const ALL_DEMO_VERIFICATION_PILLS: DemoVerificationPill[] = [
  "Proof-of-Work API",
  "TAP",
  "ILE",
];

export function getDemoVerificationPills(demo: ProofOfWorkApiDemoDefinition): DemoVerificationPill[] {
  if (isGameDemo(demo)) return ["Proof-of-Work API"];
  if (isAppDemo(demo) || isExternalDemo(demo)) return ["Proof-of-Work API", "TAP"];
  return ["Proof-of-Work API"];
}