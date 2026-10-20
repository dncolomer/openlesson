import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GRAPH_DIAMOND_LEAF_RADIUS,
  GRAPH_DIAMOND_ROOT_RADIUS,
  graphDiamondBoundaryPoint,
  graphDiamondEdge,
  graphDiamondPointsAttr,
  graphDiamondRadius,
  graphDiamondVertices,
} from "@/lib/graph-diamond";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("graph diamond marks", () => {
  it("puts vertices on the axes so edges can meet a point of the diamond", () => {
    expect(graphDiamondRadius(true)).toBe(GRAPH_DIAMOND_ROOT_RADIUS);
    expect(graphDiamondRadius(false)).toBe(GRAPH_DIAMOND_LEAF_RADIUS);
    const vertices = graphDiamondVertices({ x: 40, y: 20 }, 10);
    expect(vertices).toEqual([
      { x: 40, y: 10 },
      { x: 50, y: 20 },
      { x: 40, y: 30 },
      { x: 30, y: 20 },
    ]);
    expect(graphDiamondPointsAttr({ x: 40, y: 20 }, 10)).toBe("40,10 50,20 40,30 30,20");
  });

  it("clips an east-west edge to the diamond vertices", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    expect(graphDiamondBoundaryPoint(from, to, 10)).toEqual({ x: 10, y: 0 });
    expect(graphDiamondBoundaryPoint(to, from, 8)).toEqual({ x: 92, y: 0 });
    expect(graphDiamondEdge(from, to, 10, 8)).toEqual({
      x1: 10,
      y1: 0,
      x2: 92,
      y2: 0,
    });
  });

  it("draws SVG diamonds on the science explorer and Unsys seed graph", () => {
    const scene = read("components/science/LearningModelScene.tsx");
    const graph = read("components/WorkspaceUnsysSeedGraph.tsx");
    expect(scene).toContain("graphDiamondEdge");
    expect(scene).toContain("graphDiamondPointsAttr");
    expect(scene).toContain("data-explorer-diamond");
    expect(scene).not.toContain("rotate-45");
    expect(graph).toContain("graphDiamondEdge");
    expect(graph).toContain("data-author-unsys-diamond");
    expect(graph).not.toContain("rotate-45");
  });
});
