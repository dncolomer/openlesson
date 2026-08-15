/**
 * Admin-facing product tool labels.
 * Technical kinds remain ile/tap in data; operators see Explore/Drill × Dialog/Solo.
 */

import {
  PRODUCT_INTENT_LABELS,
  productIntentClusterLabel,
  productIntentFromGuestLink,
  type ProductLaunchTarget,
} from "@/lib/product-intent";

/** Mirrors ActivityType in activity.ts without importing (avoids cycles). */
export type AdminActivityType =
  | "ile_session"
  | "tap_session"
  | "proof_of_work"
  | "workspace_created";

/** Family rollups when only ile vs tap aggregates exist (no per-variant stats). */
export const ADMIN_SESSION_HORIZON_LABELS = {
  /** ILE aggregate → Explore product family */
  openEnded: "Explore sessions",
  openEndedShort: "explore",
  /** TAP aggregate → Drill product family */
  timed: "Drill sessions",
  timedShort: "drill",
  /** Explicit Explore / Drill rollups */
  explore: "Explore sessions",
  exploreShort: "explore",
  drill: "Drill sessions",
  drillShort: "drill",
} as const;

export type AdminSessionTechKind = "ile" | "tap" | "tutoring" | "ile_session" | "tap_session" | string;

/**
 * Map technical session fields → product launch target (four variants).
 * Sparse/missing subtype falls back via productIntentFromGuestLink defaults
 * (ile→explore dialog, tap→drill dialog) — never TAP/ILE product names.
 */
export function adminSessionProductTarget(input: {
  technicalKind?: AdminSessionTechKind | null;
  session_mode?: string | null;
  interaction_kind?: string | null;
}): ProductLaunchTarget {
  const raw = String(input.technicalKind || "").toLowerCase();
  const kind: "ile" | "tap" =
    raw === "ile" ||
    raw === "tutoring" ||
    raw === "ile_session" ||
    raw === "open_ended" ||
    raw === "open-ended" ||
    raw === "explore"
      ? "ile"
      : "tap";

  return productIntentFromGuestLink({
    kind,
    session_mode: input.session_mode,
    interaction_kind: input.interaction_kind,
  });
}

/** Full product tool name, e.g. "Drill · Dialog". */
export function adminSessionProductLabel(input: {
  technicalKind?: AdminSessionTechKind | null;
  session_mode?: string | null;
  interaction_kind?: string | null;
}): string {
  return productIntentClusterLabel(adminSessionProductTarget(input));
}

/**
 * Activity feed type badge.
 * When subtype fields are present, show the specific four-variant name;
 * otherwise show the honest family rollup (Explore / Drill).
 */
export function adminActivityTypeLabel(
  type: AdminActivityType | string,
  meta?: {
    session_mode?: string | null;
    interaction_kind?: string | null;
    /** When true, prefer full product name even if subtype fields are sparse defaults. */
    preferFullProductName?: boolean;
  },
): string {
  switch (type) {
    case "ile_session": {
      if (meta?.session_mode || meta?.preferFullProductName) {
        return adminSessionProductLabel({
          technicalKind: "ile",
          session_mode: meta.session_mode,
        });
      }
      return "Explore session";
    }
    case "tap_session": {
      if (meta?.interaction_kind || meta?.preferFullProductName) {
        return adminSessionProductLabel({
          technicalKind: "tap",
          interaction_kind: meta.interaction_kind,
        });
      }
      return "Drill session";
    }
    case "proof_of_work":
      return "Proof of work";
    case "workspace_created":
      return "Workspace";
    default:
      return type;
  }
}

/** Compact per-user activity summary for admin overview table. */
export function adminActiveUserActivityLabel(user: {
  ileSessions: number;
  tapSessions: number;
  proofOfWork: number;
  workspacesCreated: number;
}): string {
  const parts: string[] = [];
  if (user.ileSessions) {
    parts.push(`${user.ileSessions} ${ADMIN_SESSION_HORIZON_LABELS.exploreShort}`);
  }
  if (user.tapSessions) {
    parts.push(`${user.tapSessions} ${ADMIN_SESSION_HORIZON_LABELS.drillShort}`);
  }
  if (user.proofOfWork) parts.push(`${user.proofOfWork} PoW`);
  if (user.workspacesCreated) parts.push(`${user.workspacesCreated} WS`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/** Activity feed summary line for a Drill (TAP) session row. */
export function adminTimedSessionActivitySummary(input: {
  interaction_kind?: string | null;
  overall_score?: number | null;
}): string {
  const label = adminSessionProductLabel({
    technicalKind: "tap",
    interaction_kind: input.interaction_kind,
  });
  const score =
    typeof input.overall_score === "number" ? ` · score ${input.overall_score}` : "";
  return `${label}${score}`;
}

export function adminProductIntentLabels() {
  return {
    exploreDialog: PRODUCT_INTENT_LABELS.exploreDialog,
    exploreSolo: PRODUCT_INTENT_LABELS.exploreSolo,
    drillDialog: PRODUCT_INTENT_LABELS.drillDialog,
    drillSolo: PRODUCT_INTENT_LABELS.drillSolo,
    // Legacy key aliases
    openEndedExplore: PRODUCT_INTENT_LABELS.exploreDialog,
    openEndedDrill: PRODUCT_INTENT_LABELS.exploreSolo,
    timedExplore: PRODUCT_INTENT_LABELS.drillDialog,
    timedDrill: PRODUCT_INTENT_LABELS.drillSolo,
  };
}
