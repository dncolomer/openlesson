/**
 * LTI platform registrations, OIDC state, launches, and course-region binds.
 * Supabase when the service role exists; otherwise process memory for tests.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { generateLtiToolKey, publicJwksFromKeys, type LtiToolKeyPair } from "@/lib/lti/keys";
import type { LtiOidcState } from "@/lib/lti/oidc";
import type { LtiPlatformRegistration } from "@/lib/lti/platform";
import type { LtiContextRegionBind } from "@/lib/lti/context-region";
import type { LtiLaunchSession } from "@/lib/lti/session";
import { oidcStateIsFresh } from "@/lib/lti/oidc";

const LTI_STORE_GLOBAL = "__openlessonLtiStore";

type LtiStoreMemory = {
  platforms: LtiPlatformRegistration[];
  oidc: Array<LtiOidcState & { platformId: string }>;
  keys: LtiToolKeyPair[];
  launches: LtiLaunchSession[];
  regions: LtiContextRegionBind[];
  backend: "unknown" | "supabase" | "memory";
};

function store(): LtiStoreMemory {
  const scope = globalThis as typeof globalThis & { [LTI_STORE_GLOBAL]?: LtiStoreMemory };
  if (!scope[LTI_STORE_GLOBAL]) {
    scope[LTI_STORE_GLOBAL] = {
      platforms: [],
      oidc: [],
      keys: [],
      launches: [],
      regions: [],
      backend: "unknown",
    };
  }
  return scope[LTI_STORE_GLOBAL];
}

export function resetLtiStore(backend: "unknown" | "memory" = "unknown"): void {
  const next = store();
  next.platforms = [];
  next.oidc = [];
  next.keys = [];
  next.launches = [];
  next.regions = [];
  next.backend = backend;
}

function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function backend(): Promise<"supabase" | "memory"> {
  const mem = store();
  if (mem.backend === "memory") return "memory";
  if (mem.backend === "supabase") return "supabase";
  mem.backend = hasSupabase() ? "supabase" : "memory";
  return mem.backend;
}

function rowToPlatform(row: Record<string, unknown>): LtiPlatformRegistration {
  return {
    id: String(row.id || ""),
    organizationId: String(row.organization_id || ""),
    issuer: String(row.issuer || ""),
    clientId: String(row.client_id || ""),
    authLoginUrl: String(row.auth_login_url || ""),
    authTokenUrl: String(row.auth_token_url || ""),
    keysetUrl: String(row.keyset_url || ""),
    deploymentIds: Array.isArray(row.deployment_ids)
      ? row.deployment_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  };
}

export async function listLtiPlatforms(organizationId: string): Promise<LtiPlatformRegistration[]> {
  const org = String(organizationId || "").trim();
  if (!org) return [];
  if ((await backend()) === "memory") {
    return store().platforms.filter((row) => row.organizationId === org);
  }
  const { data, error } = await createAdminClient()
    .from("lti_platforms")
    .select("*")
    .eq("organization_id", org)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => rowToPlatform(row as Record<string, unknown>));
}

export async function upsertLtiPlatform(
  registration: LtiPlatformRegistration,
): Promise<LtiPlatformRegistration> {
  const id = registration.id || crypto.randomUUID();
  const next = { ...registration, id };
  if ((await backend()) === "memory") {
    store().platforms = [
      next,
      ...store().platforms.filter(
        (row) =>
          row.id !== id &&
          !(row.issuer === next.issuer && row.clientId === next.clientId),
      ),
    ];
    return next;
  }
  const { data, error } = await createAdminClient()
    .from("lti_platforms")
    .upsert({
      id,
      organization_id: next.organizationId,
      issuer: next.issuer,
      client_id: next.clientId,
      auth_login_url: next.authLoginUrl,
      auth_token_url: next.authTokenUrl,
      keyset_url: next.keysetUrl,
      deployment_ids: next.deploymentIds,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToPlatform(data as Record<string, unknown>);
}

export async function getLtiPlatformById(id: string): Promise<LtiPlatformRegistration | null> {
  const platformId = String(id || "").trim();
  if (!platformId) return null;
  if ((await backend()) === "memory") {
    return store().platforms.find((row) => row.id === platformId) || null;
  }
  const { data, error } = await createAdminClient()
    .from("lti_platforms")
    .select("*")
    .eq("id", platformId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPlatform(data as Record<string, unknown>) : null;
}

export async function findLtiPlatform(input: {
  issuer: string;
  clientId: string;
}): Promise<LtiPlatformRegistration | null> {
  const issuer = String(input.issuer || "").trim();
  const clientId = String(input.clientId || "").trim();
  if (!issuer || !clientId) return null;
  if ((await backend()) === "memory") {
    return (
      store().platforms.find((row) => row.issuer === issuer && row.clientId === clientId) ||
      null
    );
  }
  const { data, error } = await createAdminClient()
    .from("lti_platforms")
    .select("*")
    .eq("issuer", issuer)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPlatform(data as Record<string, unknown>) : null;
}

export async function saveOidcState(
  platformId: string,
  state: LtiOidcState,
): Promise<void> {
  if ((await backend()) === "memory") {
    store().oidc = [{ ...state, platformId }, ...store().oidc];
    return;
  }
  const { error } = await createAdminClient().from("lti_oidc_state").insert({
    state: state.state,
    nonce: state.nonce,
    platform_id: platformId,
    iss: state.iss,
    client_id: state.clientId,
    expires_at: state.expiresAt,
  });
  if (error) throw new Error(error.message);
}

export async function consumeOidcState(state: string): Promise<(LtiOidcState & { platformId: string }) | null> {
  const value = String(state || "").trim();
  if (!value) return null;
  if ((await backend()) === "memory") {
    const row = store().oidc.find((item) => item.state === value) || null;
    store().oidc = store().oidc.filter((item) => item.state !== value);
    if (!row || !oidcStateIsFresh(row)) return null;
    return row;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lti_oidc_state")
    .select("*")
    .eq("state", value)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  await admin.from("lti_oidc_state").delete().eq("state", value);
  const row = {
    state: String(data.state),
    nonce: String(data.nonce),
    iss: String(data.iss || ""),
    clientId: String(data.client_id || ""),
    createdAt: String(data.created_at || new Date().toISOString()),
    expiresAt: String(data.expires_at),
    platformId: String(data.platform_id || ""),
  };
  if (!oidcStateIsFresh(row)) return null;
  return row;
}

export async function getOrCreateToolKeys(): Promise<LtiToolKeyPair[]> {
  if ((await backend()) === "memory") {
    if (!store().keys.length) store().keys = [await generateLtiToolKey()];
    return store().keys;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("lti_tool_keys").select("*").eq("active", true);
  if (error) throw new Error(error.message);
  if (data?.length) {
    return data.map((row) => ({
      kid: String(row.kid),
      publicJwk: row.public_jwk as LtiToolKeyPair["publicJwk"],
      privateJwk: row.private_jwk as LtiToolKeyPair["privateJwk"],
    }));
  }
  const generated = await generateLtiToolKey();
  const { error: insertError } = await admin.from("lti_tool_keys").insert({
    kid: generated.kid,
    public_jwk: generated.publicJwk,
    private_jwk: generated.privateJwk,
    active: true,
  });
  if (insertError) throw new Error(insertError.message);
  return [generated];
}

export async function toolPublicJwks() {
  return publicJwksFromKeys(await getOrCreateToolKeys());
}

export async function saveLtiLaunch(session: LtiLaunchSession): Promise<LtiLaunchSession> {
  const next = { ...session, launchId: session.launchId || crypto.randomUUID() };
  if ((await backend()) === "memory") {
    store().launches = [next, ...store().launches.filter((row) => row.launchId !== next.launchId)];
    return next;
  }
  const { error } = await createAdminClient().from("lti_launches").upsert({
    id: next.launchId,
    platform_id: next.platformId,
    deployment_id: next.deploymentId,
    issuer: next.issuer,
    sub: next.sub,
    context_id: next.contextId,
    flow_token: next.flowToken || null,
    flow_kind: next.flowKind || null,
    region_id: next.regionId || null,
    resource_link_id: next.resourceLinkId,
    ags_endpoint: next.ags || null,
    nrps_endpoint: next.nrps || null,
    identity: next.identity,
    instructor: next.instructor,
  });
  if (error) throw new Error(error.message);
  return next;
}

export async function bindContextRegion(bind: LtiContextRegionBind): Promise<LtiContextRegionBind> {
  if ((await backend()) === "memory") {
    store().regions = [
      bind,
      ...store().regions.filter(
        (row) =>
          !(
            row.platformId === bind.platformId &&
            row.deploymentId === bind.deploymentId &&
            row.contextId === bind.contextId
          ),
      ),
    ];
    return bind;
  }
  const { error } = await createAdminClient().from("lti_context_regions").upsert({
    platform_id: bind.platformId,
    deployment_id: bind.deploymentId,
    context_id: bind.contextId,
    knowledge_region_id: bind.knowledgeRegionId,
  });
  if (error) throw new Error(error.message);
  return bind;
}

export async function findContextRegion(input: {
  platformId: string;
  deploymentId: string;
  contextId: string;
}): Promise<LtiContextRegionBind | null> {
  if ((await backend()) === "memory") {
    return (
      store().regions.find(
        (row) =>
          row.platformId === input.platformId &&
          row.deploymentId === input.deploymentId &&
          row.contextId === input.contextId,
      ) || null
    );
  }
  const { data, error } = await createAdminClient()
    .from("lti_context_regions")
    .select("*")
    .eq("platform_id", input.platformId)
    .eq("deployment_id", input.deploymentId)
    .eq("context_id", input.contextId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    platformId: String(data.platform_id),
    deploymentId: String(data.deployment_id),
    contextId: String(data.context_id),
    knowledgeRegionId: String(data.knowledge_region_id),
  };
}

export async function organizationMemberIds(organizationId: string): Promise<string[]> {
  const org = String(organizationId || "").trim();
  if (!org) return [];
  if ((await backend()) === "memory") return [];
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("organization_id", org);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => String(row.id || "").trim()).filter(Boolean);
}

export async function organizationAdminUserId(organizationId: string): Promise<string | null> {
  const org = String(organizationId || "").trim();
  if (!org) return null;
  if ((await backend()) === "memory") return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", org)
    .eq("is_org_admin", true)
    .limit(1)
    .maybeSingle();
  if (data?.id) return String(data.id);
  const { data: anyMember } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", org)
    .limit(1)
    .maybeSingle();
  return anyMember?.id ? String(anyMember.id) : null;
}
