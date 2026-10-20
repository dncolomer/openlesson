import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionBranchFieldView } from "@/components/session-view/session-branch-field";
import {
  assembleSessionBranchDraft,
  mapWithConcurrency,
  planSessionBranchAvenueCalls,
  planSessionBranchInquiryCalls,
} from "@/lib/session-branch-model-generate";
import {
  adoptSessionBranchGrowth,
  advanceSessionBranchModel,
  appendSessionBranchNotes,
  graftSessionBranchModel,
  normalizeSessionBranchModel,
  withoutSessionBranchNotes,
  recommendSessionBranchAction,
  SESSION_BRANCH_ACCEPT_COUNT,
  SESSION_BRANCH_TARGET_COUNT,
  sessionBranchById,
  sessionBranchChildQuota,
  sessionBranchModelPrompt,
  sessionBranchParentsNeedingGrowth,
  type SessionBranchDraft,
} from "@/lib/session-branch-model";

function fieldDraft(): SessionBranchDraft {
  const regions = Array.from({ length: 6 }, (_, regionIndex) => ({
    title: `Region ${regionIndex + 1} of the argument`,
    question: `What must still hold in region ${regionIndex + 1} of the argument?`,
    territory: `Territory ${regionIndex + 1} stays distinct from the others.`,
    observation: `Region ${regionIndex + 1} is open on the board.`,
    closePrice: 30 + regionIndex,
    keepPrice: 12,
    discardPrice: 48,
    insightPrice: 90,
    closeLeads: "The avenues of this region open.",
    keepLeads: "One avenue opens for a further look.",
    discardLeads: "A neighboring region opens.",
    insightLeads: "Insight waits until this region is settled.",
    closeObservation: `Closing region ${regionIndex + 1} settles its standard.`,
    keepObservation: `Keeping region ${regionIndex + 1} asks for one more observation.`,
    discardObservation: `Discarding region ${regionIndex + 1} leaves it for later.`,
    insightObservation: `The insight is not in region ${regionIndex + 1} yet.`,
    avenues: Array.from({ length: 4 }, (_, avenueIndex) => ({
      title: `Avenue ${regionIndex + 1}.${avenueIndex + 1}`,
      question: `What would go wrong on avenue ${regionIndex + 1}.${avenueIndex + 1}?`,
      territory: `Avenue ${regionIndex + 1}.${avenueIndex + 1} diverges.`,
      observation: `Avenue ${regionIndex + 1}.${avenueIndex + 1} is still ahead.`,
      closePrice: 22,
      keepPrice: 18,
      discardPrice: 9,
      insightPrice: 70,
      closeLeads: "The inquiries under this avenue open.",
      keepLeads: "The first inquiry opens.",
      discardLeads: "The next avenue opens.",
      insightLeads: "Insight is early on this avenue.",
      closeObservation: `Closing avenue ${regionIndex + 1}.${avenueIndex + 1} names what it showed.`,
      keepObservation: `Keeping the avenue asks the first inquiry.`,
      discardObservation: `Discarding the avenue opens the next one.`,
      insightObservation: `Insight does not belong on avenue ${regionIndex + 1}.${avenueIndex + 1}.`,
      inquiries: Array.from({ length: 3 }, (_, inquiryIndex) => ({
        title: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1}`,
        question: `What would you check at inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1}?`,
        territory: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1} goes further.`,
        observation: `Inquiry ${regionIndex + 1}.${avenueIndex + 1}.${inquiryIndex + 1} is still ahead.`,
        closePrice: 11,
        keepPrice: 16,
        discardPrice: 40,
        insightPrice: 20,
        closeLeads: "This inquiry settles.",
        keepLeads: "This inquiry stays open.",
        discardLeads: "The next inquiry opens.",
        insightLeads: "Insight can follow a settled inquiry.",
        closeObservation: "The inquiry is settled by the selected slice.",
        keepObservation: "The inquiry still needs another pass.",
        discardObservation: "The inquiry is a dead end.",
        insightObservation: "The insight names what this inquiry settled.",
      })),
    })),
  }));
  return {
    premise: "A war can be wrong even when the cause is serious.",
    closePrice: 28,
    keepPrice: 4,
    discardPrice: 60,
    insightPrice: 1,
    closeLeads: "The first open region becomes the focus.",
    keepLeads: "Stay with the premise and write one more observation.",
    discardLeads: "Leave the premise and open another way in.",
    insightLeads: "Insight is too early on the premise.",
    closeObservation: "The premise is settled. The first region is next.",
    keepObservation: "The premise still needs a case before it can settle.",
    discardObservation: "The premise is not the argument to keep.",
    insightObservation: "An insight from the premise alone would skip the field.",
    regions,
  };
}

