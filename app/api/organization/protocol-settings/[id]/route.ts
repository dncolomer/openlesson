import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  isProtocolSettingsError,
  presentProtocolSettingJson,
} from "@/lib/organization/protocol-settings";
import { resolveProtocolSettingsRequest } from "@/lib/organization/protocol-settings-request";
import {
  deleteProtocolSetting,
  getProtocolSetting,
  updateProtocolSetting,
} from "@/lib/organization/protocol-settings-store";
import { parseSessionSidebarStyle } from "@/lib/session-sidebar-style";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ctx = await resolveProtocolSettingsRequest({ req });
    if (!ctx.ok) return ctx.response;
    const setting = await getProtocolSetting(ctx.admin, ctx.organizationId, id);
    if (!setting) return jsonError(404, "Protocol setting not found");
    return NextResponse.json({ setting: presentProtocolSettingJson(setting) });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("Get protocol setting error:", error);
    return jsonError(500, "Failed to load protocol setting");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ctx = await resolveProtocolSettingsRequest({ req, body, adminOnly: true });
    if (!ctx.ok) return ctx.response;
    const updated = await updateProtocolSetting(ctx.admin, ctx.organizationId, id, {
      name: body.name,
      isDefault:
        body.is_default === true || body.isDefault === true
          ? true
          : undefined,
      style: body.style != null ? parseSessionSidebarStyle(body.style) : undefined,
    });
    return NextResponse.json({ setting: presentProtocolSettingJson(updated) });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("Update protocol setting error:", error);
    return jsonError(500, "Failed to update protocol setting");
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ctx = await resolveProtocolSettingsRequest({ req, adminOnly: true });
    if (!ctx.ok) return ctx.response;
    const result = await deleteProtocolSetting(ctx.admin, ctx.organizationId, id);
    return NextResponse.json({
      ok: true,
      promoted: result.promoted ? presentProtocolSettingJson(result.promoted) : null,
    });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("Delete protocol setting error:", error);
    return jsonError(500, "Failed to delete protocol setting");
  }
}
