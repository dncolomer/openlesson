import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "path";
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
  PROTOCOL_SETTING_NAME_MAX,
  nextUntitledProtocolSettingName,
  sortProtocolSettings,
} from "@/lib/organization/protocol-settings";
import { emptyProtocolDraft } from "@/lib/product-flow";
import { PROTOCOL_SETTINGS_API_BASE } from "@/lib/api/agent-api-paths";
import { EMPTY_SESSION_SIDEBAR_STYLE } from "@/lib/session-sidebar-style";
import { dashboardProtocolSettingsHref } from "@/lib/dashboard-nav";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("named protocol settings", () => {
  it("parses ids, names, and missing-table errors", () => {
    expect(parseProtocolSettingId(null)).toBeNull();
    expect(parseProtocolSettingId("")).toBeNull();
    expect(parseProtocolSettingId("default")).toBeNull();
    expect(parseProtocolSettingId("none")).toBeNull();
    expect(parseProtocolSettingId("  set-1  ")).toBe("set-1");
    expect(clampProtocolSettingName("  Brass  Hall  ")).toBe("Brass Hall");
    expect(clampProtocolSettingName("x".repeat(200)).length).toBe(PROTOCOL_SETTING_NAME_MAX);
    expect(protocolSettingNamesEqual("Default", "default")).toBe(true);
    expect(protocolSettingDeleteBlocked(1)).toBe(true);
    expect(protocolSettingDeleteBlocked(2)).toBe(false);
    expect(protocolSettingLocked({ isDefault: true })).toBe(true);
    expect(protocolSettingLocked({ isDefault: false })).toBe(false);
    expect(protocolSettingLocked(null)).toBe(false);
    expect(PROTOCOL_SETTING_DEFAULT_LOCKED).toContain("cannot be edited");
    expect(isMissingProtocolSettingsTable({ code: "42P01" })).toBe(true);
    expect(isDuplicateProtocolSettingName({ code: "23505", message: "protocol_settings_org_name_uidx" })).toBe(
      true,
    );
    const presented = presentProtocolSetting({
      id: "s1",
      organization_id: "org-1",
      name: " Night ",
      style: EMPTY_SESSION_SIDEBAR_STYLE,
      is_default: true,
    });
    expect(presented.name).toBe("Night");
    expect(presented.isDefault).toBe(true);
    expect(sortProtocolSettings([
      { ...presented, id: "b", name: "Beta", isDefault: false },
      { ...presented, id: "a", name: "Alpha", isDefault: true },
    ]).map((row) => row.id)).toEqual(["a", "b"]);
    expect(DEFAULT_PROTOCOL_SETTING_NAME).toBe("Uncertain Systems");
    const rename = read("supabase/migrations/20261127150000_protocol_settings_uncertain_systems.sql");
    expect(rename).toContain("Uncertain Systems");
    expect(rename).toContain("lower(ps.name) = 'default'");
    expect(emptyProtocolDraft().protocolSettingId).toBeNull();
    expect(nextUntitledProtocolSettingName([])).toBe("Untitled");
    expect(nextUntitledProtocolSettingName([{ name: "Untitled" }])).toBe("Untitled 2");
    expect(nextUntitledProtocolSettingName([{ name: "Untitled" }, { name: "Untitled 2" }])).toBe(
      "Untitled 3",
    );
    expect(dashboardProtocolSettingsHref()).toBe("/dashboard?tab=protocol_settings");
    expect(dashboardProtocolSettingsHref("set-1")).toBe(
      "/dashboard?tab=protocol_settings&setting=set-1",
    );
  });

  it("ships the protocol_settings table and protocol FK", () => {
    const sql = read("supabase/migrations/20261127120000_protocol_settings.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.protocol_settings");
    expect(sql).toContain("protocol_settings_org_name_uidx");
    expect(sql).toContain("protocol_settings_org_default_uidx");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS protocol_setting_id");
    expect(sql).toContain("ON DELETE SET NULL");
  });

  it("exposes dashboard CRUD and a protocol picker", () => {
    expect(existsSync(join(ROOT, "app/api/organization/protocol-settings/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/organization/protocol-settings/[id]/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/organization/protocol-settings/[id]/style/route.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "app/api/v3/protocol-settings/route.ts"))).toBe(true);
    expect(PROTOCOL_SETTINGS_API_BASE).toBe("/api/v3/protocol-settings");
    const tab = read("components/organization/protocol-settings-tab.tsx");
    expect(tab).toContain("data-org-protocol-settings-table");
    expect(tab).toContain("console-copy");
    expect(tab).toContain("space-y-6");
    expect(tab).toContain("FLOW_PRIMARY_BTN");
    expect(tab).toContain("data-org-protocol-setting-new");
    expect(tab).toContain("handleCreateSetting");
    expect(tab).toContain("handleDeleteSetting");
    expect(tab).toContain("handleSetDefault");
    expect(tab).toContain("ProtocolSettingsEditor");
    expect(tab).toContain("data-org-protocol-settings-edit");
    expect(tab).toContain("protocolSettingLocked");
    expect(tab).toContain("protocolSettingsView");
    expect(tab).toContain("data-org-protocol-settings-view");
    expect(tab).not.toContain("if (row && protocolSettingLocked(row))");
    expect(tab).not.toContain("CustomAestheticsStyler");
    const editor = read("components/organization/protocol-settings-editor.tsx");
    expect(editor).toContain("data-org-protocol-settings-editor");
    expect(editor).toContain("data-org-protocol-settings-name");
    expect(editor).toContain("data-org-protocol-settings-preview-frame");
    expect(editor).toContain("data-org-protocol-settings-editor-actions");
    expect(editor).toContain("data-org-protocol-settings-rail");
    expect(editor).toContain("lg:w-[18rem]");
    expect(editor).toContain("min-h-0");
    expect(editor).toContain("lg:h-[calc(100dvh-6rem)]");
    expect(editor.match(/className="console-copy/g)?.length).toBe(2);
    expect(editor).toContain("ProtocolSettingsCanvasMock");
    expect(editor).toContain("CustomAestheticsStyler");
    expect(editor).toContain("compact");
    expect(editor).toContain("viewOnly={locked}");
    expect(editor).toContain("editable={canEdit}");
    expect(editor).toContain("protocolSettingsDefaultLocked");
    expect(editor).not.toContain("pointer-events-none");
    expect(editor).toContain("data-org-protocol-settings-reset-default");
    expect(editor).toContain("handleResetSidebarStyle");
    expect(editor).toContain("protocolSettingsResetToDefault");
    expect(editor).toContain("data-org-protocol-settings-save");
    expect(editor).toContain("handleSaveSetting");
    expect(editor).toContain("protocolSettingsSaveStyle");
    expect(editor).not.toContain("handleRenameSetting");
    expect(editor).not.toContain("protocolSettingsRename");
    const factory = read("supabase/migrations/20261127140000_protocol_settings_factory_default.sql");
    expect(factory).toContain("WHERE is_default");
    expect(factory).toContain('"background": "#000000"');
    expect(factory).toContain('"background": "#0a0a0a"');
    expect(factory).toContain('"stroke": "#e1e1e1"');
    expect(factory).toContain("UPDATE public.organizations");
    const mock = read("components/organization/protocol-settings-canvas-mock.tsx");
    expect(mock).toContain("SessionWorkSurface");
    expect(mock).toContain("ExcalidrawCanvas");
    expect(mock).toContain("liveCanvasChrome");
    expect(mock).toContain("inertCommands");
    expect(mock).toContain("viewModeEnabled={viewOnly}");
    expect(mock).toContain("zenMode: false");
    expect(mock).toContain("FALLBACK_AESTHETIC_IMAGES");
    expect(mock).toContain("backgroundImage: null");
    expect(mock).not.toContain("sessionMarkMode");
    expect(editor).toContain("urls={brandStill}");
    expect(mock).toContain("image={brandStill || null}");
    expect(mock).toContain("key={brandStill || \"system\"}");
    expect(mock).toContain("boardStyle.backgroundImage || urls[0]");
    expect(editor).toContain("protocolSettingsUploadImage");
    expect(editor).toContain("protocolSettingsGenerate");
    expect(editor).not.toContain("style.aestheticUrls");
    const page = read("app/dashboard/page.tsx");
    expect(page).toContain("overflow-x-hidden p-4 py-8 sm:px-6 lg:px-8");
    expect(page).not.toContain("protocolSettingsEditorOpen");
    const store = read("lib/organization/protocol-settings-store.ts");
    expect(store).toContain("PROTOCOL_SETTING_DEFAULT_LOCKED");
    expect(store).toContain("protocolSettingLocked");
    expect(read("components/organization/use-org-protocol-style.ts")).toContain(
      "protocolSettingLocked",
    );
    expect(read("app/api/organization/protocol-settings/[id]/style/route.ts")).toContain(
      "protocolSettingLocked",
    );
    expect(read("components/product-flow/product-flow-wizard.tsx")).toContain("ProtocolSettingSelect");
    expect(read("components/product-flow/product-flow-page.tsx")).toContain("ProtocolSettingSelect");
    expect(read("components/product-flow/protocol-setting-select.tsx")).toContain(
      'data-flow-protocol-setting=""',
    );
    expect(read("lib/verification-flow.ts")).toContain("protocolSettingId");
    expect(read("lib/verification-flow-repository.ts")).toContain("protocol_setting_id");
    expect(read("lib/pow-api/agent-flow-management.ts")).toContain("protocol_setting_id");
    expect(read("lib/pow-api/mcp-tools/evidence-tools.ts")).toContain("protocol_setting_id");
    expect(read("app/api/verification-flow/public/[token]/route.ts")).toContain("sidebarStyle");
    expect(read("components/VerificationFlowRunner.tsx")).toContain("SessionSidebarStyleOverride");
    expect(read("lib/use-session-sidebar-style.ts")).toContain("SessionSidebarStyleOverride");
  });
});
