import { SignJWT } from "jose";
import type { LtiSigningKey } from "@/lib/lti/keys";
import type { LtiAgsEndpoint } from "@/lib/lti/claims";
import {
  LTI_AGS_SCOPE_LINEITEM,
  LTI_AGS_SCOPE_SCORE,
} from "@/lib/lti/claims";
import {
  LTI_AGS_TAG_AVERAGE,
  LTI_AGS_TAG_LATEST,
  LTI_UNSYS_SCORE_MAXIMUM,
  ltiAgsComment,
  ltiAgsGradingProgress,
  type LtiUnsysScoreSet,
} from "@/lib/lti/unsys-score";

export type LtiAgsLineItem = {
  id?: string;
  scoreMaximum: number;
  label: string;
  tag: string;
  resourceId?: string;
  resourceLinkId?: string;
};

export function buildUnsysLineItems(input: {
  flowName: string;
  resourceId?: string;
  resourceLinkId?: string;
}): LtiAgsLineItem[] {
  const resource = {
    resourceId: input.resourceId,
    resourceLinkId: input.resourceLinkId,
  };
  return [
    {
      scoreMaximum: LTI_UNSYS_SCORE_MAXIMUM,
      label: `${input.flowName} · Unsys (latest)`,
      tag: LTI_AGS_TAG_LATEST,
      ...resource,
    },
    {
      scoreMaximum: LTI_UNSYS_SCORE_MAXIMUM,
      label: `${input.flowName} · Unsys (average)`,
      tag: LTI_AGS_TAG_AVERAGE,
      ...resource,
    },
  ];
}

export function buildAgsScore(input: {
  userId: string;
  scoreGiven: number | null;
  comment?: string;
  activityProgress?: "Completed" | "InProgress" | "Initialized";
}): Record<string, unknown> {
  const timestamp = new Date().toISOString();
  const body: Record<string, unknown> = {
    userId: input.userId,
    timestamp,
    activityProgress: input.activityProgress || "Completed",
    gradingProgress: ltiAgsGradingProgress(input.scoreGiven),
  };
  if (input.scoreGiven != null && Number.isFinite(input.scoreGiven)) {
    body.scoreGiven = input.scoreGiven;
    body.scoreMaximum = LTI_UNSYS_SCORE_MAXIMUM;
  }
  if (input.comment) body.comment = input.comment;
  return body;
}

export function agsScoresForUnsys(input: {
  userId: string;
  scores: LtiUnsysScoreSet;
}): { tag: string; body: Record<string, unknown> }[] {
  const comment = ltiAgsComment(input.scores);
  return [
    {
      tag: LTI_AGS_TAG_LATEST,
      body: buildAgsScore({
        userId: input.userId,
        scoreGiven: input.scores.latest,
        comment,
      }),
    },
    {
      tag: LTI_AGS_TAG_AVERAGE,
      body: buildAgsScore({
        userId: input.userId,
        scoreGiven: input.scores.average,
        comment,
      }),
    },
  ];
}

export function lineItemByTag(
  items: readonly { id?: string; tag?: string }[],
  tag: string,
): { id?: string; tag?: string } | null {
  return items.find((item) => item.tag === tag) || null;
}

export async function signAgsClientAssertion(input: {
  tokenUrl: string;
  clientId: string;
  privateKey: LtiSigningKey;
  kid?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: input.clientId,
  })
    .setProtectedHeader({ alg: "RS256", kid: input.kid, typ: "JWT" })
    .setIssuer(input.clientId)
    .setAudience(input.tokenUrl)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(`${now}-${Math.random().toString(36).slice(2)}`)
    .sign(input.privateKey);
}

export function agsTokenRequestBody(assertion: string, scopes?: string[]): URLSearchParams {
  const scope = (scopes?.length
    ? scopes
    : [LTI_AGS_SCOPE_LINEITEM, LTI_AGS_SCOPE_SCORE]
  ).join(" ");
  return new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope,
  });
}

export function agsLineItemsUrl(endpoint: LtiAgsEndpoint | null | undefined): string {
  return String(endpoint?.lineitems || "").trim();
}
