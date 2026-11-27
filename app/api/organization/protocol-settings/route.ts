import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  isProtocolSettingsError,
  presentProtocolSettingJson,
} from "@/lib/organization/protocol-settings";
import { resolveProtocolSettingsRequest } from "@/lib/organization/protocol-settings-request";
import {
  createProtocolSetting,
  listProtocolSettings,
} from "@/lib/organization/protocol-settings-store";
import { parseSessionSidebarStyle } from "@/lib/session-sidebar-style";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveProtocolSettingsRequest({ req });
    if (!ctx.ok) return ctx.response;
    const listed = await listProtocolSettings(ctx.admin, ctx.organizationId);
    return NextResponse.json({
      settings: listed.settings.map(presentProtocolSettingJson),
      table_available: listed.tableAvailable,
      is_org_admin: ctx.isOrgAdmin,
    });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("List protocol settings error:", error);
    return jsonError(500, "Failed to load protocol settings");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ctx = await resolveProtocolSettingsRequest({ req, body, adminOnly: true });
    if (!ctx.ok) return ctx.response;
    const created = await createProtocolSetting(ctx.admin, ctx.organizationId, {
      name: body.name,
      style: body.style != null ? parseSessionSidebarStyle(body.style) : undefined,
      isDefault: body.is_default === true || body.isDefault === true,
    });
    return NextResponse.json({ setting: presentProtocolSettingJson(created) }, { status: 201 });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("Create protocol setting error:", error);
    return jsonError(500, "Failed to create protocol setting");
  }
}
