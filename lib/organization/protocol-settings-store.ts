import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOrgAesthetics, saveOrgAesthetics } from "@/lib/organization/aesthetics-store";
import {
  clampProtocolSettingName,
  DEFAULT_PROTOCOL_SETTING_NAME,
  isDuplicateProtocolSettingName,
  isMissingProtocolSettingsTable,
  parseProtocolSettingId,
  presentProtocolSetting,
  protocolSettingDeleteBlocked,
  protocolSettingLocked,
  protocolSettingNamesEqual,
  PROTOCOL_SETTING_DEFAULT_LOCKED,
  PROTOCOL_SETTINGS_TABLE_UNAVAILABLE,
  ProtocolSettingsError,
  sortProtocolSettings,
  type ProtocolSettingRecord,
} from "@/lib/organization/protocol-settings";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

const SETTING_SELECT = "id, organization_id, name, style, is_default, created_at, updated_at";

function nowIso(): string {
  return new Date().toISOString();
}

function syntheticDefault(
  organizationId: string,
  style: SessionSidebarStyle,
): ProtocolSettingRecord {
  return presentProtocolSetting({
    id: "",
    organization_id: organizationId,
    name: DEFAULT_PROTOCOL_SETTING_NAME,
    style,
    is_default: true,
    created_at: "",
    updated_at: "",
  });
}

async function loadOrgStyle(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SessionSidebarStyle> {
  const loaded = await loadOrgAesthetics(admin, organizationId);
  return loaded.ok ? loaded.stored.style : EMPTY_SESSION_SIDEBAR_STYLE;
}

async function writeThroughDefaultStyle(
  admin: SupabaseClient,
  organizationId: string,
  style: SessionSidebarStyle,
): Promise<void> {
  const loaded = await loadOrgAesthetics(admin, organizationId);
  if (!loaded.ok) return;
  await saveOrgAesthetics(admin, organizationId, {
    urls: loaded.stored.urls,
    style,
  });
}

async function tableProbe(
  admin: SupabaseClient,
  organizationId: string,
): Promise<
  | { available: false }
  | { available: true; rows: ProtocolSettingRecord[] }
> {
  const { data, error } = await admin
    .from("protocol_settings")
    .select(SETTING_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingProtocolSettingsTable(error)) return { available: false };
    throw new ProtocolSettingsError(500, error.message || "Failed to load protocol settings");
  }
  return {
    available: true,
    rows: sortProtocolSettings((data || []).map((row) => presentProtocolSetting(row))),
  };
}

async function clearDefaultFlag(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { error } = await admin
    .from("protocol_settings")
    .update({ is_default: false, updated_at: nowIso() })
    .eq("organization_id", organizationId)
    .eq("is_default", true);
  if (error && !isMissingProtocolSettingsTable(error)) {
    throw new ProtocolSettingsError(500, error.message || "Failed to update default setting");
  }
}

export async function listProtocolSettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ settings: ProtocolSettingRecord[]; tableAvailable: boolean }> {
  const orgId = String(organizationId || "").trim();
  if (!orgId) return { settings: [], tableAvailable: false };
  const probed = await tableProbe(admin, orgId);
  if (!probed.available) {
    return {
      settings: [syntheticDefault(orgId, await loadOrgStyle(admin, orgId))],
      tableAvailable: false,
    };
  }
  if (probed.rows.length === 0) {
    const created = await ensureDefaultProtocolSetting(admin, orgId);
    return { settings: created ? [created] : [], tableAvailable: true };
  }
  return { settings: probed.rows, tableAvailable: true };
}

export async function getProtocolSetting(
  admin: SupabaseClient,
  organizationId: string,
  settingId: string | null,
): Promise<ProtocolSettingRecord | null> {
  const listed = await listProtocolSettings(admin, organizationId);
  const id = parseProtocolSettingId(settingId);
  if (!id) return listed.settings.find((row) => row.isDefault) ?? listed.settings[0] ?? null;
  return listed.settings.find((row) => row.id === id) ?? null;
}

