/**
 * Flow and knowledge-region rows are owned by owner_user_id.
 * New creates do not insert a workspace.
 */

export function flowOwnedByUser(
  flow: { ownerUserId?: string | null },
  userId: string,
): boolean {
  const owner = String(flow.ownerUserId || "").trim();
  const user = String(userId || "").trim();
  return Boolean(owner && user && owner === user);
}
