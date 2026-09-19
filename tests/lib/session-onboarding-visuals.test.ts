/**
 * TAP/ILE intro: two live slides (first + last). Thought-interface tutorial is gone.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { readExerciseTapSurface, readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-bcfe7138d593/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

type EnOnboarding = {
  onboardingGuide: {
    ile: {
      kicker: string;
      title: string;
      titleOne: string;
      step1: { title: string; body: string };
      step2: { title: string; body: string; bodyProject: string };
      step3: {
        title: string;
        body: string;
        bodyProject: string;
        start: string;
        highlight: string;
        quoteText: string;
        slotsLabel: string;
      };
    };
    tap: {
      step1: { title: string; body: string; highlight: string };
      step2: { title: string; body: string };
      step3: { title: string; body: string; start: string };
    };
  };
};

function countWelcomeInsightSlots(html: string): number {
  return html.match(/data-ile-welcome-insight-slot="/g)?.length ?? 0;
}

function countAriaSteps(html: string): number {
  const matches = html.match(/aria-label="Go to step \d+"/g) ?? [];
  return matches.length;
}

function decodeHtml(html: string): string {
  return html
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

describe("session intro visuals", () => {
  it("TAP is two slides; ILE is the last slide only; thought-interface tutorial is not rendered", () => {
    const en = JSON.parse(read("messages/en.json")) as EnOnboarding;
    const tapBody = en.onboardingGuide.tap.step1.body;
    const tapHighlight = en.onboardingGuide.tap.step1.highlight;

    const tapHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "tap",
        hideStep3Quote: true,
        renderStep3Action: () =>
          createElement("div", { "data-tap-last-slide-action": "topics" }, "topic-cards"),
      }),
    );
    const tapPlayHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "tap",
        showStartAction: true,
      }),
    );
    const ileLearningHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "ile",
        showStartAction: true,
      }),
    );
    const ileProjectHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "ile",
        projectMode: true,
        showStartAction: true,
      }),
    );
    const ileThreeHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "ile",
        showStartAction: true,
        insightGoalCount: 3,
      }),
    );
    const ileFiveHtml = renderToStaticMarkup(
      createElement(SessionOnboardingGuide, {
        variant: "ile",
        showStartAction: true,
        insightGoalCount: 5,
      }),
    );

    for (const html of [tapHtml, tapPlayHtml]) {
      expect(countAriaSteps(html)).toBe(2);
      expect(html).toContain("1 / 2");
      expect(html).not.toContain("1 / 3");
      expect(html).not.toMatch(/How the interface works/i);
      expect(html).not.toContain("/animations/selective_interface.mp4");
      expect(html).not.toMatch(/Helios/);
    }
    for (const html of [ileLearningHtml, ileProjectHtml]) {
      expect(countAriaSteps(html)).toBe(0);
      expect(html).not.toContain("1 / 2");
      expect(html).not.toContain("1 / 3");
      expect(html).not.toMatch(/How the interface works/i);
      expect(html).not.toContain("/animations/selective_interface.mp4");
      expect(html).not.toMatch(/Helios/);
    }

    const tapText = decodeHtml(tapHtml);
    const tapPlayText = decodeHtml(tapPlayHtml);
    const ileLearningText = decodeHtml(ileLearningHtml);
    const ileProjectText = decodeHtml(ileProjectHtml);

    expect(tapText).toContain(en.onboardingGuide.tap.step1.title);
    expect(tapText).toContain(tapBody);
    expect(tapText).toContain(tapHighlight);
    expect(tapText).toContain(en.onboardingGuide.tap.step3.title);
    expect(tapHtml).toContain('data-tap-last-slide-action="topics"');
    expect(tapText).not.toContain(en.onboardingGuide.tap.step2.title);

    expect(tapPlayText).toContain(en.onboardingGuide.tap.step3.start);
    expect(tapPlayText).toContain(en.onboardingGuide.tap.step3.title);

    expect(ileLearningText).toContain(en.onboardingGuide.ile.kicker);
    expect(ileLearningText).toContain(en.onboardingGuide.ile.titleOne);
    expect(ileLearningText).not.toContain(en.onboardingGuide.ile.step3.title);
    expect(ileLearningText).toContain(en.onboardingGuide.ile.step3.start);
    expect(ileLearningHtml).toContain("data-onboarding-start");
    expect(ileLearningHtml).not.toContain("data-onboarding-highlight");
    expect(ileLearningHtml).not.toContain("data-ile-intro-widget-close");
    expect(ileLearningText).not.toMatch(/Start block/i);
    expect(en.onboardingGuide.ile.step3.start).toBe("Start");
    expect(ileLearningText).toMatch(/craft insights/i);
    expect(ileLearningText).toMatch(/different areas of the map/i);
    expect(ileLearningText).not.toMatch(/Generate Work in a turn/i);
    expect(ileLearningText).not.toMatch(/next turn/i);
    expect(ileLearningText).not.toMatch(/speak your thoughts out loud/i);
    expect(ileLearningText).not.toMatch(/win by completing chapters/i);
    expect(ileLearningText).not.toMatch(/map can be further built/i);
    expect(ileLearningText).not.toMatch(/timer/i);
    expect(ileLearningText).not.toMatch(/End turn/i);
    expect(ileLearningText).not.toMatch(/Victorious warriors/i);
    expect(ileLearningText).not.toMatch(/Sun Tzu/i);
    expect(en.onboardingGuide.ile.step3.body).not.toMatch(/Commander/);
    expect(en.onboardingGuide.ile.step3.body).toMatch(/different areas of the map/i);
    expect(en.onboardingGuide.ile.step3.body).toMatch(/craft insights/i);
    expect(en.onboardingGuide.ile.step3.body.length).toBeLessThan(120);
    expect(en.onboardingGuide.ile.step3.bodyProject).toBe(en.onboardingGuide.ile.step3.body);
    expect(en.onboardingGuide.ile.step3.highlight).toBe("");
    expect(en.onboardingGuide.ile.step3.quoteText).toBe("");
    expect(ileLearningHtml).toContain('data-ile-welcome-insight-slot-count="3"');
    expect(countWelcomeInsightSlots(ileLearningHtml)).toBe(3);
    expect(ileLearningText).toContain("Empty");
    expect(ileLearningHtml).toContain('data-ile-insight-slot-card="empty"');
    expect(ileThreeHtml).toContain('data-ile-welcome-insight-slot-count="3"');
    expect(countWelcomeInsightSlots(ileThreeHtml)).toBe(3);
    expect(decodeHtml(ileThreeHtml)).toContain("Craft 3 insights");
    expect(ileFiveHtml).toContain('data-ile-welcome-insight-slot-count="5"');
    expect(countWelcomeInsightSlots(ileFiveHtml)).toBe(5);
    expect(tapHtml).not.toContain("data-ile-welcome-insight-slots");

    expect(ileProjectText).toContain(en.onboardingGuide.ile.step3.start);
    expect(ileProjectText).toContain(en.onboardingGuide.ile.titleOne);
    expect(ileProjectHtml).toContain("data-onboarding-start");
    expect(ileProjectHtml).not.toContain("data-onboarding-highlight");
    expect(ileProjectText).toMatch(/different areas of the map/i);
    expect(countWelcomeInsightSlots(ileProjectHtml)).toBe(3);

    expect(tapBody).toMatch(/think out loud/i);
    expect(tapBody).toMatch(/I'm done answering/);
    expect(tapBody).toMatch(/Stay speaking/);
    expect(tapBody).not.toMatch(/^Think out loud on a timer\./);
    expect(tapBody).not.toMatch(/Helios/);
    expect(tapBody.length).toBeGreaterThan(180);
    expect(tapHighlight).toMatch(/reading the question out loud/i);

    const ileBodies = [
      en.onboardingGuide.ile.step3.body,
      en.onboardingGuide.ile.step3.bodyProject,
      en.onboardingGuide.tap.step3.body,
    ];
    for (const body of ileBodies) {
      expect(body).not.toMatch(/Helios/);
    }

    const guide = read("components/SessionOnboardingGuide.tsx");
    expect(guide).toContain('STEP1_ILE_GRID_PAN_VIDEO = "/animations/grid_pan.mp4"');
    expect(guide).toContain('STEP1_TAP_SPEAKING_VIDEO = "/animations/speaking.mp4"');
    expect(guide).not.toContain("STEP2_THOUGHT_INTERFACE_VIDEO");
    expect(guide).not.toContain("step2VideoSrc");
    expect(guide).toContain("index === lastSlideIndex && renderStep3Action");
    expect(guide).toContain("index === lastSlideIndex && showStartAction && !renderStep3Action");
    expect(guide).toContain("data-onboarding-start");
    expect(guide).toContain("data-onboarding-start-wrap");
    const highlightIdx = guide.indexOf("data-onboarding-highlight");
    const startIdx = guide.indexOf("data-onboarding-start");
    expect(highlightIdx).toBeGreaterThan(-1);
    expect(startIdx).toBeGreaterThan(highlightIdx);
    expect(guide).not.toContain("showStartAction && !renderStep3Action && isLastStep");
    expect(guide).not.toContain("stepTitle(\"step2\")");
    expect(guide).not.toContain("stepBody(\"step2\")");

    const conversational = readTapScoreSurface();
    const exercise = readExerciseTapSurface();
    expect(conversational).toContain("SessionOnboardingGuide");
    expect(conversational).toContain("renderStep3Action");
    expect(conversational).toContain("TapStartingTopicCards");
    expect(exercise).toContain("SessionOnboardingGuide");
    expect(exercise).toContain("renderStep3Action");
    expect(exercise).toContain("TapStartingTopicCards");

    const ileLearningMount = read("components/ProbesPanel.tsx");
    const ileMobile = read("components/MobileProbesTab.tsx");
    const ileHelios = read("components/SessionHeliosPanel.tsx");
    const ileChrome = read("components/session-view/session-chrome.tsx");
    const ileView = read("components/SessionView.tsx");
    expect(ileLearningMount).toContain("SessionOnboardingGuide");
    expect(ileLearningMount).toContain("showStartAction");
    expect(ileMobile).toContain("SessionOnboardingGuide");
    expect(ileMobile).toContain("showStartAction");
    expect(ileHelios).not.toContain("SessionOnboardingGuide");
    expect(ileChrome).toContain("data-ile-intro-widget");
    expect(ileView).toContain("SessionOnboardingGuide");
    expect(ileView).toContain("introOpen={showWelcomePanel}");
    expect(ileView).toContain("showStartAction");
    expect(ileView).toContain("projectMode={isProjectMode}");
    expect(ileView).toContain("insightGoalCount={minInsightsPerChapter}");
    expect(guide).toContain("IleInsightEmptySlots");
    expect(guide).toContain("insightGoalCount");

    for (const rel of ["public/animations/grid_pan.mp4", "public/animations/speaking.mp4"] as const) {
      const path = join(ROOT, rel);
      expect(existsSync(path), `missing ${rel}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(200_000);
    }

    writeScratch(
      "intro-slides.txt",
      [
        "tapSlideCount=2 ileSlideCount=1",
        "thoughtInterfaceTutorial=gone",
        "tapModes=conversational+exercise lastSlide=topic-cards/Play",
        "ileModes=learning+project lastSlide=Start",
        `tapTitles=${en.onboardingGuide.tap.step1.title} | ${en.onboardingGuide.tap.step3.title}`,
        `ileTitle=${en.onboardingGuide.ile.titleOne}`,
      ].join("\n") + "\n",
    );
    writeScratch("tap-intro-copy.txt", tapBody + "\n---highlight---\n" + tapHighlight + "\n");
  });
});
