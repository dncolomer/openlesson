import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import { openSessionBranchQuestions, type SessionBranchModel } from "@/lib/session-branch-model";
import {
  calibrateFieldPrepareInput,
  learnSessionFieldInput,
  planSessionBranchPrepare,
  sessionBranchPrepareRequest,
  verificationFieldPrepareInput,
} from "@/lib/session-branch-prepare";

const ROOT = join(__dirname, "../..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("session branch prepare", () => {
  it("sends Learn through the owned session", () => {
    const plan = planSessionBranchPrepare({
      chapterTitle: "Just war",
      chapterBrief: "A cause can fail.",
      sessionId: "session-1",
      ileToken: "ile",
    });
    expect(plan.kind).toBe("learn");
    expect(sessionBranchPrepareRequest(plan)).toEqual({
      chapterTitle: "Just war",
      chapterBrief: "A cause can fail.",
      sessionId: "session-1",
      ileToken: "ile",
    });
  });

  it("uses a public flow token when the live surface has no workspace", () => {
    expect(
      planSessionBranchPrepare({
        chapterTitle: "Calibration",
        calibrationToken: "cal-token",
        tapSessionId: "local-canvas",
      }).kind,
    ).toBe("calibration");
    expect(
      planSessionBranchPrepare({
        chapterTitle: "Verification",
        verificationToken: "ver-token",
        tapSessionId: "local-canvas",
      }).kind,
    ).toBe("verification");
    const request = sessionBranchPrepareRequest(
      planSessionBranchPrepare({
        chapterTitle: "Verification",
        verificationToken: "ver-token",
      }),
    );
    expect(request).toEqual({
      chapterTitle: "Verification",
      chapterBrief: "",
      verificationToken: "ver-token",
    });
    expect(request).not.toHaveProperty("sessionId");
  });

  it("keeps a workspace session on the TAP access path", () => {
    const plan = planSessionBranchPrepare({
      chapterTitle: "Topic",
      workspaceId: "workspace-1",
      sessionId: "focus-1",
      tapSessionId: "tap-1",
      verificationToken: "should-not-skip-ownership",
      entryQueryParams: { b: "2", a: "1" },
    });
    expect(plan.kind).toBe("workspace");
    if (plan.kind !== "workspace") return;
    expect(plan.entryQueryParams).toEqual({ a: "1", b: "2" });
    expect(sessionBranchPrepareRequest(plan)).toMatchObject({
      workspaceId: "workspace-1",
      sessionId: "focus-1",
      tapSessionId: "tap-1",
    });
    expect(sessionBranchPrepareRequest(plan)).not.toHaveProperty("verificationToken");
  });

  it("waits until there is material and a session", () => {
    expect(planSessionBranchPrepare({ sessionId: "session-1" }).kind).toBe("missing-material");
    expect(planSessionBranchPrepare({ chapterTitle: "Topic" }).kind).toBe("none");
    expect(
      planSessionBranchPrepare({ chapterTitle: "Topic", sessionId: "session-1", enabled: false }).kind,
    ).toBe("none");
    expect(sessionBranchPrepareRequest({ kind: "none" })).toBeNull();
  });

  it("keeps latent branches off the frozen list", () => {
    const questions = openSessionBranchQuestions({
      branches: [
        { id: "root", title: "Root", status: "open" },
        { id: "later", title: "Later", status: "latent" },
      ],
    } as SessionBranchModel);
    expect(questions).toEqual([{ id: "root", text: "Root" }]);
  });

  it("names the same field the tips screen and the live canvas share", () => {
    const learn = learnSessionFieldInput({
      sessionId: "session-1",
      problem: "A cause",
      plan: {
        steps: [{ id: "chapter-1", description: "Just war" }],
        currentStepIndex: 0,
      },
      ileToken: "ile",
      fallbackTitle: "Fallback",
    });
    expect(learn?.chapterTitle).toBe("Just war");
    expect(learn?.chapterBrief).toBe("A cause\n\nJust war");
    expect(learn?.scope).toBe("chapter-1");
    expect(sessionBranchPrepareRequest(planSessionBranchPrepare(learn))).toMatchObject({
      sessionId: "session-1",
      ileToken: "ile",
      chapterTitle: "Just war",
    });

    const calibrate = calibrateFieldPrepareInput({
      topicText: "Seed",
      topicId: "calibrate",
      questions: [{ text: "Seed" }, { text: "Why does it fail?" }],
      calibrationToken: "cal-token",
    });
    expect(calibrate.chapterTitle).toBe("Seed");
    expect(calibrate.chapterBrief).toBe("Seed\n\nWhy does it fail?");
    expect(calibrate.scope).toBe("calibrate");
    expect(planSessionBranchPrepare(calibrate).kind).toBe("calibration");

    const verification = verificationFieldPrepareInput({
      workspaceTitle: "Workspace",
      topics: [{ id: "q1", title: "Topic", openingQuestion: "Ask this." }],
      topicId: "q1",
      verificationToken: "ver-token",
    });
    expect(verification.chapterTitle).toBe("Topic");
    expect(verification.chapterBrief).toBe("Workspace\n\nTopic\n\nAsk this.");
    expect(verification.scope).toBe("q1");
    expect(planSessionBranchPrepare(verification).kind).toBe("verification");
  });

  it("prepares the field for Calibrate and Verification, and leaves conversational TAP alone", () => {
    const calibrate = read("components/calibrate/calibrate-live-surface.tsx");
    const verification = read("components/tap-score/tap-score-phases.tsx");
    const learn = read("components/session-view/session-chapter-canvas.tsx");
    const route = read("app/api/ile/session-branch-model/route.ts");
    const prompt = read("components/excalidraw-canvas/canvas-prompt-bar.tsx");
    expect(calibrate).toContain("SessionBranchFieldBoundary");
    expect(calibrate).toContain("policyTab");
    expect(calibrate).toContain("calibrationToken");
    expect(verification).toContain('enabled={sidebarMode === "verification-tap"}');
    expect(verification).toContain('policyTab={sidebarMode === "verification-tap"}');
    expect(verification).toContain("verificationToken");
    expect(learn).toContain("useSessionBranchField");
    expect(route).toContain("getCalibrationFlowByToken");
    expect(route).toContain("getVerificationFlowByToken");
    expect(route).toContain("resolveTapSessionAccess");
    expect(route).toContain("guardSessionRoute");
    expect(prompt).toContain("listKey: sessionMarkListKey ?? null");
    expect(prompt).not.toContain("<SessionMarkControls");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("openSessionBranchQuestions");
  });

  it("gives Calibrate and Verification the policy tab", () => {
    const focus = createElement("div", null, "Step body");
    const withField = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "verification-tap",
        policyTab: true,
        focus,
        focusLabel: "Stash",
      }),
    );
    expect(withField).toContain("data-session-policy-tab");
    expect(withField).toContain(">policy<");
    expect(withField).toContain("Step body");
    const conversational = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "tap",
        focus,
        focusLabel: "Stash",
      }),
    );
    expect(conversational).not.toContain("data-session-policy-tab");
  });
});
