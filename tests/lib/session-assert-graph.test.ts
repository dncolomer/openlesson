import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SessionAssertGraphFrame,
  SessionAssertGraphView,
} from "@/components/session-view/session-assert-graph";
import type { SessionBranchSlot } from "@/components/session-view/session-policy-context";
import {
  normalizeSessionBranchModel,
  SESSION_BRANCH_TARGET_COUNT,
  type SessionBranch,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import {
  cheapestAssertAction,
  layoutSessionAssertGraph,
  sessionAssertRevealOrder,
  SESSION_ASSERT_GRAPH_WIDTH,
} from "@/lib/session-assert-graph";

function branch(
  partial: Pick<SessionBranch, "id" | "parentId" | "title" | "depth"> & Partial<SessionBranch>,
): SessionBranch {
  return {
    question: `What still has to hold about ${partial.title}?`,
    territory: `${partial.title} territory`,
    observation: `${partial.title} is on the board.`,
    status: "open",
    actions: [
      { id: "try", price: 30, leads: "Close opens the next ring.", observation: "Closed." },
      { id: "hold", price: 10, leads: "Keep opens one child.", observation: "Kept." },
      { id: "drop", price: 40, leads: "Discard opens a neighbor.", observation: "Set aside." },
      { id: "insight", price: 80, leads: "Insight waits.", observation: "Not yet." },
    ],
    ...partial,
  };
}

function model(branches: SessionBranch[], focusId = "root"): SessionBranchModel {
  return {
    chapterTitle: "Heat",
    rootId: "root",
    focusId,
    step: 0,
    catalogSize: 4,
    boardNotes: [],
    branches,
  };
}

const PAIR = model([
  branch({ id: "root", parentId: null, title: "Heat", depth: 0 }),
  branch({ id: "r1", parentId: "root", title: "Conduction", depth: 1, status: "open" }),
  branch({ id: "r2", parentId: "root", title: "Radiation", depth: 1, status: "latent" }),
]);

describe("session assert graph", () => {
  it("seats the current node at the center and its children on a ring", () => {
    const layout = layoutSessionAssertGraph(PAIR);
    const root = layout.nodes.find((node) => node.id === "root");
    const left = layout.nodes.find((node) => node.id === "r2");
    const right = layout.nodes.find((node) => node.id === "r1");
    expect(layout.width).toBe(SESSION_ASSERT_GRAPH_WIDTH);
    expect(layout.height).toBe(SESSION_ASSERT_GRAPH_WIDTH);
    expect(root).toMatchObject({ x: 140, y: 140, focused: true });
    expect(left?.x).toBeCloseTo(16);
    expect(left?.y).toBeCloseTo(140);
    expect(right?.x).toBeCloseTo(264);
    expect(right?.y).toBeCloseTo(140);
    expect(left?.focused).toBe(false);
    expect(layout.edges).toEqual([
      { from: "root", to: "r1" },
      { from: "root", to: "r2" },
    ]);
    expect(layout.rings.map((ring) => ring.depth)).toEqual([1]);
    const order = sessionAssertRevealOrder(PAIR);
    expect(order[0]).toBe("root");
    expect(order.indexOf("root")).toBeLessThan(order.indexOf("r1"));
    expect(order.indexOf("root")).toBeLessThan(order.indexOf("r2"));
    expect(cheapestAssertAction(layout.focus)).toBe("hold");
  });

  it("keeps a full field's outer ring from collapsing into one bar", () => {
    const field = normalizeSessionBranchModel(
      {
        premise: "Heat moves until the cheaper path is named.",
        regions: Array.from({ length: 6 }, (_, region) => ({
          title: `Region ${region + 1}`,
          avenues: Array.from({ length: 4 }, (_, avenue) => ({
            title: `Avenue ${region + 1}.${avenue + 1}`,
            inquiries: Array.from({ length: 3 }, (_, inquiry) => ({
              title: `Inquiry ${region + 1}.${avenue + 1}.${inquiry + 1}`,
            })),
          })),
        })),
      },
      "Heat",
    );
    expect(field).not.toBeNull();
    if (!field) return;
    const layout = layoutSessionAssertGraph(field);
    expect(layout.nodes).toHaveLength(SESSION_BRANCH_TARGET_COUNT);
    const leaves = layout.nodes.filter((node) => node.depth === 3);
    expect(leaves).toHaveLength(72);
    let nearest = Infinity;
    for (let i = 0; i < leaves.length; i += 1) {
      for (let j = i + 1; j < leaves.length; j += 1) {
        const dx = leaves[i].x - leaves[j].x;
        const dy = leaves[i].y - leaves[j].y;
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      }
    }
    expect(nearest).toBeGreaterThan(8);
    const root = layout.nodes.find((node) => node.id === "root");
    const mid = layout.nodes.find((node) => node.depth === 1);
    const leaf = leaves[0];
    const fromCenter = (node: { x: number; y: number }) =>
      Math.hypot(node.x - 140, node.y - 140);
    expect(fromCenter(root!)).toBe(0);
    expect(fromCenter(mid!)).toBeGreaterThan(30);
    expect(fromCenter(leaf)).toBeGreaterThan(fromCenter(mid!));
  });

  it("draws the current node, its four actions, and the cheapest price", () => {
    const order = sessionAssertRevealOrder(PAIR);
    const html = renderToStaticMarkup(
      createElement(SessionAssertGraphFrame, {
        model: PAIR,
        showPrices: true,
        shownCount: order.length,
      }),
    );
    expect(html).toContain('data-session-assert-node="root"');
    expect(html).toContain('data-session-assert-focused="true"');
    expect(html).toContain('data-session-assert-state="latent"');
    expect(html).toContain('data-session-assert-focus="root"');
    expect(html).toContain("Heat territory");
    expect(html).toContain("Heat is on the board.");
    const sameText = {
      ...PAIR,
      branches: PAIR.branches.map((item) =>
        item.id === "root" ? { ...item, observation: item.territory } : item,
      ),
    };
    const deduped = renderToStaticMarkup(
      createElement(SessionAssertGraphFrame, {
        model: sameText,
        showPrices: true,
        shownCount: order.length,
      }),
    );
    expect(deduped.match(/Heat territory/g)).toHaveLength(1);
    expect(html).toContain(">Close<");
    expect(html).toContain(">Keep<");
    expect(html).toContain(">Discard<");
    expect(html).toContain(">Insight<");
    expect(html.match(/data-session-assert-cheapest="true"/g)).toHaveLength(1);
    const holdAt = html.indexOf('data-session-assert-action="hold"');
    expect(html.slice(holdAt, holdAt + 80)).toContain('data-session-assert-cheapest="true"');
    expect(html).toContain('data-session-assert-price="hold"');
    expect(html).toContain(">10<");
    expect(html).toContain(`data-session-assert-shown="${order.length}"`);

    const hidden = renderToStaticMarkup(
      createElement(SessionAssertGraphFrame, {
        model: PAIR,
        showPrices: false,
        shownCount: 1,
      }),
    );
    expect(hidden).toContain('data-session-assert-node="root"');
    expect(hidden).not.toContain('data-session-assert-node="r1"');
    expect(hidden).not.toContain("data-session-assert-price");
    expect(hidden).toContain("Keep opens one child.");
  });

  it("starts empty and says when the field is still being written", () => {
    const ready: SessionBranchSlot = { status: "ready", model: PAIR, error: null };
    const firstPaint = renderToStaticMarkup(createElement(SessionAssertGraphView, { slot: ready }));
    expect(firstPaint).toContain("The current node has not been drawn yet.");
    expect(firstPaint).not.toContain("data-session-assert-node");

    const preparing = renderToStaticMarkup(
      createElement(SessionAssertGraphView, {
        slot: { status: "preparing", model: null, error: null },
      }),
    );
    expect(preparing).toContain("The field is still being written.");
    const failed = renderToStaticMarkup(
      createElement(SessionAssertGraphView, {
        slot: { status: "failed", model: null, error: "The field stopped." },
      }),
    );
    expect(failed).toContain("The field stopped.");
    expect(
      renderToStaticMarkup(createElement(SessionAssertGraphView, { slot: null })),
    ).toBe("");
  });
});
