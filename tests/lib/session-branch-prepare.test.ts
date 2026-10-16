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
      catalogSize: 4,
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
      catalogSize: 4,
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

  it("puts catalog size on every prepare request so 4/8/16 reach field prep", () => {
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Learn",
          sessionId: "session-1",
          catalogSize: 8,
        }),
      ),
    ).toMatchObject({ catalogSize: 8, sessionId: "session-1" });
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Calibration",
          calibrationToken: "cal-token",
          catalogSize: 16,
        }),
      ),
    ).toMatchObject({ catalogSize: 16, calibrationToken: "cal-token" });
    expect(
      sessionBranchPrepareRequest(
        planSessionBranchPrepare({
          chapterTitle: "Verification",
          verificationToken: "ver-token",
          catalogSize: 8,
        }),
      ),
    ).toMatchObject({ catalogSize: 8, verificationToken: "ver-token" });
    expect(calibrateFieldPrepareInput({ topicText: "Seed", catalogSize: 16 }).catalogSize).toBe(16);
    expect(verificationFieldPrepareInput({ workspaceTitle: "W", catalogSize: 8 }).catalogSize).toBe(8);
    expect(
      learnSessionFieldInput({
        sessionId: "s",
        problem: "P",
        plan: { steps: [{ id: "chapter-1", description: "C" }], currentStepIndex: 0 },
        catalogSize: 8,
      })?.catalogSize,
    ).toBe(8);
    const route = read("app/api/ile/session-branch-model/route.ts");
    expect(route).toContain("resolveCatalogSize");
    expect(route).toContain("generateSessionBranchOpening");
    expect(read("lib/session-branch-model-generate.ts")).toContain("catalogSize");
    expect(read("components/CalibrationFlowRunner.tsx")).toContain("catalogSize:");
    expect(read("components/scout-tap/ScoutTapClient.tsx")).toContain("catalogSize");
    expect(read("components/VerificationFlowRunner.tsx")).toContain("actionCatalog");
  });

  it("prepares the field for Calibrate and Verification, and leaves conversational TAP alone", () => {
    const calibrate = read("components/scout-tap/ScoutTapClient.tsx");
    const publicCalibrate = read("components/CalibrationFlowRunner.tsx");
    const verification = read("components/tap-score/tap-score-phases.tsx");
    const learn = read("components/session-view/session-chapter-canvas.tsx");
    const route = read("app/api/ile/session-branch-model/route.ts");
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
