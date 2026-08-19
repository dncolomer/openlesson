import {
  subjectOptionKey,
  type AvailableSubject,
  type KnowledgeConfigResponse,
} from "@/components/knowledge-panel/widgets";

export async function fetchKnowledgeConfig(
  workspaceId: string,
  ayclToken: string | undefined,
  query: Record<string, string | undefined>,
): Promise<KnowledgeConfigResponse> {
  const response = await fetch("/api/workspace/knowledge-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      max_points: 120,
      ...query,
      ...(ayclToken ? { ayclToken } : {}),
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Failed to load knowledge config");
  return json as KnowledgeConfigResponse;
}

export function mergeAvailableSubjects(
  prev: AvailableSubject[],
  payload: KnowledgeConfigResponse,
): AvailableSubject[] {
  if (!Array.isArray(payload.available_subjects)) return prev;
  const byKey = new Map(prev.map((s) => [subjectOptionKey(s), s]));
  for (const s of payload.available_subjects) {
    byKey.set(subjectOptionKey(s), s);
  }
  return Array.from(byKey.values());
}
