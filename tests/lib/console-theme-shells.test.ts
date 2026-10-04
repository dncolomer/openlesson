/**
 * Shared shells use the session rail's black square console:
 * hairline frame, corner brackets, and a short mono label.
 * Copy and primary actions stay. Insight flags and the listening dot stay.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import { WorkspaceLoading } from "@/components/workspace-view/workspace-chrome";
import { ConsolePage } from "@/components/ui/console-frame";
import { ILE_WORK_CANVAS_STROKE_COLOR } from "@/lib/ile-work-canvas";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function expectConsoleChrome(html: string) {
  expect(html).toContain("border-white/40");
  expect(html).toContain("bg-black");
  expect(html).toContain("border-l");
  expect(html).toContain("border-t");
  expect(html).toContain("data-console-frame-label");
  expect(html).toContain("font-mono");
  expect(html).toContain("tracking-[0.28em]");
  expect(html).not.toMatch(/rounded-full/);
  expect(html).not.toMatch(/\b(bg|text|border)-(orange|rose|fuchsia|cyan|sky|indigo|violet|purple)-/);
  expect(html).not.toContain("14,116,144");
  expect(html).not.toMatch(/neon/i);
}

describe("console theme shells", () => {
  it("renders the Learn settings screen with the console frame and its confirm action", () => {
    const html = renderToStaticMarkup(
      createElement(SessionWelcomeModal, {
        t: (key: string) => key,
        languageConfirmed: false,
        planLoading: false,
        isPreparing: false,
        tutoringLanguage: "en",
        onTutoringLanguageChange: () => {},
        aestheticPackages: [],
        selectedAesthetic: undefined,
        selectedAestheticId: null,
        onSelectAesthetic: () => {},
        aestheticsLoading: false,
        chapterPlanStatus: "exists",
        regenerateChapters: false,
        onRegenerateChaptersChange: () => {},
        initialChapters: "standard",
        onInitialChaptersChange: () => {},
        autoAdvance: false,
        onToggleAutoAdvance: () => {},
        localInferenceEnabled: false,
        onToggleLocalInference: () => {},
        webGPUAvailable: false,
        planError: null,
        modelLoadError: null,
        modelLoadProgress: null,
        prepStage: "done",
        onConfirmSettings: () => {},
        onContinueWithoutInference: () => {},
        onReadyStart: () => {},
        hasSessionPlan: false,
      }),
    );
    expectConsoleChrome(html);
    expect(html).toContain("data-ile-session-settings");
    expect(html).toContain("session.welcomeTitle");
    expect(html).toContain("data-ile-confirm-settings");
    expect(html).toContain("session.confirmSettings");
  });

  it("renders a confirm pop-up with the console frame and its title and action", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        onCancel: () => {},
        onConfirm: () => {},
        title: "Leave this session?",
        confirmLabel: "Leave",
        cancelLabel: "Stay",
      }),
    );
    expectConsoleChrome(html);
    expect(html).toContain("data-dialog-frame");
    expect(html).toContain("Leave this session?");
    expect(html).toContain(">Leave<");
    expect(html).toContain(">Stay<");
  });

  it("renders a session end screen with the console frame and its title and action", () => {
    const html = renderToStaticMarkup(
      createElement(
        SessionFinishedScreen,
        {
          kicker: "Kicker",
          title: "Finished title",
          body: "Finished body",
          actions: createElement("button", { "data-finished-action": "go" }, "Go"),
        },
        createElement("div", null, "Report"),
      ),
    );
    expectConsoleChrome(html);
    expect(html).toContain("data-session-finished-screen");
    expect(html).toContain("Finished title");
    expect(html).toContain("Finished body");
    expect(html).toContain(">Go<");
    expect(html.indexOf("Kicker")).toBeLessThan(html.indexOf("Finished title"));
  });

  it("renders the public marketing shell and the workspace loading shell as dark square frames", () => {
    const publicHtml = renderToStaticMarkup(
      createElement(MarketingPageShell, null, createElement("h1", null, "Public title")),
    );
    expectConsoleChrome(publicHtml);
    expect(publicHtml).toContain("data-console-field");
    expect(publicHtml).toContain("Public title");
    expect(publicHtml).not.toMatch(/rounded-full/);

    const workspaceHtml = renderToStaticMarkup(
      createElement(WorkspaceLoading, { message: "Loading workspace" }),
    );
    expectConsoleChrome(workspaceHtml);
    expect(workspaceHtml).toContain("data-workspace-shell");
    expect(workspaceHtml).toContain("Loading workspace");

    const home = read("app/page.tsx");
    const workspace = read("components/WorkspaceView.tsx");
    expect(home).toContain("<PublicConsoleWash />");
    expect(home).toContain("border-white/40");
    expect(home).not.toContain("rounded-full");
    expect(home).not.toContain("14,116,144");
    expect(workspace).toContain('data-console-frame=""');
    expect(workspace).toContain("SessionConsoleMarks");
    expect(workspace).toContain("border-white/40");
    expect(workspace).not.toContain("rounded-full");
    expect(workspace).not.toContain("14,116,144");
  });

  it("renders an auth-style page shell with the console frame and its title", () => {
    const html = renderToStaticMarkup(
      createElement(ConsolePage, { label: "Auth" }, createElement("h1", null, "Sign in")),
    );
    expectConsoleChrome(html);
    expect(html).toContain("data-console-field");
    expect(html).toContain(">Auth<");
    expect(html).toContain("Sign in");
    const login = read("app/login/page.tsx");
    const register = read("app/register/page.tsx");
    const reset = read("app/reset-password/page.tsx");
    for (const src of [login, register, reset]) {
      expect(src).toContain('<ConsolePage label="Auth">');
      expect(src).not.toContain("rounded-xl");
      expect(src).not.toContain("text-red-400");
      expect(src).not.toContain("text-emerald-400");
      expect(src).not.toContain("bg-red-500");
      expect(src).not.toContain("bg-emerald-500");
    }
    const events = read("app/community-events/page.tsx");
    expect(events).toContain("<PublicConsoleWash />");
    expect(events).toContain("border-white/40");
    expect(events).not.toContain("6,182,212");
    expect(events).not.toContain("rounded-xl");
  });

  it("keeps the sticky navbar outside an overflow clip and frames the remaining public shells", () => {
    const html = renderToStaticMarkup(
      createElement(ConsolePage, { label: "Note" }, createElement("h1", null, "Terms")),
    );
    const rootClass = html.slice(html.indexOf('class="'), html.indexOf('"', html.indexOf('class="') + 7));
    expect(rootClass).not.toContain("overflow-hidden");
    expect(html).toContain("absolute inset-0 overflow-hidden");
    expect(html).toContain("Terms");

    const frame = read("components/ui/console-frame.tsx");
    const pageFn = frame.slice(frame.indexOf("export function ConsolePage"));
    const rootLiteral = pageFn.match(/"relative flex min-h-screen flex-col[^"]*"/)?.[0] ?? "";
    expect(rootLiteral).not.toContain("overflow-hidden");
    expect(pageFn).toContain("absolute inset-0 overflow-hidden");

    const dash = read("app/dashboard/page.tsx");
    const shell = dash.slice(dash.lastIndexOf("data-workspace-shell"));
    const shellClass = shell.match(/className="([^"]+)"/)?.[1] ?? "";
    expect(shell).toContain("<Navbar />");
    expect(shellClass).not.toContain("overflow-hidden");
    expect(shellClass).toContain("border-white/40");

    for (const rel of [
      "app/pricing/page.tsx",
      "app/legal/page.tsx",
      "app/community/page.tsx",
      "app/results/page.tsx",
      "app/pricing/success/page.tsx",
      "components/ScienceWhitepaperPage.tsx",
      "app/invite/[token]/page.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toMatch(/PublicConsoleWash|<ConsolePage|data-console-frame/);
      if (!src.includes("<ConsolePage")) {
        expect(src, rel).toContain("border-white/40");
      }
      expect(src, rel).not.toMatch(/rounded-(sm|md|lg|xl)\b/);
      expect(src, rel).not.toMatch(/\b(bg|text|border)-(emerald|green|cyan|violet)-/);
    }
    expect(read("app/pricing/page.tsx")).toContain("Learning Harness pricing");
    expect(read("app/pricing/success/page.tsx")).toContain("pricing.allSet");
    expect(read("components/ScienceWhitepaperPage.tsx")).toContain("data-science-whitepaper");
    expect(read("components/marketing/MarketingChrome.tsx")).not.toContain("overflow-hidden");
  });

  it("leaves insight flags, the listening dot, and stored canvas ink alone", () => {
    expect(read("components/session-view/ile-insight-trophies.tsx")).toContain("bg-amber-300");
    expect(read("components/tap-score/tap-live-clock.tsx")).toContain("bg-red-500");
    expect(ILE_WORK_CANVAS_STROKE_COLOR).toBe("#1e1e1e");
    expect(read("components/session-view/session-sidebar.tsx")).toContain("overflow-hidden");
    expect(read("components/exercise-tap/ExerciseTapShell.tsx")).not.toContain("confirmClose");
    expect(read("components/exercise-tap/ExerciseTapShell.tsx")).not.toContain("TAP_IM_DONE_CONFIRM_TITLE");
  });
});
