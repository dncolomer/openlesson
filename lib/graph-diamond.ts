/**
 * Axis-aligned diamond marks for the science explorer and Unsys seed graph.
 * Vertices sit on the axes so SVG edges can meet the same points as the mark.
 */

export type GraphDiamondPoint = { x: number; y: number };

export const GRAPH_DIAMOND_LEAF_RADIUS = 8;
export const GRAPH_DIAMOND_ROOT_RADIUS = 11;

export function graphDiamondRadius(isRoot: boolean): number {
  return isRoot ? GRAPH_DIAMOND_ROOT_RADIUS : GRAPH_DIAMOND_LEAF_RADIUS;
}

export function graphDiamondVertices(
  center: GraphDiamondPoint,
  radius: number,
): GraphDiamondPoint[] {
  return [
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y },
  ];
}

export function graphDiamondPointsAttr(
  center: GraphDiamondPoint,
  radius: number,
): string {
  const vertices = graphDiamondVertices(center, radius);
  return vertices.map((point) => `${point.x},${point.y}`).join(" ");
}

/** Point on the diamond boundary in the direction of `toward`. */
export function graphDiamondBoundaryPoint(
  center: GraphDiamondPoint,
  toward: GraphDiamondPoint,
  radius: number,
): GraphDiamondPoint {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const manhattan = Math.abs(dx) + Math.abs(dy);
  if (manhattan < 1e-6) return { x: center.x, y: center.y };
  const t = radius / manhattan;
  return { x: center.x + dx * t, y: center.y + dy * t };
}

export function graphDiamondEdge(
  from: GraphDiamondPoint,
  to: GraphDiamondPoint,
  fromRadius: number,
  toRadius: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const start = graphDiamondBoundaryPoint(from, to, fromRadius);
  const end = graphDiamondBoundaryPoint(to, from, toRadius);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
