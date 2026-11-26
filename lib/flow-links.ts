/**
 * Extra public URLs for Verify / Calibrate / Solve flows.
 * The flow's own public_token is the unlabeled default (Test). Extra tokens
 * carry an optional label that stamps session metadata and embeddings.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { FLOW_LINKS_TABLE } from "@/lib/core-tables";
import type { ProductFlowKind } from "@/lib/product-flow";

const FLOW_LINKS_GLOBAL = "__openlessonFlowLinksStore";
const FLOW_LINK_LABEL_MAX = 40;

export type FlowLink = {
  id: string;
  ownerUserId: string;
  flowKind: ProductFlowKind;
  flowId: string;
  publicToken: string;
  label: string | null;
  createdAt: string;
};

type StoreGlobal = {
  memory: FlowLink[];
  backend: "unknown" | "supabase" | "memory";
};

function storeGlobal(): StoreGlobal {
  const scope = globalThis as typeof globalThis & {
    [FLOW_LINKS_GLOBAL]?: StoreGlobal;
  };
  if (!scope[FLOW_LINKS_GLOBAL]) {
    scope[FLOW_LINKS_GLOBAL] = { memory: [], backend: "unknown" };
  }
  return scope[FLOW_LINKS_GLOBAL];
}

export function resetFlowLinksStore(backend: "unknown" | "memory" = "unknown"): void {
  const store = storeGlobal();
  store.memory = [];
  store.backend = backend;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveBackend(): Promise<"supabase" | "memory"> {
  const store = storeGlobal();
  if (store.backend !== "unknown") return store.backend;
  if (!supabaseConfigured()) {
    store.backend = "memory";
    return store.backend;
  }
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from(FLOW_LINKS_TABLE).select("id").limit(1);
    store.backend = error ? "memory" : "supabase";
  } catch {
    store.backend = "memory";
  }
  return store.backend;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeFlowLinkLabel(value: unknown): string | null {
  const label = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!label) return null;
  return label.slice(0, FLOW_LINK_LABEL_MAX);
}

export function flowLinkLabelKind(
  label: string | null | undefined,
): "test" | "reference" | "ai_use" | "custom" {
  const normalized = normalizeFlowLinkLabel(label);
  if (!normalized || normalized.toLowerCase() === "test") return "test";
  if (normalized.toLowerCase() === "reference") return "reference";
  if (normalized.toLowerCase() === "ai-use" || normalized.toLowerCase() === "ai_use") {
    return "ai_use";
  }
  return "custom";
}

/** Non-test labels (reference and any custom tag) are Reference, not Test. */
export function flowLinkDefinesReference(label: string | null | undefined): boolean {
  const kind = flowLinkLabelKind(label);
  return kind !== "test" && kind !== "ai_use";
}

export function flowLinkIsAiUse(label: string | null | undefined): boolean {
  return flowLinkLabelKind(label) === "ai_use";
}

export function flowLinkPublicPath(kind: ProductFlowKind, token: string): string {
  const value = encodeURIComponent(String(token || "").trim());
  if (!value) return "";
  if (kind === "calibration") return `/c/${value}`;
  if (kind === "solve") return `/s/${value}`;
  return `/v/${value}`;
}

export function flowLinkLabelFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  return normalizeFlowLinkLabel(
    record.flowLinkLabel ?? record.flow_link_label ?? record.link_label,
  );
}

export function flowLinkIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  return text(record.flowLinkId ?? record.flow_link_id) || null;
}

export function withFlowLinkMetadata(
  metadata: Record<string, unknown>,
  link: { id?: string | null; label?: string | null } | null | undefined,
): Record<string, unknown> {
  const label = normalizeFlowLinkLabel(link?.label);
  const id = text(link?.id);
  return {
    ...metadata,
    ...(label ? { flowLinkLabel: label } : {}),
    ...(id ? { flowLinkId: id } : {}),
  };
}