export async function ensureDefaultProtocolSetting(
  admin: SupabaseClient,
  organizationId: string,
): Promise<ProtocolSettingRecord | null> {
  const orgId = String(organizationId || "").trim();
  if (!orgId) return null;
  const probed = await tableProbe(admin, orgId);
  if (!probed.available) {
    return syntheticDefault(orgId, await loadOrgStyle(admin, orgId));
  }
  const existing = probed.rows.find((row) => row.isDefault) ?? probed.rows[0] ?? null;
  if (existing) {
    if (!existing.isDefault) {
      await clearDefaultFlag(admin, orgId);
      const { data, error } = await admin
        .from("protocol_settings")
        .update({ is_default: true, updated_at: nowIso() })
        .eq("id", existing.id)
        .eq("organization_id", orgId)
        .select(SETTING_SELECT)
        .single();
      if (error || !data) return existing;
      await writeThroughDefaultStyle(admin, orgId, presentProtocolSetting(data).style);
      return presentProtocolSetting(data);
    }
    return existing;
  }
  const style = await loadOrgStyle(admin, orgId);
  const stamp = nowIso();
  const { data, error } = await admin
    .from("protocol_settings")
    .insert({
      organization_id: orgId,
      name: DEFAULT_PROTOCOL_SETTING_NAME,
      style,
      is_default: true,
      created_at: stamp,
      updated_at: stamp,
    })
    .select(SETTING_SELECT)
    .single();
  if (error) {
    if (isMissingProtocolSettingsTable(error)) {
      return syntheticDefault(orgId, style);
    }
    if (isDuplicateProtocolSettingName(error)) {
      const again = await tableProbe(admin, orgId);
      return again.available ? again.rows[0] ?? null : syntheticDefault(orgId, style);
    }
    throw new ProtocolSettingsError(500, error.message || "Failed to create default setting");
  }
  return presentProtocolSetting(data);
}

export async function createProtocolSetting(
  admin: SupabaseClient,
  organizationId: string,
  input: { name: unknown; style?: SessionSidebarStyle | null; isDefault?: boolean },
): Promise<ProtocolSettingRecord> {
  const orgId = String(organizationId || "").trim();
  const name = clampProtocolSettingName(input.name);
  if (!name) throw new ProtocolSettingsError(400, "name is required");
  const listed = await listProtocolSettings(admin, orgId);
  if (!listed.tableAvailable) {
    throw new ProtocolSettingsError(503, PROTOCOL_SETTINGS_TABLE_UNAVAILABLE);
  }
  if (listed.settings.some((row) => protocolSettingNamesEqual(row.name, name))) {
    throw new ProtocolSettingsError(409, "A setting with that name already exists");
  }
  const makeDefault = listed.settings.length === 0 || input.isDefault === true;
  const style =
    input.style ??
    listed.settings.find((row) => row.isDefault)?.style ??
    (await loadOrgStyle(admin, orgId));
  if (makeDefault) await clearDefaultFlag(admin, orgId);
  const stamp = nowIso();
  const { data, error } = await admin
    .from("protocol_settings")
    .insert({
      organization_id: orgId,
      name,
      style,
      is_default: makeDefault,
      created_at: stamp,
      updated_at: stamp,
    })
    .select(SETTING_SELECT)
    .single();
  if (error) {
    if (isMissingProtocolSettingsTable(error)) {
      throw new ProtocolSettingsError(503, PROTOCOL_SETTINGS_TABLE_UNAVAILABLE);
    }
    if (isDuplicateProtocolSettingName(error)) {
      throw new ProtocolSettingsError(409, "A setting with that name already exists");
    }
    throw new ProtocolSettingsError(500, error.message || "Failed to create protocol setting");
  }
  const created = presentProtocolSetting(data);
  if (created.isDefault) await writeThroughDefaultStyle(admin, orgId, created.style);
  return created;
}

