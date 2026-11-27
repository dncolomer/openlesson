import {
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export const PROTOCOL_SETTING_NAME_MAX = 80;
export const DEFAULT_PROTOCOL_SETTING_NAME = "Default";

export type ProtocolSettingRecord = {
  id: string;
  organizationId: string;
  name: string;
  style: SessionSidebarStyle;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export function clampProtocolSettingName(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, PROTOCOL_SETTING_NAME_MAX);
}

export function parseProtocolSettingId(raw: unknown): string | null {
  if (raw == null) return null;
  const id = String(raw).trim();
  if (!id || id === "default" || id === "none") return null;
  return id;
}

export function isMissingProtocolSettingsTable(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    msg.includes("protocol_settings") &&
    (msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("could not find") ||
      msg.includes("relation"))
  );
}

export function presentProtocolSetting(row: {
  id?: unknown;
  organization_id?: unknown;
  organizationId?: unknown;
  name?: unknown;
  style?: unknown;
  is_default?: unknown;
  isDefault?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
}): ProtocolSettingRecord {
  return {
    id: String(row.id || "").trim(),
    organizationId: String(row.organization_id || row.organizationId || "").trim(),
    name: clampProtocolSettingName(row.name) || DEFAULT_PROTOCOL_SETTING_NAME,
    style: parseSessionSidebarStyle(row.style),
    isDefault: row.is_default === true || row.isDefault === true,
    createdAt: String(row.created_at || row.createdAt || ""),
    updatedAt: String(row.updated_at || row.updatedAt || ""),
  };
}

export function protocolSettingSummary(setting: ProtocolSettingRecord): {
  id: string;
  name: string;
  is_default: boolean;
} {
  return {
    id: setting.id,
    name: setting.name,
    is_default: setting.isDefault,
  };
}

export function presentProtocolSettingJson(setting: ProtocolSettingRecord): {
  id: string;
  organization_id: string;
  name: string;
  style: SessionSidebarStyle;
  is_default: boolean;
  created_at: string;
  updated_at: string;
} {
  return {
    id: setting.id,
    organization_id: setting.organizationId,
    name: setting.name,
    style: setting.style,
    is_default: setting.isDefault,
    created_at: setting.createdAt,
    updated_at: setting.updatedAt,
  };
}

export function sortProtocolSettings(
  rows: readonly ProtocolSettingRecord[],
): ProtocolSettingRecord[] {
  return [...rows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    const name = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (name !== 0) return name;
    return a.id.localeCompare(b.id);
  });
}

export function protocolSettingNamesEqual(a: unknown, b: unknown): boolean {
  return clampProtocolSettingName(a).toLowerCase() === clampProtocolSettingName(b).toLowerCase();
}

export function protocolSettingDeleteBlocked(count: number): boolean {
  return count <= 1;
}

export function nextUntitledProtocolSettingName(
  existing: readonly { name?: string | null }[],
): string {
  const names = new Set(
    existing.map((row) => clampProtocolSettingName(row.name).toLowerCase()).filter(Boolean),
  );
  if (!names.has("untitled")) return "Untitled";
  let n = 2;
  while (names.has(`untitled ${n}`)) n += 1;
  return `Untitled ${n}`;
}

export function isDuplicateProtocolSettingName(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code !== "23505") return false;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("protocol_settings") || msg.includes("org_name");
}

export const PROTOCOL_SETTINGS_TABLE_UNAVAILABLE =
  "Named protocol settings are not available on this database yet.";

export class ProtocolSettingsError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProtocolSettingsError";
    this.status = status;
  }
}

export function isProtocolSettingsError(error: unknown): error is ProtocolSettingsError {
  return error instanceof ProtocolSettingsError;
}
