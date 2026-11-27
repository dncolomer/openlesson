import type { SupabaseClient } from "@supabase/supabase-js";
import { readCustomAestheticUrls } from "@/lib/organization/custom-aesthetic-set";
import {
  EMPTY_SESSION_SIDEBAR_STYLE,
  isMissingSidebarStyleColumn,
  parseSessionSidebarStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";
import { writeFlowRowWithOptionalColumns } from "@/lib/flow-row-write";

export type StoredOrgAesthetics = {
  urls: string[];
  style: SessionSidebarStyle;
};

export async function loadOrgAesthetics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true; stored: StoredOrgAesthetics } | { ok: false }> {
  const { data, error } = await admin
    .from("organizations")
    .select("custom_aesthetic_urls, sidebar_style")
    .eq("id", organizationId)
    .single();
  if (error && isMissingSidebarStyleColumn(error)) {
    const fallback = await admin
      .from("organizations")
      .select("custom_aesthetic_urls")
      .eq("id", organizationId)
      .single();
    if (fallback.error || !fallback.data) return { ok: false };
    return {
      ok: true,
      stored: {
        urls: readCustomAestheticUrls(fallback.data.custom_aesthetic_urls),
        style: EMPTY_SESSION_SIDEBAR_STYLE,
      },
    };
  }
  if (error || !data) return { ok: false };
  return {
    ok: true,
    stored: {
      urls: readCustomAestheticUrls(data.custom_aesthetic_urls),
      style: parseSessionSidebarStyle(data.sidebar_style),
    },
  };
}

export async function saveOrgAesthetics(
  admin: SupabaseClient,
  organizationId: string,
  stored: StoredOrgAesthetics,
): Promise<{ error: { message: string } | null }> {
  return writeFlowRowWithOptionalColumns(
    (body) => admin.from("organizations").update(body).eq("id", organizationId),
    {
      custom_aesthetic_urls: stored.urls,
      sidebar_style: stored.style,
      updated_at: new Date().toISOString(),
    },
    ["sidebar_style"],
  );
}
