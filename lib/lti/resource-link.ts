import { parseCustomClaim, textClaim } from "@/lib/lti/claims";
import type { ProductFlowKind } from "@/lib/product-flow";

export type LtiResourceTarget =
  | { kind: "flow"; flowToken: string; flowKind?: ProductFlowKind }
  | { kind: "region"; regionId: string }
  | { kind: "create_region" };

const FLOW_PATH = /^\/(s|v|c)\/([^/?#]+)/i;

function kindFromPrefix(prefix: string): ProductFlowKind | undefined {
  const key = prefix.toLowerCase();
  if (key === "s") return "solve";
  if (key === "v") return "verification";
  if (key === "c") return "calibration";
  return undefined;
}

export function customValue(
  custom: Record<string, string>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const direct = custom[key];
    if (direct) return direct;
    const underscored = custom[key.replace(/-/g, "_")];
    if (underscored) return underscored;
  }
  return "";
}

export function flowTokenFromTargetLinkUri(targetLinkUri: string): {
  token: string;
  flowKind?: ProductFlowKind;
} | null {
  try {
    const url = new URL(targetLinkUri);
    const match = FLOW_PATH.exec(url.pathname);
    if (!match) return null;
    const token = decodeURIComponent(match[2] || "").trim();
    if (!token) return null;
    return { token, flowKind: kindFromPrefix(match[1] || "") };
  } catch {
    const match = FLOW_PATH.exec(targetLinkUri);
    if (!match) return null;
    const token = decodeURIComponent(match[2] || "").trim();
    if (!token) return null;
    return { token, flowKind: kindFromPrefix(match[1] || "") };
  }
}

export function ltiResourceTarget(input: {
  custom?: unknown;
  targetLinkUri?: unknown;
}): LtiResourceTarget | null {
  const custom = parseCustomClaim(input.custom);
  const action = customValue(custom, "action", "lti_action").toLowerCase();
  if (action === "create_region" || action === "create-region") {
    return { kind: "create_region" };
  }
  const regionId = customValue(custom, "region_id", "regionId");
  if (regionId) return { kind: "region", regionId };
  const flowToken = customValue(custom, "flow_token", "flowToken", "public_token");
  if (flowToken) return { kind: "flow", flowToken };
  const fromUri = flowTokenFromTargetLinkUri(textClaim(input.targetLinkUri));
  if (fromUri) return { kind: "flow", flowToken: fromUri.token, flowKind: fromUri.flowKind };
  return null;
}

export function ownerInOrganization(
  ownerUserId: string | null | undefined,
  orgMemberIds: readonly string[],
): boolean {
  const owner = String(ownerUserId || "").trim();
  if (!owner) return false;
  return orgMemberIds.some((id) => String(id || "").trim() === owner);
}
