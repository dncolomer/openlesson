/**
 * Persist Map of Knowledge Find yourself emails as newsletter leads (export for campaigns).
 * No transactional email send.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAP_NEWSLETTER_SUCCESS_MESSAGE,
  validateMapNewsletterRegistration,
} from "@/lib/map-of-knowledge/map-ready-notify";

export type RegisterMapNewsletterLeadInput = {
  email: unknown;
  /** Optional placement link stored in lead message for context. */
  placement_link?: string | null;
  guest_user_id?: string | null;
  workspace_id?: string | null;
};

/**
 * Insert a public.leads row for newsletter export.
 * Uses existing leads table (deployed) so submit does not depend on map_ready_notify_requests.
 */
export async function registerMapNewsletterLead(
  supabase: SupabaseClient,
  input: RegisterMapNewsletterLeadInput,
): Promise<
  | { ok: true; id: string; email: string; message: string }
  | { ok: false; error: string; code: string }
> {
  const validated = validateMapNewsletterRegistration(input);
  if (!validated.ok) {
    return { ok: false, error: validated.error, code: validated.code };
  }

  const link =
    typeof input.placement_link === "string" ? input.placement_link.trim().slice(0, 1500) : "";
  const guest =
    typeof input.guest_user_id === "string" ? input.guest_user_id.trim().slice(0, 80) : "";
  const ws =
    typeof input.workspace_id === "string" ? input.workspace_id.trim().slice(0, 80) : "";

  const messageParts = [
    "Map of Knowledge Find yourself — newsletter subscribe",
    link ? `link=${link}` : null,
    guest ? `guest_user_id=${guest}` : null,
    ws ? `workspace_id=${ws}` : null,
  ].filter(Boolean);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      email: validated.email,
      organization: "Uncertain Systems newsletter",
      audience: "newsletter",
      role: "map_of_knowledge",
      message: messageParts.join(" · "),
      status: "new",
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    console.warn("[map-newsletter] leads insert failed", error?.message);
    return { ok: false, error: "Could not save your email. Please try again.", code: "db_error" };
  }

  return {
    ok: true,
    id: data.id as string,
    email: validated.email,
    message: MAP_NEWSLETTER_SUCCESS_MESSAGE,
  };
}

/** @deprecated Alias — product path is newsletter lead, not transactional notify. */
export async function registerMapReadyNotifyRequest(
  supabase: SupabaseClient,
  input: {
    email: unknown;
    guest_user_id?: unknown;
    workspace_id?: unknown;
    placement_link?: string | null;
  },
): Promise<
  | { ok: true; id: string; email: string; message?: string }
  | { ok: false; error: string; code: string }
> {
  return registerMapNewsletterLead(supabase, {
    email: input.email,
    placement_link: input.placement_link,
    guest_user_id:
      typeof input.guest_user_id === "string" ? input.guest_user_id : null,
    workspace_id:
      typeof input.workspace_id === "string" ? input.workspace_id : null,
  });
}
