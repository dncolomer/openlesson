import {
  agsLineItemsUrl,
  agsScoresForUnsys,
  buildUnsysLineItems,
  lineItemByTag,
} from "@/lib/lti/ags";
import {
  LTI_AGS_SCOPE_LINEITEM,
  LTI_AGS_SCOPE_SCORE,
} from "@/lib/lti/claims";
import { requestLtiPlatformToken } from "@/lib/lti/platform-token";
import type { LtiLaunchSession } from "@/lib/lti/session";
import type { LtiUnsysScoreSet } from "@/lib/lti/unsys-score";

async function jsonFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AGS ${response.status}`);
  }
  return payload;
}

export async function postLtiUnsysGrades(input: {
  session: LtiLaunchSession;
  flowName: string;
  scores: LtiUnsysScoreSet;
}): Promise<void> {
  const lineitems = agsLineItemsUrl(input.session.ags);
  if (!lineitems) return;
  const access = await requestLtiPlatformToken({
    platformId: input.session.platformId,
    scopes: input.session.ags?.scope?.length
      ? input.session.ags.scope
      : [LTI_AGS_SCOPE_LINEITEM, LTI_AGS_SCOPE_SCORE],
  });
  if (!access) return;
  const headers = {
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/vnd.ims.lis.v2.lineitem+json",
    Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json",
  };
  const listed = await jsonFetch(lineitems, { headers: { Authorization: `Bearer ${access}` } });
  const existing = Array.isArray(listed)
    ? listed
    : Array.isArray((listed as { lineItems?: unknown }).lineItems)
      ? ((listed as { lineItems: unknown[] }).lineItems)
      : [];
  const wanted = buildUnsysLineItems({
    flowName: input.flowName,
    resourceId: input.session.flowToken,
    resourceLinkId: input.session.resourceLinkId,
  });
  const resolved: { tag: string; id: string }[] = [];
  for (const item of wanted) {
    const found = lineItemByTag(existing as { id?: string; tag?: string }[], item.tag);
    if (found?.id) {
      resolved.push({ tag: item.tag, id: String(found.id) });
      continue;
    }
    const created = (await jsonFetch(lineitems, {
      method: "POST",
      headers,
      body: JSON.stringify(item),
    })) as { id?: string };
    if (created?.id) resolved.push({ tag: item.tag, id: String(created.id) });
  }
  const scores = agsScoresForUnsys({
    userId: input.session.sub,
    scores: input.scores,
  });
  for (const score of scores) {
    const line = resolved.find((item) => item.tag === score.tag);
    if (!line) continue;
    const scoreUrl = line.id.replace(/\/*$/, "") + "/scores";
    await fetch(scoreUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/vnd.ims.lis.v1.score+json",
      },
      body: JSON.stringify(score.body),
    }).catch(() => undefined);
  }
}