describe("session branch model", () => {
  it("builds a field of regions, avenues, and inquiries", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    expect(SESSION_BRANCH_TARGET_COUNT).toBe(103);
    expect(model.branches).toHaveLength(SESSION_BRANCH_TARGET_COUNT);
    expect(model.branches.filter((branch) => branch.depth === 3 && branch.status === "latent")).toHaveLength(72);
    expect(model.branches.filter((branch) => branch.status === "open").map((branch) => branch.id)).toEqual([
      "root",
      "r1",
      "r2",
      "r3",
      "r4",
      "r5",
      "r6",
    ]);
    expect(model.boardNotes).toHaveLength(SESSION_BRANCH_TARGET_COUNT);
    expect(model.boardNotes.map((note) => note.key)).toContain("r2-a3-q1");
    expect(model.focusId).toBe("root");
    expect(sessionBranchById(model, "r2-a3-q1")?.status).toBe("latent");
    expect(
      sessionBranchById(model, "root")?.edges.find((edge) => edge.toId === "r1")?.price,
    ).toBe(12);
    const clamped = normalizeSessionBranchModel(
      {
        ...fieldDraft(),
        regions: [
          {
            ...(fieldDraft().regions as Record<string, unknown>[])[0]!,
            edgePrice: 140,
          },
          ...((fieldDraft().regions as Record<string, unknown>[]).slice(1)),
        ],
      },
      "Just war",
    );
    expect(
      sessionBranchById(clamped!, "root")?.edges.find((edge) => edge.toId === "r1")?.price,
    ).toBe(100);
  });

  it("recommends the cheapest outgoing hidden state", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    expect(recommendSessionBranchAction(model, "root")?.toId).toBe("r1");
    expect(recommendSessionBranchAction(model, "root")?.price).toBe(12);
    expect(sessionBranchChildQuota(0)).toBe(0);
    expect(sessionBranchChildQuota(1)).toBe(4);
    expect(sessionBranchChildQuota(2)).toBe(3);
    expect(sessionBranchParentsNeedingGrowth(model)).toEqual([]);
    const opening = normalizeSessionBranchModel(
      {
        premise: "A priced field.",
        question: "What is still open?",
        territory: "A priced field.",
        observation: "The field is open.",
        regions: [
          {
            title: "Cheap region",
            question: "What is cheap here?",
            territory: "Cheap region of the field.",
            observation: "The cheap region is open.",
            edgePrice: 2,
          },
          {
            title: "Dear region",
            question: "What is dear here?",
            territory: "Dear region of the field.",
            observation: "The dear region is open.",
            edgePrice: 70,
          },
        ],
      },
      "Priced",
    );
    expect(opening).toBeTruthy();
    const growing = sessionBranchParentsNeedingGrowth(opening!);
    expect(growing.map((row) => row.parent.id)).toEqual(["r1", "r2"]);
    expect(growing.every((row) => row.need === 4)).toBe(true);
  });

  it("travels a priced edge and writes the observation", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    const held = advanceSessionBranchModel(model, { toId: "r1", fromId: "root" });
    expect(held.focusId).toBe("r1");
    expect(sessionBranchById(held, "r1")?.status).toBe("open");
    expect(held.boardNotes.some((note) => note.text.includes("Region 1"))).toBe(true);

    const deeper = advanceSessionBranchModel(held, { toId: "r1-a1", fromId: "r1" });
    expect(deeper.focusId).toBe("r1-a1");
    expect(sessionBranchById(deeper, "r1-a1")?.status).toBe("open");

    const again = advanceSessionBranchModel(model, { toId: "r1", fromId: "root" });
    expect(again.boardNotes.some((note) => note.key.includes("root->r1"))).toBe(true);
  });

  it("grafts branches that arrive after the learner has already moved", () => {
    const full = normalizeSessionBranchModel(fieldDraft(), "Just war");
    const partial = normalizeSessionBranchModel(
      {
        ...fieldDraft(),
        regions: [
          {
            title: "Region 1 of the argument",
            territory: "Territory 1 stays distinct from the others.",
            observation: "Region 1 is open on the board.",
          },
        ],
      },
      "Just war",
    );
    expect(full && partial).toBeTruthy();
    if (!full || !partial) return;
    const closed = advanceSessionBranchModel(partial, { toId: "r1", fromId: "root" });
    const grafted = graftSessionBranchModel(closed, full);
    expect(grafted.step).toBe(closed.step);
    expect(grafted.focusId).toBe(closed.focusId);
    expect(sessionBranchById(grafted, "r1")?.status).toBe("open");
    expect(sessionBranchById(grafted, "r2")?.status).toBe("open");
    expect(grafted.boardNotes.some((note) => note.key === "r2" && note.text.includes("Region 2"))).toBe(true);
    expect(grafted.boardNotes.some((note) => note.key === "r1-a1")).toBe(true);
    expect(graftSessionBranchModel(grafted, full)).toBe(grafted);

    const grown = adoptSessionBranchGrowth(
      { status: "ready", model: closed, birth: partial, error: null },
      full,
      full,
    );
    expect(grown.model.step).toBe(closed.step);
    expect(grown.birth).toBe(full);
    expect(grown.model.branches.length).toBe(full.branches.length);
    expect(grown.model.boardNotes.some((note) => note.key === "r6-a4-q3")).toBe(true);
  });

  it("places observations that arrive before any action is pressed", () => {
    const opening = normalizeSessionBranchModel(
      {
        premise: "The premise is on the board.",
        regions: [
          {
            title: "Region one",
            territory: "The first territory.",
            observation: "Region one is open.",
          },
        ],
      },
      "Just war",
    );
    const later = normalizeSessionBranchModel(
      {
        premise: "The premise is on the board.",
        regions: [
          {
            title: "Region one",
            territory: "The first territory.",
            observation: "Region one is open.",
            avenues: [
              {
                title: "Avenue one",
                territory: "Still ahead.",
                observation: "Avenue one arrived while the session was open.",
                inquiries: [
                  {
                    title: "Inquiry one",
                    territory: "Further ahead.",
                    observation: "Inquiry one arrived with the avenue.",
                  },
                ],
              },
            ],
          },
          {
            title: "Region two",
            territory: "The second territory.",
            observation: "Region two arrived after the opening.",
          },
        ],
      },
      "Just war",
    );
    expect(opening && later).toBeTruthy();
    if (!opening || !later) return;
    const adopted = adoptSessionBranchGrowth(
      { status: "ready", model: opening, birth: opening, error: null },
      later,
      later,
    );
    expect(adopted.model.step).toBe(0);
    expect(adopted.model.boardNotes.map((note) => note.key)).toEqual([
      "root",
      "r1",
      "r1-a1",
      "r1-a1-q1",
      "r2",
    ]);
    const already = appendSessionBranchNotes([], opening.boardNotes);
    const placed = appendSessionBranchNotes(already.elements, adopted.model.boardNotes);
    expect(
      placed.added
        .filter((element) => element.customData?.boardInstructionNote === "body")
        .map((element) => element.customData?.sessionBranchNote),
    ).toEqual(["r1-a1", "r1-a1-q1", "r2"]);

    const moved = advanceSessionBranchModel(opening, { toId: "r1", fromId: "root" });
    const grafted = graftSessionBranchModel(moved, later);
    expect(grafted.step).toBe(1);
    expect(sessionBranchById(grafted, "r1-a1")?.status).toBe("latent");
    expect(grafted.boardNotes.some((note) => note.text === "Avenue one arrived while the session was open.")).toBe(true);
    expect(grafted.boardNotes.some((note) => note.text === "Inquiry one arrived with the avenue.")).toBe(true);
    expect(grafted.boardNotes.some((note) => note.text === "Region two arrived after the opening.")).toBe(true);
  });

  it("places each observation once, as a note, in two columns", () => {
    const first = appendSessionBranchNotes([], [
      { key: "root", text: "The premise is on the board." },
      { key: "r1", text: "The first region is on the board." },
      { key: "r2", text: "The second region is on the board." },
    ]);
    const notes = first.added.filter((element) => element.customData?.boardInstructionNote === "body");
    expect(notes).toHaveLength(3);
    expect(notes[0]?.x).toBe(80);
    expect(notes[1]?.x).toBe(420);
    expect(notes[2]?.y).toBe(80 + 280);
    expect(notes[0]?.customData?.sessionBranchNote).toBe("root");
    expect(notes[0]?.backgroundColor).not.toBe("transparent");
    expect(first.added.some((element) => element.originalText === "Work")).toBe(true);
    const again = appendSessionBranchNotes(first.elements, [
      { key: "root", text: "The premise is on the board." },
      { key: "r3", text: "A new region opens." },
    ]);
    expect(
      again.added
        .filter((element) => element.customData?.boardInstructionNote === "body")
        .map((element) => element.customData?.sessionBranchNote),
    ).toEqual(["r3"]);
    expect(withoutSessionBranchNotes(again.elements).some((element) => element.customData?.sessionBranchNote)).toBe(
      false,
    );
  });

  it("does not paint prepared-field observations when a session opens", () => {
    const canvas = readFileSync(join(process.cwd(), "components/ExcalidrawCanvas.tsx"), "utf8");
    expect(canvas).not.toContain("appendSessionBranchNotes");
    expect(canvas).toContain("withoutSessionBranchNotes");
  });

  it("asks for a wide field rather than a short maze", () => {
    const prompt = sessionBranchModelPrompt({
      chapterTitle: "Just war",
      chapterBrief: "When is a war permitted?",
    });
    expect(prompt).toContain("between 2 and 8 hidden states");
    expect(prompt).toContain("not a short quiz");
    expect(prompt).toContain("three-step maze");
    expect(prompt).toContain("genuine question");
    expect(prompt).toContain("Never wrap the title");
    expect(prompt).toContain("edgePrice");
    expect(SESSION_BRANCH_ACCEPT_COUNT).toBe(8);
  });

  it("assembles a staged reply into one field", () => {
    const draft = assembleSessionBranchDraft({
      root: { premise: "A war can be wrong even when the cause is serious." },
      regions: [{ title: "Just cause", question: "What injury has to be named?", territory: "The injury has to be named.", observation: "The cause is the first region." }],
      avenues: [{ region: 1, title: "Civilian harm", question: "Who is harmed, and how?", territory: "Harm is one avenue.", observation: "Harm is still ahead." }],
      inquiries: [{ region: 1, avenue: 1, title: "Who counts", question: "Who counts as a civilian here?", territory: "The count goes further.", observation: "The count is still ahead." }],
    });
    const model = normalizeSessionBranchModel(draft, "Just war");
    expect(model?.branches.map((branch) => branch.id)).toEqual(["root", "r1", "r1-a1", "r1-a1-q1"]);
    expect(sessionBranchById(model!, "r1-a1")?.status).toBe("latent");
  });

  it("splits avenue and inquiry generation so one reply stays small", () => {
    const avenues = planSessionBranchAvenueCalls(6, 4);
    expect(avenues).toHaveLength(6);
    expect(Math.max(...avenues.map((call) => call.expected))).toBe(4);
    const inquiries = planSessionBranchInquiryCalls(6, 4, 3, 2);
    expect(inquiries).toHaveLength(12);
    expect(Math.max(...inquiries.map((call) => call.expected))).toBe(6);
    expect(inquiries.every((call) => call.avenueCount <= 2)).toBe(true);
  });

  it("runs field slices with a concurrency cap and keeps their order", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return item;
    });
    expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("shows prices on the actions and the whole field in the policy", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    const field = renderToStaticMarkup(
      createElement(SessionBranchFieldView, {
        slot: { status: "ready", model, error: null },
      }),
    );
    expect(field).toContain("103 branches");
    expect(field).toContain('data-session-branch-state="latent"');
    expect(field).toContain("Ahead");
    expect(field).toContain("r1 12");
    expect(renderToStaticMarkup(createElement(SessionBranchFieldView, { slot: { status: "idle", model: null, error: null } }))).toBe("");
    expect(renderToStaticMarkup(createElement(SessionBranchFieldView, { slot: null }))).toBe("");
  });

  it("hides prices and the lowest-cost mark outside Learn", () => {
    const model = normalizeSessionBranchModel(fieldDraft(), "Just war");
    expect(model).toBeTruthy();
    if (!model) return;
    const field = renderToStaticMarkup(
      createElement(SessionBranchFieldView, {
        slot: { status: "ready", model, error: null },
        showPrices: false,
      }),
    );
    expect(field).toContain("103 branches");
    expect(field).not.toContain("r1 12");
    expect(field).not.toContain("data-session-branch-prices");
  });
});
