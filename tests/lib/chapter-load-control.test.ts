/**
 * Chapter-map load control: active chapter stays enabled and reads re-load.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHAPTER_LOAD_LABEL,
  CHAPTER_LOAD_LABEL_KEY,
  CHAPTER_RELOAD_LABEL,
  CHAPTER_RELOAD_LABEL_KEY,
  chapterLoadControlEnglishLabel,
  resolveChapterLoadControl,
  shouldAllowChapterLoadClick,
} from "@/lib/chapter-load-control";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ac7d1d920d1e/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("resolveChapterLoadControl (shipped helper)", () => {
  it("active chapter stays enabled with re-load label; other chapters stay Load chapter; in-flight still disables", () => {
    const active = resolveChapterLoadControl({
      selectedIndex: 1,
      activeChapterIndex: 1,
    });
    expect(active.disabled).toBe(false);
    expect(active.isActiveChapter).toBe(true);
    expect(active.labelKey).toBe(CHAPTER_RELOAD_LABEL_KEY);
    expect(chapterLoadControlEnglishLabel(active.isActiveChapter)).toBe(CHAPTER_RELOAD_LABEL);
    expect(CHAPTER_RELOAD_LABEL).toBe("Reload Chapter");

    const other = resolveChapterLoadControl({
      selectedIndex: 0,
      activeChapterIndex: 1,
    });
    expect(other.disabled).toBe(false);
    expect(other.isActiveChapter).toBe(false);
    expect(other.labelKey).toBe(CHAPTER_LOAD_LABEL_KEY);
    expect(chapterLoadControlEnglishLabel(other.isActiveChapter)).toBe(CHAPTER_LOAD_LABEL);
    expect(CHAPTER_LOAD_LABEL).toBe("Load chapter");

    const inFlightActive = resolveChapterLoadControl({
      selectedIndex: 1,
      activeChapterIndex: 1,
      loadingChapterIndex: 1,
    });
    expect(inFlightActive.disabled).toBe(true);
    expect(inFlightActive.isActiveChapter).toBe(true);
    expect(inFlightActive.labelKey).toBe(CHAPTER_RELOAD_LABEL_KEY);

    const inFlightOther = resolveChapterLoadControl({
      selectedIndex: 2,
      activeChapterIndex: 0,
      loadingChapterIndex: 2,
    });
    expect(inFlightOther.disabled).toBe(true);
    expect(inFlightOther.isActiveChapter).toBe(false);
    expect(inFlightOther.labelKey).toBe(CHAPTER_LOAD_LABEL_KEY);

    expect(shouldAllowChapterLoadClick({ chapterLoading: false })).toBe(true);
    expect(shouldAllowChapterLoadClick({ chapterLoading: true })).toBe(false);

    const en = JSON.parse(read("messages/en.json")) as {
      chapterMap: { loadChapter: string; reloadChapter: string };
    };
    expect(en.chapterMap.loadChapter).toBe(CHAPTER_LOAD_LABEL);
    expect(en.chapterMap.reloadChapter).toBe(CHAPTER_RELOAD_LABEL);

    writeScratch(
      "reload-chapter-helper.txt",
      [
        `active=${active.disabled}/${active.labelKey}/${chapterLoadControlEnglishLabel(true)}`,
        `other=${other.disabled}/${other.labelKey}/${chapterLoadControlEnglishLabel(false)}`,
        `inFlightActive=${inFlightActive.disabled}`,
        `inFlightOther=${inFlightOther.disabled}`,
      ].join("\n"),
    );
  });
});

describe("chapter-map load control wiring (shipped source)", () => {
  it("panel keeps the load button enabled on the active chapter and still calls onLoadChapter", () => {
    const panel = read("components/ChapterMapPanel.tsx");
    const view = readSessionViewSurface();

    expect(panel).toContain("resolveChapterLoadControl");
    expect(panel).toContain("loadControl.disabled");
    expect(panel).toContain("loadControl.isActiveChapter");
    expect(panel).toContain('t("chapterMap.reloadChapter")');
    expect(panel).toContain('t("chapterMap.loadChapter")');
    expect(panel).toContain("onClick={() => onLoadChapter(selectedIndex)}");
    expect(panel).not.toContain("selectedIndex === activeChapterIndex || loadingChapterIndex");
    expect(view).toContain("onLoadChapter={handleLoadChapter}");
    expect(view).toContain("shouldAllowChapterLoadClick");
    expect(view).not.toContain("if (index === activeChapterIndex) return");
    expect(view).toContain("buildIleChapterLoadPowToolData");
    expect(view).toContain('toolAction = isReload ? "chapter_reload" : "chapter_load"');
    expect(view).toContain("persistPlanSteps(updatedPlan, { toolAction, toolData })");
    expect(view).toContain("setChapterReloadNonce");
    expect(view).toContain("postIleSessionChat");

    writeScratch(
      "reload-chapter-excerpts.txt",
      [
        `activeLabel=${CHAPTER_RELOAD_LABEL}`,
        `otherLabel=${CHAPTER_LOAD_LABEL}`,
        "disabled=in-flight only (active chapter stays enabled)",
        "ChapterMapPanel: loadControl.disabled + onLoadChapter(selectedIndex)",
        "SessionView: onLoadChapter={handleLoadChapter}",
      ].join("\n"),
    );
  });
});
