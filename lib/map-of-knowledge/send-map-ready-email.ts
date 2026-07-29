/**
 * Outbound email for Map of Knowledge “location ready” notifications.
 * Uses Resend when RESEND_API_KEY is set; otherwise no-ops with a structured result
 * (tests inject sendFn).
 */

import {
  buildMapReadyNotifyEmail,
  normalizeNotifyEmail,
} from "@/lib/map-of-knowledge/map-ready-notify";

export type MapReadyEmailPayload = {
  email: string;
  mapUrl: string;
  workspaceTitle?: string | null;
};

export type MapReadyEmailSendResult = {
  ok: boolean;
  skipped?: boolean;
  provider?: string;
  error?: string;
  messageId?: string;
};

export type MapReadyEmailSender = (
  payload: MapReadyEmailPayload,
) => Promise<MapReadyEmailSendResult>;

/**
 * Default send path: Resend HTTP API when configured.
 */
export async function sendMapReadyEmail(
  payload: MapReadyEmailPayload,
): Promise<MapReadyEmailSendResult> {
  const email = normalizeNotifyEmail(payload.email);
  if (!email) {
    return { ok: false, error: "invalid_email" };
  }

  const content = buildMapReadyNotifyEmail({
    email,
    mapUrl: payload.mapUrl,
    workspaceTitle: payload.workspaceTitle,
  });

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    // Durable no-op without credentials — product still records notified only after ok send
    // when processPending uses this; callers should treat skipped as not notified.
    console.info(
      "[map-ready-email] RESEND_API_KEY unset; skip send to",
      content.to,
      content.subject,
    );
    return { ok: false, skipped: true, provider: "none", error: "resend_not_configured" };
  }

  const from =
    (process.env.MAP_READY_EMAIL_FROM || process.env.RESEND_FROM || "").trim() ||
    "Map of Knowledge <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [content.to],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.warn("[map-ready-email] resend failed", res.status, json);
      return {
        ok: false,
        provider: "resend",
        error: typeof json.message === "string" ? json.message : `http_${res.status}`,
      };
    }
    return { ok: true, provider: "resend", messageId: json.id };
  } catch (err) {
    console.warn("[map-ready-email] send error", err);
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}
