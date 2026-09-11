/**
 * Public insight share: OG title/input and the three page stats (PoW, time, workspace).
 * Pure — tests drive these with representative insight records.
 */
import { formatInsightDate, insightPublicPath, type InsightSummary } from "@/lib/insights";
import {
  UNSYS_STANDARD_SHARE_BRAND,
  UNSYS_STANDARD_SHARE_SITE,
  UNSYS_STANDARD_SHARE_SITE_NAME,
} from "@/lib/og/standard";
import { openGraphImagePathForRoute } from "@/lib/og/paths";

export const INSIGHT_OG_EYEBROW = "Insight";
export const INSIGHT_HOME_HREF = "/";
export const INSIGHT_HOME_LABEL = UNSYS_STANDARD_SHARE_SITE_NAME;
export const INSIGHT_FALLBACK_TITLE = "Insight";
export const INSIGHT_FALLBACK_WORKSPACE_NAME = "Workspace";

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function insightOgTitle(insight: { title?: string | null } | null | undefined): string {
  return cleanText(insight?.title) || INSIGHT_FALLBACK_TITLE;
}

export function insightOgDescription(
  insight: { summary?: string | null } | null | undefined,
): string {
  return cleanText(insight?.summary);
}

export function insightOpenGraphImagePath(
  insight: Pick<InsightSummary, "id" | "share_token">,
): string {
  return openGraphImagePathForRoute(insightPublicPath(insight));
}

export function insightOgAlt(insight: { title?: string | null } | null | undefined): string {
  return `${insightOgTitle(insight)} — ${UNSYS_STANDARD_SHARE_BRAND}`;
}

/** Input for `composeOgImage` — title is the insight's, never the unsys standard card. */
export function buildInsightOgShareInput(insight: {
  id?: string | null;
  title?: string | null;
  summary?: string | null;
  aesthetic_image?: string | null;
}): {
  title: string;
  description: string;
  eyebrow: string;
  brand: string;
  footerLabel: string;
  aestheticPath: string | null;
  aestheticSeed: string;
  siteLabel: string;
} {
  const title = insightOgTitle(insight);
  const aesthetic = cleanText(insight.aesthetic_image);
  return {
    title,
    description: insightOgDescription(insight),
    eyebrow: INSIGHT_OG_EYEBROW,
    brand: UNSYS_STANDARD_SHARE_BRAND,
    footerLabel: UNSYS_STANDARD_SHARE_SITE_NAME,
    aestheticPath: aesthetic.startsWith("/aesthetics/") ? aesthetic : null,
    aestheticSeed: cleanText(insight.id) || title,
    siteLabel: UNSYS_STANDARD_SHARE_SITE,
  };
}

export function insightShareSocialMetadata(insight: {
  id: string;
  share_token?: string | null;
  title?: string | null;
  summary?: string | null;
}): {
  title: string;
  description: string;
  openGraph: {
    title: string;
    description: string;
    siteName: string;
    type: "article";
    images: Array<{ url: string; width: number; height: number; alt: string }>;
  };
  twitter: {
    card: "summary_large_image";
    title: string;
    description: string;
    images: string[];
  };
} {
  const title = insightOgTitle(insight);
  const description = insightOgDescription(insight);
  const image = insightOpenGraphImagePath(insight);
  const alt = insightOgAlt(insight);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: UNSYS_STANDARD_SHARE_SITE_NAME,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function countInsightLinkedThoughts(input: {
  thought_ids?: unknown;
  source_thoughts?: unknown;
}): number {
  if (Array.isArray(input.thought_ids)) {
    const n = input.thought_ids.filter((id) => String(id ?? "").trim()).length;
    if (n > 0) return n;
  }
  if (Array.isArray(input.source_thoughts)) {
    return input.source_thoughts.length;
  }
  return 0;
}

export function resolveInsightWorkspaceName(input: {
  workspace_title?: string | null;
  workspace_name?: string | null;
  root_topic?: string | null;
}): string {
  return (
    cleanText(input.workspace_title) ||
    cleanText(input.workspace_name) ||
    cleanText(input.root_topic) ||
    INSIGHT_FALLBACK_WORKSPACE_NAME
  );
}

export type InsightPageStats = {
  powCount: number;
  powLabel: string;
  timeLabel: string;
  workspaceName: string;
  workspaceHref: string | null;
  homeHref: string;
  homeLabel: string;
};

export const INSIGHT_WORKSPACE_TITLE_TABLE = "workspaces";
export const INSIGHT_WORKSPACE_TITLE_COLUMNS = "title, root_topic";

export function insightWorkspaceTitleFromRow(
  row: { title?: unknown; root_topic?: unknown } | null | undefined,
): string | null {
  const name = cleanText(row?.title) || cleanText(row?.root_topic);
  return name || null;
}

export type InsightWorkspaceTitleClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, id: string) => {
        maybeSingle: () => Promise<{ data: { title?: unknown; root_topic?: unknown } | null }>;
      };
    };
  };
};

/** Service-role (or test double). Typed loosely so SupabaseClient does not blow up tsc. */
type WorkspaceTitleQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, id: string) => {
        maybeSingle: () => Promise<{ data?: { title?: unknown; root_topic?: unknown } | null }>;
      };
    };
  };
};

function asWorkspaceTitleQuery(client: unknown): WorkspaceTitleQueryClient {
  return client as WorkspaceTitleQueryClient;
}

/** Service-role read: private workspaces still expose a name on a public insight page. */
export async function loadWorkspaceTitleForPublicInsight(
  admin: unknown,
  workspaceId: unknown,
): Promise<string | null> {
  const id = cleanText(workspaceId);
  if (!id) return null;
  const { data } = await asWorkspaceTitleQuery(admin)
    .from(INSIGHT_WORKSPACE_TITLE_TABLE)
    .select(INSIGHT_WORKSPACE_TITLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return insightWorkspaceTitleFromRow(data ?? null);
}

/**
 * After a public insight is confirmed, load the workspace name via admin.
 * `userScoped` is accepted so callers pass the cookie/anon client — it must not
 * be used: RLS hides private workspace titles from share-link visitors.
 */
export async function resolvePublicInsightWorkspaceTitle(input: {
  workspaceId: unknown;
  userScoped: unknown;
  admin: unknown;
}): Promise<string | null> {
  void input.userScoped;
  return loadWorkspaceTitleForPublicInsight(input.admin, input.workspaceId);
}

export function deriveInsightPageStats(input: {
  thought_ids?: unknown;
  source_thoughts?: unknown;
  created_at?: string | null;
  workspace_id?: string | null;
  workspace_title?: string | null;
  workspace_name?: string | null;
}): InsightPageStats {
  const powCount = countInsightLinkedThoughts(input);
  const workspaceId = cleanText(input.workspace_id);
  return {
    powCount,
    powLabel: `${powCount} PoW`,
    timeLabel: input.created_at ? formatInsightDate(input.created_at) : "—",
    workspaceName: resolveInsightWorkspaceName(input),
    workspaceHref: workspaceId ? `/workspace/${workspaceId}` : null,
    homeHref: INSIGHT_HOME_HREF,
    homeLabel: INSIGHT_HOME_LABEL,
  };
}

