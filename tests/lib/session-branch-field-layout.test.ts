import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearnHiddenStatesTree } from "@/components/session-view/learn-hidden-states-modal";
import { SessionBranchFieldMap } from "@/components/session-view/session-branch-field-map";
import {
  layoutSessionBranchField,
  learnVisitedHiddenStateIds,
  sessionBranchPathFromRoot,
  soundingRevealedIds,
} from "@/lib/session-branch-field-layout";
import {
  normalizeSessionBranchModel,
  sessionBranchCheapestTransition,
  type SessionBranchDraft,
} from "@/lib/session-branch-model";
import { LEARN_HIDDEN_STATES_SUGGESTION_LABEL } from "@/lib/session-harness";

function fieldDraft(): SessionBranchDraft {
  const regions = Array.from({ length: 6 }, (_, regionIndex) => ({
    title: `Region ${regionIndex + 1}`,
    territory: `Territory ${regionIndex + 1}`,
    observation: `Region ${regionIndex + 1} is open.`,
    closePrice: 30,
    keepPrice: 12,
    discardPrice: 48,
    insightPrice: 90,
    avenues: Array.from({ length: 4 }, (_, avenueIndex) => ({
      title: `Avenue ${regionIndex + 1}.${avenueIndex + 1}`,
      territory: `Avenue ${regionIndex + 1}.${avenueIndex + 1}`,
      observation: `Avenue ${regionIndex + 1}.${avenueIndex + 1} is ahead.`,
      closePrice: 22,
      keepPrice: 18,
      discardPrice: 9,
      insightPrice: 70,
      inquiries: Array.from({ length: 3 }, (_, inquiryIndex) => ({
        title: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1}`,
        territory: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1}`,
        observation: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1} is ahead.`,
        closePrice: 11,
        keepPrice: 16,
        discardPrice: 40,
        insightPrice: 20,
      })),
    })),
  }));
  return { premise: "Just war", regions };
}

describe("session branch field layout", () => {
  it("places every hidden state and fogs Calibrate except the path and stills", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    const layout = layoutSessionBranchField(model, 800, 500);
    expect(layout.points).toHaveLength(model.branches.length);
    expect(layout.edges.length).toBe(model.branches.length - 1);
    const root = layout.points.find((point) => point.id === model.rootId);
    expect(root).toBeTruthy();
    const leaf = model.branches.find((branch) => branch.depth === 3);
    expect(leaf).toBeTruthy();
    if (!leaf) return;
    const path = sessionBranchPathFromRoot(model, leaf.id);
    expect(path[0]).toBe(model.rootId);
    expect(path.at(-1)).toBe(leaf.id);
    expect(path.length).toBe(4);
    const revealed = soundingRevealedIds(model, [leaf.id]);
    expect(revealed.size).toBe(4);
    expect(revealed.has(model.rootId)).toBe(true);
    expect(revealed.has(leaf.id)).toBe(true);
    const html = renderToStaticMarkup(
      createElement(SessionBranchFieldMap, {
        model,
        variant: "underlay",
        revealedIds: revealed,
        currentIds: [leaf.id],
      }),
    );
    expect(html).toContain('data-session-branch-field-map=""');
    expect(html).toContain('data-session-branch-field-variant="underlay"');
    expect(html).toContain(`data-session-branch-node="${leaf.id}"`);
    expect(html).toContain(`data-session-branch-node="${model.focusId}"`);
    expect(html).toContain('data-session-branch-node-focus="true"');
  });

  it("marks the loaded Learn path and visited hidden states", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    const leaf = model.branches.find((branch) => branch.depth === 3);
    expect(leaf).toBeTruthy();
    if (!leaf) return;
    const path = sessionBranchPathFromRoot(model, leaf.id);
    const focused = {
      ...model,
      focusId: leaf.id,
      branches: model.branches.map((branch) =>
        branch.id === leaf.id ? { ...branch, status: "closed" as const } : branch,
      ),
    };
    const visited = learnVisitedHiddenStateIds(focused, [
      { hiddenStateId: leaf.id, fromId: path[path.length - 2] },
    ]);
    expect(visited.has(focused.rootId)).toBe(true);
    expect(visited.has(leaf.id)).toBe(true);
    expect(visited.has(path[1]!)).toBe(true);
    const html = renderToStaticMarkup(
      createElement(SessionBranchFieldMap, {
        model: focused,
        variant: "panel",
        visitedIds: visited,
        loadedIds: new Set(path),
        currentIds: [leaf.id],
      }),
    );
    expect(html).toContain(`data-session-branch-node-visited="true"`);
    expect(html).toContain(`data-session-branch-node-loaded="true"`);
    expect(html).toContain(`data-session-branch-node-focus="true"`);
    expect(html).toContain("data-session-branch-edge-loaded");
    expect(html).toContain("#ffe14a");
    const tree = renderToStaticMarkup(
      createElement(LearnHiddenStatesTree, {
        model: focused,
        inferences: [{ hiddenStateId: leaf.id, fromId: path[path.length - 2] }],
      }),
    );
    expect(tree).toContain('data-learn-hidden-states-map=""');
    expect(tree).toContain("data-author-unsys-graph");
    expect(tree).toContain("data-author-unsys-diamond");
    expect(tree).toContain(`data-learn-hidden-states-node="${leaf.id}"`);
    expect(tree).toContain('data-learn-hidden-states-visited="true"');
    expect(tree).toContain('data-learn-hidden-states-loaded="true"');
    expect(tree).toContain('data-learn-hidden-states-focus="true"');
    expect(tree).toContain('data-learn-hidden-states-here="true"');
    expect(tree).toContain("learn-hidden-state-here");
    expect(tree).toContain("#ff1f1f");
    expect(tree).toContain("#ffe14a");
    expect(tree).toContain(leaf.title);
    expect(tree).not.toContain('data-learn-hidden-states-transition=""');
    const atRoot = renderToStaticMarkup(
      createElement(LearnHiddenStatesTree, { model, inferences: [] }),
    );
    const cheapest = sessionBranchCheapestTransition(model);
    expect(cheapest).toBeTruthy();
    if (!cheapest) return;
    expect(atRoot).toContain(LEARN_HIDDEN_STATES_SUGGESTION_LABEL);
    expect(atRoot).toContain(`data-learn-hidden-states-transition-to="${cheapest.toId}"`);
    expect(atRoot).toContain(cheapest.toTitle);
    expect(atRoot).not.toContain("Focus this transition");
    expect(atRoot).not.toContain(`${cheapest.fromTitle} →`);
  });
});
