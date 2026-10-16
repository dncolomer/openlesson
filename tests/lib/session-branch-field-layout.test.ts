import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionBranchFieldMap } from "@/components/session-view/session-branch-field-map";
import {
  layoutSessionBranchField,
  sessionBranchPathFromRoot,
  soundingRevealedIds,
} from "@/lib/session-branch-field-layout";
import {
  normalizeSessionBranchModel,
  type SessionBranchDraft,
} from "@/lib/session-branch-model";

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
});
