/**
 * Double-click peek: full title + description for a map block/chapter.
 */

export type MapBlockPeek = {
  id: string;
  title: string;
  description: string;
};

export function resolveMapBlockPeek(
  nodes: ReadonlyArray<{
    id: string;
    title?: string | null;
    description?: string | null;
  }>,
  blockId: string | null | undefined,
): MapBlockPeek | null {
  const id = String(blockId ?? "").trim();
  if (!id) return null;
  const node = nodes.find((n) => n.id === id);
  if (!node) return null;
  return {
    id,
    title: String(node.title ?? "").trim() || "Untitled",
    description: String(node.description ?? "").trim(),
  };
}