export async function updateProtocolSetting(
  admin: SupabaseClient,
  organizationId: string,
  settingId: string,
  input: { name?: unknown; isDefault?: boolean; style?: SessionSidebarStyle },
): Promise<ProtocolSettingRecord> {
  const orgId = String(organizationId || "").trim();
  const listed = await listProtocolSettings(admin, orgId);
  const current = await getProtocolSetting(admin, orgId, settingId);
  if (!current || (!current.id && listed.tableAvailable)) {
    throw new ProtocolSettingsError(404, "Protocol setting not found");
  }
  if (!listed.tableAvailable) {
    throw new ProtocolSettingsError(403, PROTOCOL_SETTING_DEFAULT_LOCKED);
  }
  if (
    protocolSettingLocked(current) &&
    (input.name !== undefined || input.style !== undefined)
  ) {
    throw new ProtocolSettingsError(403, PROTOCOL_SETTING_DEFAULT_LOCKED);
  }
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (input.name !== undefined) {
    const name = clampProtocolSettingName(input.name);
    if (!name) throw new ProtocolSettingsError(400, "name is required");
    if (
      listed.settings.some(
        (row) => row.id !== current.id && protocolSettingNamesEqual(row.name, name),
      )
    ) {
      throw new ProtocolSettingsError(409, "A setting with that name already exists");
    }
    patch.name = name;
  }
  if (input.style) patch.style = input.style;
  if (input.isDefault === true && !current.isDefault) {
    await clearDefaultFlag(admin, orgId);
    patch.is_default = true;
  }
  const { data, error } = await admin
    .from("protocol_settings")
    .update(patch)
    .eq("id", current.id)
    .eq("organization_id", orgId)
    .select(SETTING_SELECT)
    .single();
  if (error) {
    if (isDuplicateProtocolSettingName(error)) {
      throw new ProtocolSettingsError(409, "A setting with that name already exists");
    }
    throw new ProtocolSettingsError(500, error.message || "Failed to update protocol setting");
  }
  const updated = presentProtocolSetting(data);
  if (updated.isDefault && (input.style || input.isDefault === true)) {
    await writeThroughDefaultStyle(admin, orgId, updated.style);
  }
  return updated;
}

export async function deleteProtocolSetting(
  admin: SupabaseClient,
  organizationId: string,
  settingId: string,
): Promise<{ deleted: true; promoted: ProtocolSettingRecord | null }> {
  const orgId = String(organizationId || "").trim();
  const listed = await listProtocolSettings(admin, orgId);
  if (!listed.tableAvailable) {
    throw new ProtocolSettingsError(503, PROTOCOL_SETTINGS_TABLE_UNAVAILABLE);
  }
  const current = listed.settings.find((row) => row.id === parseProtocolSettingId(settingId));
  if (!current) throw new ProtocolSettingsError(404, "Protocol setting not found");
  if (protocolSettingLocked(current)) {
    throw new ProtocolSettingsError(403, PROTOCOL_SETTING_DEFAULT_LOCKED);
  }
  if (protocolSettingDeleteBlocked(listed.settings.length)) {
    throw new ProtocolSettingsError(400, "Keep at least one protocol setting");
  }
  const { error } = await admin
    .from("protocol_settings")
    .delete()
    .eq("id", current.id)
    .eq("organization_id", orgId);
  if (error) throw new ProtocolSettingsError(500, error.message || "Failed to delete protocol setting");
  let promoted: ProtocolSettingRecord | null = null;
  if (current.isDefault) {
    const remaining = listed.settings.filter((row) => row.id !== current.id);
    const next = remaining[0] ?? null;
    if (next) {
      promoted = await updateProtocolSetting(admin, orgId, next.id, { isDefault: true });
    }
  }
  return { deleted: true, promoted };
}

export async function saveProtocolSettingStyle(
  admin: SupabaseClient,
  organizationId: string,
  settingId: string | null,
  style: SessionSidebarStyle,
): Promise<ProtocolSettingRecord> {
  return updateProtocolSetting(admin, organizationId, settingId ?? "", { style });
}

export async function syncDefaultProtocolSettingStyle(
  _admin: SupabaseClient,
  _organizationId: string,
  _style: SessionSidebarStyle,
): Promise<void> {
  // Default is locked. Leftover /aesthetics/style must not write through.
}

export async function resolveSidebarStyleForProtocol(
  admin: SupabaseClient,
  organizationId: string | null | undefined,
  protocolSettingId: string | null | undefined,
): Promise<SessionSidebarStyle> {
  const orgId = String(organizationId || "").trim();
  if (!orgId) return EMPTY_SESSION_SIDEBAR_STYLE;
  const setting = await getProtocolSetting(admin, orgId, parseProtocolSettingId(protocolSettingId));
  if (setting) return parseSessionSidebarStyle(setting.style);
  return loadOrgStyle(admin, orgId);
}

export async function assertProtocolSettingInOrg(
  admin: SupabaseClient,
  organizationId: string,
  protocolSettingId: string | null,
): Promise<string | null> {
  const id = parseProtocolSettingId(protocolSettingId);
  if (!id) return null;
  const setting = await getProtocolSetting(admin, organizationId, id);
  if (!setting?.id) {
    throw new ProtocolSettingsError(400, "protocol_setting_id is not in this organization");
  }
  return setting.id;
}
