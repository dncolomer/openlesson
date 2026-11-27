import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { applySidebarStyleBody } from "@/lib/organization/apply-sidebar-style";
import { loadOrgAesthetics, saveOrgAesthetics } from "@/lib/organization/aesthetics-store";
import {
  isProtocolSettingsError,
  presentProtocolSettingJson,
} from "@/lib/organization/protocol-settings";
import { resolveProtocolSettingsRequest } from "@/lib/organization/protocol-settings-request";
import {
  getProtocolSetting,
  saveProtocolSettingStyle,
} from "@/lib/organization/protocol-settings-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ctx = await resolveProtocolSettingsRequest({ req, body, adminOnly: true });
    if (!ctx.ok) return ctx.response;

    const loaded = await loadOrgAesthetics(ctx.admin, ctx.organizationId);
    if (!loaded.ok) return jsonError(500, "Failed to load custom aesthetics");
    const current = await getProtocolSetting(ctx.admin, ctx.organizationId, id);
    if (!current) return jsonError(404, "Protocol setting not found");

    const applied = await applySidebarStyleBody({
      admin: ctx.admin,
      organizationId: ctx.organizationId,
      urls: loaded.stored.urls,
      style: current.style,
      body,
    });
    if (!applied.ok) return jsonError(applied.status, applied.error);

    if (applied.urls !== loaded.stored.urls) {
      const savedUrls = await saveOrgAesthetics(ctx.admin, ctx.organizationId, {
        urls: applied.urls,
        style: current.isDefault ? applied.style : loaded.stored.style,
      });
      if (savedUrls.error) return jsonError(500, "Failed to save custom aesthetics");
    }

    const setting = await saveProtocolSettingStyle(
      ctx.admin,
      ctx.organizationId,
      current.id || id,
      applied.style,
    );
    return NextResponse.json({
      images: applied.urls,
      style: applied.style,
      setting: presentProtocolSettingJson(setting),
    });
  } catch (error) {
    if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
    console.error("Protocol setting style error:", error);
    return jsonError(500, "Failed to style the sidebar");
  }
}
