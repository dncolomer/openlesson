import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import { openSessionBranchQuestions, type SessionBranchModel } from "@/lib/session-branch-model";
import { sessionSidebarTopic } from "@/components/session-view/learn-work-dock-bar";
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

  it("keeps Learn on the session route and sends the block seed id", () => {
    const learn = learnSessionFieldInput({
      sessionId: "session-1",
      problem: "A cause",
      ileToken: "ile",
      metadata: { workspace_id: "ws-1", block_id: "block-1" },
    });
    expect(learn?.blockId).toBe("block-1");
    expect(learn?.workspaceId).toBe("ws-1");
    const plan = planSessionBranchPrepare(learn);
    expect(plan.kind).toBe("learn");
    if (plan.kind !== "learn") return;
    expect(plan.blockId).toBe("block-1");
    expect(sessionBranchPrepareRequest(plan)).toMatchObject({
      sessionId: "session-1",
      blockId: "block-1",
      workspaceId: "ws-1",
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
      ileToken: "ile",
      fallbackTitle: "Fallback",
    });
    expect(learn?.chapterTitle).toBe("A cause");
    expect(learn?.chapterBrief).toBe("A cause");
    expect(learn?.scope).toBe("session-1");
    expect(sessionBranchPrepareRequest(planSessionBranchPrepare(learn))).toMatchObject({
      sessionId: "session-1",
      ileToken: "ile",
      chapterTitle: "A cause",
    });
    expect(
      learnSessionFieldInput({
        sessionId: "session-1",
        problem: "A cause",
      }),
    ).toMatchObject({
      chapterTitle: "A cause",
      chapterBrief: "A cause",
      scope: "session-1",
    });
    expect(learnSessionFieldInput({ sessionId: "session-1" })).toBeNull();
    expect(
      learnSessionFieldInput({
        sessionId: "session-1",
        fallbackTitle: "Fallback",
      }),
    ).toMatchObject({ chapterTitle: "Fallback" });
    expect(learnSessionFieldInput({ problem: "A cause" })).toBeNull();
    expect(read("components/session-view/use-session-phase.ts")).not.toContain(
      "fallbackTitle",
    );
    expect(read("components/SessionView.tsx")).not.toContain("fallbackTitle");
    expect(
      sessionSidebarTopic([
        {
          id: "chapter-1",
          keyword: "Just war",
          description: "A cause can fail.",
          focused: true,
        },
      ]).title,
    ).toBe("A cause can fail.");

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

  it("prepares Learn, Calibrate, and Verify without an action catalog size", () => {
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Learn",
          sessionId: "session-1",
        }),
      ),
    ).toMatchObject({ sessionId: "session-1" });
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Learn",
          sessionId: "session-1",
        }),
      ),
    ).not.toHaveProperty("catalogSize");
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Calibration",
          calibrationToken: "cal-token",
        }),
      ),
    ).toMatchObject({ calibrationToken: "cal-token" });
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Verification",
          verificationToken: "ver-token",
        }),
      ),
    ).toMatchObject({ verificationToken: "ver-token" });
    expect(calibrateFieldPrepareInput({ topicText: "Seed" })).not.toHaveProperty("catalogSize");
    expect(verificationFieldPrepareInput({ workspaceTitle: "W" })).not.toHaveProperty("catalogSize");
    expect(
      learnSessionFieldInput({
        sessionId: "s",
        problem: "P",
      }),
    ).not.toHaveProperty("catalogSize");
    const route = read("app/api/learn/session-branch-model/route.ts");
    expect(route).not.toContain("resolveCatalogSize");
    expect(route).toContain("generateSessionBranchOpening");
    expect(read("components/session-view/use-session-phase.ts")).not.toContain(
      "session-plan/create",
    );
    expect(read("components/session-view/use-session-phase.ts")).not.toContain(
      "session-plan/translate",
    );
    expect(read("lib/session-branch-model-generate.ts")).not.toContain("catalogSize");
    expect(read("lib/session-branch-model-generate.ts")).toContain("SESSION_BRANCH_CHILD_MIN");
    expect(read("lib/session-branch-model-generate.ts")).toContain("SESSION_BRANCH_CHILD_MAX");
  });

  it("prepares the field for Calibrate and Verification, and leaves conversational TAP alone", () => {
    const calibrate = read("components/scout-tap/ScoutTapClient.tsx");
    const publicCalibrate = read("components/CalibrationFlowRunner.tsx");
    const verification = read("components/tap-score/tap-score-phases.tsx");
    const learn = read("components/session-view/session-chapter-canvas.tsx");
    const route = read("app/api/learn/session-branch-model/route.ts");
    const prompt = read("components/excalidraw-canvas/canvas-prompt-bar.tsx");
    expect(calibrate).toContain("calibrateFieldPrepareInput");
    expect(calibrate).toContain("loadSessionBranchField");
    expect(publicCalibrate).toContain("calibrateFieldPrepareInput");
    expect(publicCalibrate).toContain("calibrationToken");
    expect(verification).toContain('enabled={sidebarMode === "verification-tap"}');
    expect(verification).toContain('<SessionGuidePanel guide="verification" remainingSeconds={remainingSeconds} />');
    expect(verification).not.toContain("policyTab");
    expect(verification).toContain("verificationToken");
    expect(learn).toContain("useSessionBranchField");
    expect(route).toContain("getCalibrationFlowByToken");
    expect(route).toContain("getVerificationFlowByToken");
    expect(route).toContain("resolveTapSessionAccess");
    expect(route).toContain("guardSessionRoute");
    expect(prompt).toContain("listKey: sessionMarkListKey ?? null");
    expect(prompt).toContain("usePublishSessionCanvasCommands");
    expect(prompt).toContain("publishCommands(null)");
    expect(prompt).not.toContain("<SessionMarkControls");
    expect(read("components/ExcalidrawCanvas.tsx")).toContain("openSessionBranchQuestions");
  });

  it("keeps the prepared field off the sidebar tabs", () => {
    const sidebar = read("components/session-view/session-sidebar.tsx");
    expect(sidebar).not.toContain("data-session-policy-tab");
    expect(sidebar).not.toContain("data-session-assert-tab");
    expect(sidebar).not.toContain("SessionAssertGraph");
    expect(sidebar).not.toContain("SessionPolicyPanel");
    const focus = createElement("div", null, "Step body");
    const withField = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "verification-tap",
        focus,
        focusLabel: "Stash",
      }),
    );
    expect(withField).toContain("Step body");
    expect(withField).toContain(">Stash<");
    expect(withField).not.toContain("data-session-policy-tab");
    expect(withField).not.toContain("data-session-assert-tab");
    expect(withField).not.toContain(">policy<");
    expect(withField).not.toContain(">assert<");
    const conversational = renderToStaticMarkup(
      createElement(SessionSidebar, {
        mode: "tap",
        focus,
        focusLabel: "Stash",
      }),
    );
    expect(conversational).toContain("Step body");
    expect(conversational).not.toContain("data-session-policy-tab");
    expect(conversational).not.toContain("data-session-assert-tab");
  });
});
