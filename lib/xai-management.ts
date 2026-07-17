/**
 * xAI Management API client — API keys + Collections.
 * Base: https://management-api.x.ai
 * Auth: XAI_MANAGEMENT_API_KEY (separate from inference XAI_API_KEY)
 */

const MANAGEMENT_BASE = "https://management-api.x.ai";

function getManagementKey(): string {
  const key = process.env.XAI_MANAGEMENT_API_KEY;
  if (!key) {
    throw new Error("XAI_MANAGEMENT_API_KEY not configured");
  }
  return key;
}

function getTeamId(): string {
  const teamId = process.env.XAI_TEAM_ID;
  if (!teamId) {
    throw new Error("XAI_TEAM_ID not configured");
  }
  return teamId;
}

function managementHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getManagementKey()}`,
    "Content-Type": "application/json",
  };
}

export function isXaiManagementConfigured(): boolean {
  return Boolean(process.env.XAI_MANAGEMENT_API_KEY && process.env.XAI_TEAM_ID);
}

// ---------- API Keys ----------

export type CreateXaiApiKeyResult = {
  apiKey: string;
  apiKeyId: string;
  name: string;
};

export async function createTeamApiKey(params: {
  name: string;
  acls?: string[];
  qps?: number | null;
  qpm?: number | null;
  tpm?: number | null;
}): Promise<CreateXaiApiKeyResult> {
  const teamId = getTeamId();
  const res = await fetch(`${MANAGEMENT_BASE}/auth/teams/${encodeURIComponent(teamId)}/api-keys`, {
    method: "POST",
    headers: managementHeaders(),
    body: JSON.stringify({
      name: params.name,
      acls: params.acls ?? ["api-key:model:*", "api-key:endpoint:*"],
      qps: params.qps ?? 10,
      qpm: params.qpm ?? 600,
      tpm: params.tpm ?? null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI create API key failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const apiKey = String(data.apiKey ?? data.api_key ?? "");
  const apiKeyId = String(data.apiKeyId ?? data.api_key_id ?? data.id ?? "");
  if (!apiKey || !apiKeyId) {
    throw new Error("xAI create API key response missing apiKey/apiKeyId");
  }

  return {
    apiKey,
    apiKeyId,
    name: params.name,
  };
}

export async function deleteTeamApiKey(apiKeyId: string): Promise<void> {
  const res = await fetch(
    `${MANAGEMENT_BASE}/auth/api-keys/${encodeURIComponent(apiKeyId)}`,
    {
      method: "DELETE",
      headers: managementHeaders(),
    }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI delete API key failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

// ---------- Collections ----------

export type CreateCollectionResult = {
  collectionId: string;
  collectionName: string;
};

export async function createCollection(params: {
  name: string;
  description?: string;
}): Promise<CreateCollectionResult> {
  const body: Record<string, unknown> = {
    collection_name: params.name,
  };
  if (params.description) {
    body.collection_description = params.description;
  }

  const res = await fetch(`${MANAGEMENT_BASE}/v1/collections`, {
    method: "POST",
    headers: managementHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI create collection failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const collectionId = String(data.collection_id ?? data.collectionId ?? data.id ?? "");
  const collectionName = String(data.collection_name ?? data.collectionName ?? params.name);
  if (!collectionId) {
    throw new Error("xAI create collection response missing collection_id");
  }

  return { collectionId, collectionName };
}

export async function addFileToCollection(
  collectionId: string,
  fileId: string,
  fields?: Record<string, string>
): Promise<void> {
  const res = await fetch(
    `${MANAGEMENT_BASE}/v1/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`,
    {
      method: "POST",
      headers: managementHeaders(),
      body: fields ? JSON.stringify({ fields }) : undefined,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI add file to collection failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const res = await fetch(
    `${MANAGEMENT_BASE}/v1/collections/${encodeURIComponent(collectionId)}`,
    {
      method: "DELETE",
      headers: managementHeaders(),
    }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI delete collection failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

export function orgXaiResourceName(prefix: string, slug: string, orgId: string): string {
  const short = orgId.replace(/-/g, "").slice(0, 8);
  const cleanSlug = slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 40);
  return `${prefix}-${cleanSlug}-${short}`.toLowerCase();
}
