/**
 * Shared shells use the session rail's black square console:
 * hairline frame, corner brackets, and a short mono label.
 * Copy and primary actions stay. Insight flags and the listening dot stay.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarketingPageShell } from "@/components/marketing/MarketingChrome";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import { ConsolePage } from "@/components/ui/console-frame";
import { ILE_WORK_CANVAS_STROKE_COLOR } from "@/lib/learn-work-canvas";

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
        selectedAesthetic: {
          id: "lunar",
          name: "Lunar",
          images: ["/aesthetics/lunar/preview.jpeg"],
          previewImage: "/aesthetics/lunar/preview.jpeg",
        },
        selectedAestheticId: "lunar",
        onSelectAesthetic: () => {},
        aestheticsLoading: false,
        chapterPlanStatus: "exists",
        autoAdvance: false,
        onToggleAutoAdvance: () => {},
        planError: null,
        onConfirmSettings: () => {},
        onReadyStart: () => {},
        hasSessionPlan: false,
      }),
    );
    expectConsoleChrome(html);
    expect(html).toContain("data-ile-session-settings");
    expect(html).toContain("Learn");
    expect(html).toContain("session.welcomeMessage");
    expect(html).toContain("data-ile-confirm-settings");
    expect(html).toContain("session.confirmSettings");
    expect(html).not.toContain("data-ile-silence-lock-minutes");
    expect(html).not.toContain("data-ile-learn-presets");
    expect(html).not.toContain("data-ile-session-insight-goal");
    expect(html).not.toContain("data-ile-aesthetic-picker");
    expect(html).toContain("data-tap-aesthetic-section");
    expect(html).toContain("/aesthetics/lunar/preview.jpeg");
    expect(html).not.toContain("session.getStarted");

    const confirmed = renderToStaticMarkup(
      createElement(SessionWelcomeModal, {
        t: (key: string) => key,
        languageConfirmed: true,
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
        autoAdvance: false,
        onToggleAutoAdvance: () => {},
        planError: null,
        onConfirmSettings: () => {},
        onReadyStart: () => {},
        hasSessionPlan: true,
      }),
    );
    expect(confirmed).not.toContain("data-ile-silence-lock-minutes");
    expect(confirmed).not.toContain("data-ile-learn-presets");
    expect(confirmed).not.toContain("data-ile-session-insight-goal");
    expect(confirmed).not.toContain("data-ile-aesthetic-picker");
    expect(confirmed).toContain("data-tap-aesthetic-section");
    expect(confirmed).toContain("data-ile-confirm-settings");
    expect(confirmed).not.toContain("session.getStarted");
    expect(confirmed).toContain("Learn");

    const solveHtml = renderToStaticMarkup(
      createElement(SessionWelcomeModal, {
        t: (key: string) => key,
        title: "Solve",
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
        autoAdvance: false,
        onToggleAutoAdvance: () => {},
        planError: null,
        onConfirmSettings: () => {},
        onReadyStart: () => {},
        hasSessionPlan: false,
      }),
    );
    expect(solveHtml).toContain("Solve");
    expect(solveHtml).not.toContain("data-ile-aesthetic-picker");
    expect(solveHtml).toContain("data-tap-aesthetic-section");
    expect(solveHtml).not.toContain(">Learn<");
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

  it("renders the public marketing shell as a dark square frame", () => {
    const publicHtml = renderToStaticMarkup(
      createElement(MarketingPageShell, null, createElement("h1", null, "Public title")),
    );
    expect(publicHtml).toContain("border-white/40");
    expect(publicHtml).toContain("bg-[#0e1c2c]");
    expect(publicHtml).toContain("data-public-field");
    expect(publicHtml).toContain("Public title");
    expect(publicHtml).toContain("data-console-field");
    expect(publicHtml).toContain("data-console-frame-label");
    expect(publicHtml).not.toMatch(/rounded-full/);

    const home = read("app/page.tsx");
    expect(read("components/marketing/landing-heroes.tsx")).toContain("<PublicConsoleWash />");
    expect(read("components/marketing/MarketingChrome.tsx")).toContain("<PublicConsoleWash />");
    expect(home).toContain("border-white/40");
    expect(home).not.toContain("rounded-full");
    expect(home).not.toContain("14,116,144");
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
    expect(events).toContain("MarketingPageShell");
    expect(events).toContain("MarketingDirectoryHero");
    expect(read("components/marketing/MarketingChrome.tsx")).toContain("<PublicConsoleWash />");
    expect(read("components/marketing/MarketingChrome.tsx")).toContain("border-white/40");
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
    expect(shell).not.toContain("<Navbar");
    expect(shell).toContain("DashboardSidebar");
    expect(shellClass).toContain("md:overflow-hidden");
    expect(shellClass).toContain("border-white/40");
    expect(shell).not.toContain("data-console-frame-label");
    expect(shell).not.toContain("dashboardFrameLabel");

    expect(read("app/community/page.tsx")).toContain("RetiredProductPage");
    expect(read("app/community-events/page.tsx")).toContain("MarketingPageShell");
    for (const rel of [
      "app/pricing/page.tsx",
      "app/legal/page.tsx",
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
    expect(read("app/pricing/page.tsx")).toContain("UNIFIED_PRICING_COPY.title");
    expect(read("app/pricing/success/page.tsx")).toContain("pricing.allSet");
    expect(read("components/ScienceWhitepaperPage.tsx")).toContain("data-science-whitepaper");
    expect(read("components/marketing/MarketingChrome.tsx")).not.toContain("overflow-hidden");
    for (const rel of [
      "components/TapbenchShell.tsx",
      "components/TapbenchResultsTable.tsx",
      "components/TapbenchResultsIntro.tsx",
      "components/TapbenchExperimentTutorial.tsx",
      "components/TapbenchWorkspaceDetail.tsx",
      "components/TapbenchLanding.tsx",
    ]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(false);
    }
  });

  it("leaves insight flags, the listening dot, and stored canvas ink alone", () => {
    expect(existsSync(join(ROOT, "components/session-view/learn-insight-trophies.tsx"))).toBe(false);
    expect(read("components/session-view/session-sidebar.tsx")).toContain("text-amber-300");
    expect(read("components/tap-score/tap-live-clock.tsx")).toContain("bg-red-500");
    expect(ILE_WORK_CANVAS_STROKE_COLOR).toBe("#1e1e1e");
    expect(read("components/session-view/session-sidebar.tsx")).toContain("overflow-hidden");
    expect(existsSync(join(ROOT, "components/exercise-tap/ExerciseTapShell.tsx"))).toBe(false);
  });
});
