import { postLtiUnsysGrades } from "@/lib/lti/ags-post";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { ltiUnsysScores, unsysDistanceFromEmbeddingRaw } from "@/lib/lti/unsys-score";
import { listFlowEmbeddingsForOwner } from "@/lib/flow-embedding-store";
import type { StoredFlowEmbedding } from "@/lib/flow-embedding-store";

export async function maybePostLtiUnsysGrades(input: {
  stored: StoredFlowEmbedding;
  flowName?: string;
}): Promise<void> {
  try {
    const session = await readLtiLaunchSession();
    if (!session?.ags) return;
    const identity = String(input.stored.identity || "").trim();
    if (!identity || identity !== session.identity) return;
    const owner = String(input.stored.owner_user_id || "").trim();
    let distances: number[] = [];
    if (owner && input.stored.flow_id) {
      const listed = await listFlowEmbeddingsForOwner({
        ownerUserId: owner,
        flowKind: input.stored.flow_kind,
        flowId: input.stored.flow_id,
      });
      distances = listed
        .filter((row) => String(row.identity || "").trim() === identity)
        .map((row) => unsysDistanceFromEmbeddingRaw(row.raw))
        .filter((value): value is number => value != null);
    }
    const scores = ltiUnsysScores({
      latestRaw: input.stored.raw,
      distances,
    });
    await postLtiUnsysGrades({
      session,
      flowName: input.flowName || "Flow",
      scores,
    });
  } catch (error) {
    console.error("[lti-ags] grade passback failed", error instanceof Error ? error.message : error);
  }
}
