/**
 * Public Projects landing: Brain Priming Protocol waitlist.
 * Drives the shipped copy module, nav, sitemap, and page source.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMUNITY_LINKS } from "@/lib/marketing/nav";
import {
  BRAIN_PRIMING_JOIN_PATH,
  BRAIN_PRIMING_PATH,
} from "@/lib/marketing/paths";
import {
  BRAIN_PRIMING_COPY,
  brainPrimingFullText,
  storeBrainPrimingWaitlist,
} from "@/lib/marketing/brain-priming";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Brain Priming Protocol project", () => {
  it("is listed under Projects nav with the waitlist form on the landing", () => {
    const entry = COMMUNITY_LINKS.find((link) => link.href === BRAIN_PRIMING_PATH);
    expect(entry?.label).toBe("Brain Priming Protocol");
    expect(BRAIN_PRIMING_PATH).toBe("/brain-priming");
    expect(BRAIN_PRIMING_JOIN_PATH).toBe("/brain-priming/join");
    expect(existsSync(join(ROOT, "app/brain-priming/page.tsx"))).toBe(true);
    const landing = read("app/brain-priming/page.tsx");
    expect(landing).toContain("BRAIN_PRIMING_COPY");
    expect(landing).toContain("MarketingPageShell");
    expect(landing).toContain("MarketingDirectoryHero");
    expect(landing).toContain("console-copy");
    expect(landing).toContain("lg:grid-cols-12");
    expect(landing).not.toContain("bg-zinc-900");
    expect(landing).toContain("data-brain-priming-page");
    expect(landing).toContain("{copy.title}");
    expect(landing).toContain("{copy.h1}");
    expect(landing).toContain("{copy.thesis}");
    expect(landing).toContain("data-brain-priming-hero");
    expect(landing).toContain("data-brain-priming-flows");
    expect(landing).toContain("data-brain-priming-domains");
    expect(landing).toContain("data-brain-priming-blood");
    expect(landing).toContain("data-brain-priming-start");
    expect(landing).toContain("ctaStartHref");
    expect(landing).toContain("BrainPrimingWaitlistForm");
    expect(landing).toContain('id="join"');
    expect(landing).toContain("data-brain-priming-join");
    expect(landing).not.toContain("BrainPrimingIntentForm");
    const joinPage = read("app/brain-priming/join/page.tsx");
    expect(joinPage).toContain("redirect");
    expect(joinPage).toContain("#join");
    expect(read("components/marketing/MarketingChrome.tsx")).toContain("LandingNav");
    expect(read("app/sitemap.ts")).toContain("/brain-priming");
  });

  it("states Brain Priming Protocol, brain priming, tailored to you, and supplement", () => {
    const text = brainPrimingFullText();
    expect(text).toContain("Brain Priming Protocol");
    expect(text).toContain("brain priming");
    expect(text).toContain("tailored to you");
    expect(text).toContain("supplement");
    expect(BRAIN_PRIMING_COPY.title).toBe("Brain Priming Protocol");
    expect(BRAIN_PRIMING_COPY.kicker).toBe("brain priming");
    expect(BRAIN_PRIMING_COPY.positioning).toBe("tailored to you");
    expect(BRAIN_PRIMING_COPY.product).toBe("supplement");
    expect(read("lib/marketing/brain-priming.ts")).toContain("Brain Priming Protocol");
  });

  it("describes a weekly Solve/Verify map that adapts the next dose", () => {
    const text = brainPrimingFullText();
    expect(text).toContain("You tell us what you want to learn.");
    expect(text).toContain(
      "Weekly Solve and Verify work on that map is the primary signal used to customize that supplement.",
    );
    expect(text).toMatch(/Mathematics/);
    expect(text).toMatch(/Computer science/);
    expect(text).toMatch(/Chemistry and biology/);
    expect(text).toMatch(/tailored exercises/i);
    expect(text).toMatch(/Learning Map/);
    expect(text).toMatch(/Solve/);
    expect(text).toMatch(/Verify/);
    expect(text).toMatch(/3 months/);
    expect(text).toMatch(/6 months/);
    expect(text).toMatch(/third-party manufacturer/);
    expect(text).toMatch(/Europe and the US/);
    expect(BRAIN_PRIMING_COPY.plans.items.map((item) => item.id)).toEqual(["3", "6"]);
    const names = BRAIN_PRIMING_COPY.ingredients.map((item) => item.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Caffeine + L-theanine",
        "Bacopa",
        "Creatine",
        "Citicoline",
        "Omega-3 (DHA)",
        "Magnesium",
        "B12 and D",
      ]),
    );
    expect(text.toLowerCase()).not.toMatch(/\befsa\b/);
    expect(text).not.toMatch(/Directive 2002/);
  });

  it("requires one initial blood result in the protocol, waitlist is email only", () => {
    const text = brainPrimingFullText();
    expect(text).toMatch(/One initial blood result/);
    expect(text).toMatch(/vitamin D/i);
    expect(text).toMatch(/B12/);
    expect(text).toMatch(/ferritin/);
    expect(text).toMatch(/omega-3/);
    expect(text).toMatch(/Join the waitlist/);
    expect(BRAIN_PRIMING_COPY.ctaStartHref).toBe("#join");
    const form = read("components/marketing/BrainPrimingWaitlistForm.tsx");
    expect(form).toContain("storeBrainPrimingWaitlist");
    expect(form).toContain('type="email"');
    expect(form).toContain('name="topic"');
    expect(form).toContain('name="domain"');
    expect(form).not.toContain('type="file"');
    expect(form).toContain("value={domain.id}");
    expect(form).toContain("value={plan.id}");
    expect(BRAIN_PRIMING_COPY.waitlist.note).toMatch(/Waitlist only/);
    expect(BRAIN_PRIMING_COPY.waitlist.note).toMatch(/not scored as a diagnosis/);
  });

  it("does not claim to diagnose, treat, cure, or prevent disease", () => {
    const text = brainPrimingFullText();
    expect(text).toContain(
      "This product is not intended to diagnose, treat, cure, or prevent any disease.",
    );
    const withoutDisclaimer = text.replace(
      /This product is not intended to diagnose, treat, cure, or prevent any disease\./g,
      "",
    );
    expect(withoutDisclaimer).not.toMatch(
      /\bthis (product|protocol|supplement) (diagnoses|treats|cures|prevents)\b/i,
    );
    expect(withoutDisclaimer).not.toMatch(/\bcures?\b/i);
    expect(read("app/brain-priming/page.tsx")).toContain("data-brain-priming-disclaimer");
    expect(read("app/brain-priming/page.tsx")).not.toContain("Calibrate is priming");
  });

  it("storeBrainPrimingWaitlist records topic and email and never scores a diagnosis", () => {
    const base = storeBrainPrimingWaitlist({
      email: "reader@example.com",
      domain: "mathematics",
      topic: "measure theory",
    });
    expect(base.stored).toBe("waitlist");
    expect(base.scored).toBe(false);
    expect(base.diagnostic).toBe(false);
    expect(base.domain).toBe("mathematics");
    expect(base.topic).toBe("measure theory");
    expect(base.plan).toBe(null);
    expect(base.message).toMatch(/waitlist/i);

    const planned = storeBrainPrimingWaitlist({
      email: "reader@example.com",
      domain: "computer-science",
      topic: "distributed systems",
      plan: "6",
    });
    expect(planned.plan).toBe("6");
    expect(planned.domain).toBe("computer-science");
    expect(planned.scored).toBe(false);

    expect(() => storeBrainPrimingWaitlist({ email: "not-an-email", topic: "algebra" })).toThrow(
      /valid email/i,
    );
    expect(() =>
      storeBrainPrimingWaitlist({ email: "reader@example.com", topic: "ab" }),
    ).toThrow(/what you want to learn/i);
  });
});
