/**
 * Persistence + process path for Map of Knowledge ready notifications.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppOrigin } from "@/lib/app-url";
import {
  shouldNotifyMapReadyRequest,
  validateMapReadyNotifyRegistration,
  type MapReadyNotifyRequestLike,
} from "@/lib/map-of-knowledge/map-ready-notify";
import {
  sendMapReadyEmail,
  type MapReadyEmailSender,
} from "@/lib/map-of-knowledge/send-map-ready-email";

export type RegisterMapReadyNotifyInput = {
  email: unknown;
  guest_user_id: unknown;
  workspace_id: unknown;
  placement_link?: string | null;
};

/**
 * Upsert a pending notify request (one pending row per guest+workspace).
 */
export async function registerMapReadyNotifyRequest(
  supabase: SupabaseClient,
  input: RegisterMapReadyNotifyInput,
): Promise<
  | { ok: true; id: string; email: string }
  | { ok: false; error: string; code: string }
> {
  const validated = validateMapReadyNotifyRegistration(input);
  if (!validated.ok) {
    return { ok: false, error: validated.error, code: validated.code };
  }

  const placement_link =
    typeof input.placement_link === "string" ? input.placement_link.trim().slice(0, 2000) : null;

  // Prefer updating an existing pending row (avoid spam duplicates).
  const { data: existing } = await supabase
    .from("map_ready_notify_requests")
    .select("id")
    .eq("guest_user_id", validated.guest_user_id)
    .eq("workspace_id", validated.workspace_id)
    .is("notified_at", null)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("map_ready_notify_requests")
      .update({
        email: validated.email,
        placement_link,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.warn("[map-ready-notify] update failed", error.message);
      return { ok: false, error: "Could not save notify request", code: "db_error" };
    }
    return { ok: true, id: existing.id as string, email: validated.email };
  }

  const { data, error } = await supabase
    .from("map_ready_notify_requests")
    .insert({
      email: validated.email,
      guest_user_id: validated.guest_user_id,
      workspace_id: validated.workspace_id,
      placement_link,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    console.warn("[map-ready-notify] insert failed", error?.message);
    return { ok: false, error: "Could not save notify request", code: "db_error" };
  }
  return { ok: true, id: data.id as string, email: validated.email };
}

/** True when a knowledge_config snapshot exists for guest on a public workspace. */
export async function isGuestSubjectOnPublicMap(
  supabase: SupabaseClient,
  guestUserId: string,
  workspaceId: string,
): Promise<boolean> {
  const guest = guestUserId.trim();
  const ws = workspaceId.trim();
  if (!guest || !ws) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, is_public, archived_at, status")
    .eq("id", ws)
    .maybeSingle();

  if (
    !workspace ||
    workspace.is_public !== true ||
    workspace.archived_at != null ||
    (typeof workspace.status === "string" &&
      workspace.status.trim() !== "" &&
      workspace.status !== "active")
  ) {
    return false;
  }

  const { data: snap } = await supabase
    .from("knowledge_config_snapshots")
    .select("id")
    .eq("workspace_id", ws)
    .eq("subject_guest_user_id", guest)
    .limit(1)
    .maybeSingle();

  return Boolean(snap?.id);
}

/**
 * Process pending notify rows: send email when subject is on the public map.
 * Pure readiness uses shouldNotifyMapReadyRequest; send is injectable for tests.
 */
export async function processPendingMapReadyNotifications(
  supabase: SupabaseClient,
  options: {
    guestUserId?: string | null;
    workspaceId?: string | null;
    sendEmail?: MapReadyEmailSender;
    mapUrl?: string;
    limit?: number;
  } = {},
): Promise<{ checked: number; notified: number; failed: number }> {
  const send = options.sendEmail ?? sendMapReadyEmail;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  let query = supabase
    .from("map_ready_notify_requests")
    .select("id, email, guest_user_id, workspace_id, notified_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (options.guestUserId) {
    query = query.eq("guest_user_id", options.guestUserId.trim());
  }
  if (options.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId.trim());
  }

  const { data: rows, error } = await query;
  if (error) {
    console.warn("[map-ready-notify] list pending failed", error.message);
    return { checked: 0, notified: 0, failed: 0 };
  }

  const mapUrl =
    (options.mapUrl || "").trim() ||
    `${getAppOrigin()}/map-of-knowledge`;

  let checked = 0;
  let notified = 0;
  let failed = 0;

  for (const row of (rows || []) as MapReadyNotifyRequestLike[]) {
    checked += 1;
    const present = await isGuestSubjectOnPublicMap(
      supabase,
      row.guest_user_id,
      row.workspace_id,
    );
    if (!shouldNotifyMapReadyRequest(row, present)) continue;

    const { data: ws } = await supabase
      .from("workspaces")
      .select("title")
      .eq("id", row.workspace_id)
      .maybeSingle();

    const sendResult = await send({
      email: row.email,
      mapUrl,
      workspaceTitle: (ws?.title as string | null) ?? null,
    });

    if (!sendResult.ok) {
      failed += 1;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("map_ready_notify_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("notified_at", null);

    if (updateErr) {
      console.warn("[map-ready-notify] mark notified failed", updateErr.message);
      failed += 1;
      continue;
    }
    notified += 1;
  }

  return { checked, notified, failed };
}