function mapRow(row: Record<string, unknown>): FlowLink | null {
  const id = text(row.id);
  const ownerUserId = text(row.owner_user_id ?? row.ownerUserId);
  const flowKind = parseFlowLinkKind(row.flow_kind ?? row.flowKind);
  const flowId = text(row.flow_id ?? row.flowId);
  const publicToken = text(row.public_token ?? row.publicToken);
  if (!id || !ownerUserId || !flowKind || !flowId || !publicToken) return null;
  return {
    id,
    ownerUserId,
    flowKind,
    flowId,
    publicToken,
    label: normalizeFlowLinkLabel(row.label),
    createdAt: text(row.created_at ?? row.createdAt) || new Date().toISOString(),
  };
}

export function parseFlowLinkKind(value: unknown): ProductFlowKind | null {
  if (value === "verification" || value === "verify") return "verification";
  if (value === "calibration" || value === "calibrate") return "calibration";
  if (value === "solve") return "solve";
  return null;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fl_${Math.random().toString(36).slice(2, 12)}`;
}

function createFlowLinkToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function getFlowLinkByToken(token: string): Promise<FlowLink | null> {
  const publicToken = text(token);
  if (!publicToken) return null;
  if ((await resolveBackend()) === "memory") {
    return storeGlobal().memory.find((row) => row.publicToken === publicToken) ?? null;
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(FLOW_LINKS_TABLE)
      .select("*")
      .eq("public_token", publicToken)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function listFlowLinksForFlow(input: {
  ownerUserId: string;
  flowKind: ProductFlowKind;
  flowId: string;
}): Promise<FlowLink[]> {
  const ownerUserId = text(input.ownerUserId);
  const flowId = text(input.flowId);
  if (!ownerUserId || !flowId) return [];
  if ((await resolveBackend()) === "memory") {
    return storeGlobal()
      .memory.filter(
        (row) =>
          row.ownerUserId === ownerUserId &&
          row.flowKind === input.flowKind &&
          row.flowId === flowId,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(FLOW_LINKS_TABLE)
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("flow_kind", input.flowKind)
      .eq("flow_id", flowId)
      .order("created_at", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => mapRow(row as Record<string, unknown>))
      .filter((row): row is FlowLink => !!row);
  } catch {
    return [];
  }
}

export async function createFlowLink(input: {
  ownerUserId: string;
  flowKind: ProductFlowKind;
  flowId: string;
  label?: unknown;
  publicToken?: string;
}): Promise<FlowLink> {
  const ownerUserId = text(input.ownerUserId);
  const flowId = text(input.flowId);
  if (!ownerUserId) throw new Error("owner is required");
  if (!flowId) throw new Error("flow is required");
  const label = normalizeFlowLinkLabel(input.label);
  const createdAt = new Date().toISOString();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const publicToken = text(input.publicToken) || createFlowLinkToken();
    const row: FlowLink = {
      id: makeId(),
      ownerUserId,
      flowKind: input.flowKind,
      flowId,
      publicToken,
      label,
      createdAt,
    };
    if ((await resolveBackend()) === "memory") {
      const taken = storeGlobal().memory.some((item) => item.publicToken === publicToken);
      if (taken) {
        if (input.publicToken) throw new Error("token_taken");
        continue;
      }
      storeGlobal().memory = [...storeGlobal().memory, row];
      return row;
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from(FLOW_LINKS_TABLE).insert({
      id: row.id,
      owner_user_id: row.ownerUserId,
      flow_kind: row.flowKind,
      flow_id: row.flowId,
      public_token: row.publicToken,
      label: row.label,
      created_at: row.createdAt,
    });
    if (!error) return row;
    const message = String(error.message || "");
    if (message.toLowerCase().includes("duplicate") || message.includes("flow_links_public_token")) {
      if (input.publicToken) throw new Error("token_taken");
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error("Could not create flow link");
}

export async function deleteFlowLink(input: {
  ownerUserId: string;
  linkId: string;
}): Promise<boolean> {
  const ownerUserId = text(input.ownerUserId);
  const linkId = text(input.linkId);
  if (!ownerUserId || !linkId) return false;
  if ((await resolveBackend()) === "memory") {
    const store = storeGlobal();
    const before = store.memory.length;
    store.memory = store.memory.filter(
      (row) => !(row.id === linkId && row.ownerUserId === ownerUserId),
    );
    return store.memory.length < before;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(FLOW_LINKS_TABLE)
    .delete()
    .eq("id", linkId)
    .eq("owner_user_id", ownerUserId)
    .select("id");
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}
