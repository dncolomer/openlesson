/**
 * TAP Learning Work chrome: no I'm done answering on chapter/PiP; session turn close;
 * expense slider beside aesthetics/map type; Work/PoW visualization.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SessionTopicCard, sessionSidebarTopic } from "@/components/session-view/learn-work-dock-bar";
import { ileBlockSessionFrame } from "@/lib/learn-canvas-session";
import { resolveBlockMapGlyph } from "@/lib/block-map-glyph";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { ILE_END_TURN_LABEL, ILE_SUBMIT_TURN_LABEL } from "@/lib/learn-pow-spend";
import {
  aestheticImageForId,
  assignIleWorkAestheticImages,
  ileChapterAestheticIds,
  parseIleWorkAestheticStored,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";
import { ileTabUnfocusPowFromFocusEvent, ILE_TAB_UNFOCUS_TOOL_ACTION } from "@/lib/learn-thought-traces";
import {
  SESSION_SIDEBAR_COLLAPSED_REM,
  SESSION_SIDEBAR_EXPANDED_REM,
} from "@/lib/session-sidebar";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a4905160ec41/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("assignIleWorkAestheticImages", () => {
  it("keeps existing picks and assigns unused images to new Work ids", () => {
    const pool = ["/a.jpg", "/b.jpg", "/c.jpg"];
    const first = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      images: pool,
      random: () => 0,
    });
    expect(first["ch-a"]).toBe("/a.jpg");
    const second = assignIleWorkAestheticImages({
      ids: ["ch-a", "ch-b"],
      current: first,
      images: pool,
      random: () => 0,
    });
    expect(second["ch-a"]).toBe("/a.jpg");
    expect(second["ch-b"]).toBe("/b.jpg");
    const dropped = assignIleWorkAestheticImages({
      ids: ["ch-b"],
      current: second,
      images: pool,
      random: () => 0,
    });
    expect(dropped).toEqual({ "ch-b": "/b.jpg" });
  });
});

describe("resolveIleWorkAestheticImage", () => {
  it("uses the session-lived assigned still, else a stable per-id pick", () => {
    const pool = ["/a.jpg", "/b.jpg", "/c.jpg"];
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-a",
        assigned: "/b.jpg",
        images: pool,
      }),
    ).toBe("/b.jpg");
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-a",
        images: pool,
      }),
    ).toBe(aestheticImageForId("ch-a", pool));
    expect(
      resolveIleWorkAestheticImage({
        id: "ch-b",
        assigned: "  ",
        images: pool,
      }),
    ).toBe(aestheticImageForId("ch-b", pool));

    const firstVisit = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      images: pool,
    });
    expect(firstVisit["ch-a"]).toBe(aestheticImageForId("ch-a", pool));
    const stored = JSON.stringify(firstVisit);
    const parsed = parseIleWorkAestheticStored(stored);
    const remount = assignIleWorkAestheticImages({
      ids: ["ch-a"],
      current: parsed,
      images: pool,
    });
    expect(remount["ch-a"]).toBe(firstVisit["ch-a"]);
    expect(remount["ch-a"]).toBeTruthy();
  });
});

describe("ileChapterAestheticIds", () => {
  it("locks the bar still to the same pick Work will use", () => {
    const pool = ["/a.jpg", "/b.jpg", "/c.jpg"];
    expect(
      ileChapterAestheticIds({
        stepIds: ["ch-a", "ch-b"],
        openWorkIds: [],
        selectedId: "ch-b",
      }),
    ).toEqual(["ch-a", "ch-b"]);
    const preview = assignIleWorkAestheticImages({
      ids: ileChapterAestheticIds({
        stepIds: ["ch-a", "ch-b"],
        selectedId: "ch-b",
      }),
      images: pool,
    });
    const bar = resolveIleWorkAestheticImage({
      id: "ch-b",
      assigned: preview["ch-b"],
      images: pool,
    });
    const afterWork = assignIleWorkAestheticImages({
      ids: ileChapterAestheticIds({
        stepIds: ["ch-a", "ch-b"],
        openWorkIds: ["ch-b"],
      }),
      current: preview,
      images: pool,
    });
    expect(afterWork["ch-b"]).toBe(bar);
    expect(afterWork["ch-a"]).toBe(preview["ch-a"]);
  });
});

describe("TAP Learning tab unfocus PoW (shipped)", () => {
  it("visibilitychange hidden and blur produce a stable tab_unfocus action", () => {
    const hidden = ileTabUnfocusPowFromFocusEvent({
      type: "visibilitychange",
      hidden: true,
      sessionId: "s1",
      workspaceId: "w1",
    });
    expect(hidden?.toolAction).toBe(ILE_TAB_UNFOCUS_TOOL_ACTION);
    expect(hidden?.toolAction).toBe("tab_unfocus");
    expect(hidden?.reason).toBe("tab_hidden");

    const visible = ileTabUnfocusPowFromFocusEvent({
      type: "visibilitychange",
      hidden: false,
    });
    expect(visible).toBeNull();

    const blur = ileTabUnfocusPowFromFocusEvent({ type: "blur" });
    expect(blur?.toolAction).toBe("tab_unfocus");
    expect(blur?.reason).toBe("window_blur");

    const speech = read("components/session-view/use-session-speech.ts");
    expect(speech).toContain("ileTabUnfocusPowFromFocusEvent");
    expect(speech).toContain("visibilitychange");
    expect(speech).toContain('addEventListener("blur"');
  });
});

describe("one current chapter", () => {
  it("uses the plan frame for the card and the seeded prompt", () => {
    const steps = [
      { id: "ch-1", description: "Prompt one", map_keyword: "One" },
      { id: "ch-2", description: "Prompt two", map_keyword: "Two" },
      { id: "ch-3", description: "Prompt three", map_keyword: "Three" },
    ];
    const frame = ileBlockSessionFrame({ steps, currentStepIndex: 2 });
    expect(frame).toEqual({ index: 2, id: "ch-3", prompt: "Prompt three" });
    expect(ileBlockSessionFrame(null)).toBeNull();
    const openIds = frame ? [frame.id] : [];
    expect(openIds).toEqual(["ch-3"]);
    const step = steps[frame?.index ?? 0]!;
    const card = sessionSidebarTopic([
      {
        id: openIds[0],
        label: `Ch ${(frame?.index ?? 0) + 1}`,
        keyword: resolveBlockMapGlyph({
          map_keyword: step.map_keyword,
          title: step.description,
        }).keyword,
        focused: openIds[0] === step.id,
      },
    ]);
    expect(card.id).toBe("ch-3");
    expect(card.title).toBe("Three");
    expect(frame?.prompt).toBe(step.description);
    expect(card.id).not.toBe(steps[0]?.id);
    const view = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    const field = readFileSync(join(ROOT, "components/session-view/use-session-field.ts"), "utf8");
    const hook = readFileSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"), "utf8");
    expect(view).toContain("ileBlockSessionFrame(sessionPlan)");
    expect(field).toContain("seedChapterWorkCanvas(boardId, text)");
    expect(view).not.toContain("heliosWidgetOpen");
    expect(view).not.toContain("seedChapterWorkCanvas(blockFrame.id, text)");
    expect(view).not.toContain("ileBlockSessionChapter(sessionPlan?.steps, activeChapterIndex)");
    expect(hook).toContain("const frame = ileBlockSessionFrame(sessionPlan)");
    expect(hook).toContain("const activeChapterKey = frame?.id ?? sessionId ?? null");
    expect(hook).not.toContain("setActiveChapterIndex(");
    expect(hook).not.toContain("`step-${activeChapterIndex}`");
    expect(hook).not.toContain("planInitializedRef");
  });
});

describe("session topic card", () => {
  it("keeps the focused chapter and draws one static card", () => {
    const topic = sessionSidebarTopic([
      { id: "ch-a", label: "Chapter A", keyword: "alpha", focused: true },
      { id: "ch-b", label: "Chapter B", keyword: "beta" },
      { id: "ch-c", label: "Chapter C", keyword: "gamma" },
    ]);
    expect(topic.id).toBe("ch-a");
    expect(topic.title).toBe("alpha");
    const html = renderToStaticMarkup(
      createElement(SessionTopicCard, {
        id: topic.id,
        title: topic.title,
        customUrls: ["https://example.com/still.jpg"],
      }),
    );
    expect(html).not.toContain("data-ile-chapter-dock-chapters");
    expect(html).not.toContain("grid-cols-2");
    expect(html.match(/<button/g) ?? []).toHaveLength(0);
    expect(html).not.toContain("data-session-topic-card-media");
    expect(html).not.toContain(">Loop<");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("w-[7rem]");
    expect(html.match(/data-session-topic-card=/g)).toHaveLength(1);
    expect(html).toContain('data-session-topic-card="ch-a"');
    expect(html).toContain("alpha");
    expect(html).not.toContain('data-session-topic-card="ch-b"');
    expect(html).toContain("w-full min-w-0");
  });
});

