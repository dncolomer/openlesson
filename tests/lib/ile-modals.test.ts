/**
 * ILE modals share DialogFrame / ConfirmDialog: portaled, screen-centered,
 * same overlay + panel chrome.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ile-modals/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

const CUSTOM_CENTERED_OVERLAY =
  /className="fixed inset-0 z-\S+ flex items-center justify-center/;

describe("ILE modals share DialogFrame / ConfirmDialog", () => {
  it("DialogFrame is the portaled centered overlay; ConfirmDialog uses it", () => {
    const frame = read("components/ui/DialogFrame.tsx");
    const confirm = read("components/ui/ConfirmDialog.tsx");

    expect(frame).toContain("fixed inset-0 z-[200] flex items-center justify-center");
    expect(frame).toContain("bg-black/70 backdrop-blur-md");
    expect(frame).toContain("bg-neutral-900 border border-neutral-800 rounded-none");
    expect(frame).toContain("createPortal");
    expect(frame).toContain('data-dialog-frame=""');
    expect(frame).toContain('role="dialog"');
    expect(frame).toContain('aria-modal="true"');
    expect(frame).toContain("max-w-md");
    expect(frame).toContain("max-w-lg");
    expect(frame).toContain("max-w-5xl");

    expect(confirm).toContain('from "@/components/ui/DialogFrame"');
    expect(confirm).toContain("<DialogFrame");
    expect(confirm).not.toContain("createPortal");
    expect(confirm).not.toMatch(CUSTOM_CENTERED_OVERLAY);
  });

  it("ILE welcome, thought edit, chapter edit, and chrome confirms all use the shell", () => {
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    const thought = read("components/thought-ui/ThoughtEditPanel.tsx");
    const ring = read("components/block-skill-grid/block-circular-menu.tsx");
    const chrome = read("components/session-view/session-chrome.tsx");
    const chapter = read("components/ChapterMapPanel.tsx");
    const helios = read("components/SessionHeliosPanel.tsx");
    const view = readSessionViewSurface();

    expect(welcome).toContain('from "@/components/ui/DialogFrame"');
    expect(welcome).toContain("<DialogFrame");
    expect(welcome).toContain('testId="session-welcome-modal"');
    expect(welcome).toContain("size=\"xl\"");
    expect(welcome).not.toMatch(CUSTOM_CENTERED_OVERLAY);

    expect(thought).toContain('from "@/components/ui/ConfirmDialog"');
    expect(thought).toContain("<ConfirmDialog");
    expect(thought).toContain('testId="thought-edit-panel"');
    expect(thought).toContain("<textarea");
    expect(thought).toContain("submitLabel");
    expect(thought).toContain("onSend");
    expect(thought).not.toMatch(CUSTOM_CENTERED_OVERLAY);

    expect(ring).toContain("<ConfirmDialog");
    expect(ring).toContain('testId="block-circular-edit"');
    expect(helios).toContain("ThoughtEditPanel");
    expect(chapter).toContain("BlockCircularEditForm");
    expect(chapter).not.toContain("closeReviewBlocked");
    expect(chapter).not.toContain("data-ile-chapter-close-blocked");
    expect(chapter).not.toContain("data-ile-close-override");
    expect(chapter).not.toMatch(CUSTOM_CENTERED_OVERLAY);
    expect(chapter).not.toContain("absolute inset-0 z-40 flex items-start justify-center");

    expect(chrome).toContain("<ConfirmDialog");
    expect(chrome).toContain("showEndDialog");
    expect(chrome).toContain("showPlanCompleteModal");
    expect(chrome).toContain("data-ile-gather-warning");
    expect(chrome).toContain("data-ile-chapter-close-blocked");
    expect(chrome).toContain('t("chapterMap.closeBlockedTitle")');
    expect(chrome).toContain('t("chapterMap.closeOverride")');
    expect(chrome).toContain('testId="ile-close-override"');
    expect(view).toContain("closeReviewBlocked={Boolean(chapterCloseReview && !chapterCloseReview.canClose)}");
    expect(view).toContain("onDismissCloseReview={() => setChapterCloseReview(null)}");
    expect(view).toContain("onChapterDoneOverride={() => {");

    writeScratch(
      "ile-modals.txt",
      [
        "DialogFrame=portaled z-[200] centered overlay",
        "ConfirmDialog=DialogFrame",
        "welcome=DialogFrame xl",
        "thought-edit=ConfirmDialog",
        "block-edit=ConfirmDialog",
        "end/plan/gather/close=session-chrome ConfirmDialog",
      ].join("\n"),
    );
  });
});
