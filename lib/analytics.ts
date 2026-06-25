import { track } from "@vercel/analytics";

function currentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function trackCtaClick(params: {
  location: string;
  label: string;
  href: string;
  page?: string;
}) {
  track("cta_click", {
    location: params.location,
    label: params.label,
    href: params.href,
    page: params.page ?? currentPath(),
  });
}

export function trackWorkspaceCreated(params?: { hasFiles?: boolean }) {
  track("workspace_created", {
    has_files: params?.hasFiles ? "true" : "false",
  });
}

export function trackSignupCompleted(params?: { hasReferral?: boolean }) {
  track("signup_completed", {
    has_referral: params?.hasReferral ? "true" : "false",
  });
}

export function trackLeadSubmitted(params: { audience: string; page: string }) {
  track("lead_submitted", {
    audience: params.audience,
    page: params.page,
  });
}