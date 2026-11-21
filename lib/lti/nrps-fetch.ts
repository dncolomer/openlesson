import { LTI_NRPS_SCOPE } from "@/lib/lti/claims";
import {
  LTI_NRPS_ACCEPT,
  nrpsMembershipsUrl,
  nrpsNamesForIdentities,
  parseNrpsMembers,
  seedLtiRosterNames,
  type LtiNrpsMember,
} from "@/lib/lti/nrps";
import { requestLtiPlatformToken } from "@/lib/lti/platform-token";
import type { LtiLaunchSession } from "@/lib/lti/session";

export async function fetchLtiNrpsMembers(
  session: LtiLaunchSession,
): Promise<LtiNrpsMember[]> {
  const url = nrpsMembershipsUrl(session.nrps);
  if (!url) return [];
  const access = await requestLtiPlatformToken({
    platformId: session.platformId,
    scopes: [LTI_NRPS_SCOPE],
  });
  if (!access) return [];
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${access}`,
      Accept: LTI_NRPS_ACCEPT,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`NRPS ${response.status}`);
  }
  return parseNrpsMembers(payload);
}

export async function ltiRosterNamesForIdentities(input: {
  session: LtiLaunchSession;
  identities: readonly string[];
}): Promise<Record<string, string>> {
  const names = seedLtiRosterNames(input.session);
  try {
    const members = await fetchLtiNrpsMembers(input.session);
    return {
      ...names,
      ...nrpsNamesForIdentities({
        members,
        identities: input.identities,
        issuer: input.session.issuer,
      }),
    };
  } catch (error) {
    console.error(
      "[lti-nrps] memberships failed",
      error instanceof Error ? error.message : error,
    );
    return names;
  }
}
