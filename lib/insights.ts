export type InsightSummary = {
  id: string;
  title: string;
  summary: string;
  workspace_id?: string | null;
  block_id?: string | null;
  session_id?: string | null;
  aesthetic_image?: string | null;
  share_token?: string | null;
  created_at: string;
  archived_at?: string | null;
};

export function formatInsightDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function insightPublicPath(insight: Pick<InsightSummary, "id" | "share_token">) {
  return `/insights/${insight.share_token || insight.id}`;
}

export function insightShareUrl(
  insight: Pick<InsightSummary, "id" | "share_token">,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  return `${origin}${insightPublicPath(insight)}`;
}

export async function archiveInsight(insightId: string): Promise<void> {
  const response = await fetch(`/api/insights/${insightId}/archive`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to archive insight");
  }
}