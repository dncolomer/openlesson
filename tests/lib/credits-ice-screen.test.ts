import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InsufficientCreditsIceScreen } from "@/components/credits/InsufficientCreditsIceScreen";
import {
  INSUFFICIENT_CREDITS_COPY,
  insufficientCreditsPricingHref,
  insufficientCreditsRegisterHref,
  isInsufficientCreditsBody,
  parseInsufficientCreditsBody,
  safeInternalReturnPath,
} from "@/lib/credits/insufficient";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("insufficient credits ice screen", () => {
  it("parses 402 insufficient_credits envelopes and ignores other 402s", () => {
    expect(
      isInsufficientCreditsBody({
        error: { code: "insufficient_credits", message: "This session costs 10 credits." },
      }),
    ).toBe(true);
    expect(
      parseInsufficientCreditsBody({
        error: {
          code: "insufficient_credits",
          message: "out",
          details: { balance: 0, cost: 10 },
        },
      }),
    ).toEqual({ balance: 0, cost: 10 });
    expect(isInsufficientCreditsBody({ error: { code: "usage_limit_reached", message: "plan" } })).toBe(
      false,
    );
  });

  it("sends Get credits to pricing and guests to register with a pricing returnUrl", () => {
    expect(insufficientCreditsPricingHref()).toBe("/pricing");
    expect(insufficientCreditsRegisterHref()).toBe("/register?returnUrl=%2Fpricing");
    expect(safeInternalReturnPath("/pricing")).toBe("/pricing");
    expect(safeInternalReturnPath("https://evil.example/phish")).toBeNull();
    expect(safeInternalReturnPath("//evil.example")).toBeNull();
  });

  it("renders a blocking ice with pricing; guests also get create-account", () => {
    const guest = renderToStaticMarkup(
      createElement(InsufficientCreditsIceScreen, { guest: true, overlay: true }),
    );
    expect(guest).toContain("data-insufficient-credits-ice");
    expect(guest).toContain('data-insufficient-credits-guest="true"');
    expect(guest).toContain("out of credits");
    expect(guest).toContain("data-insufficient-credits-pricing");
    expect(guest).toContain('href="/pricing"');
    expect(guest).toContain("data-insufficient-credits-register");
    expect(guest).toContain("/register?returnUrl=%2Fpricing");
    expect(guest).toContain("alertdialog");

    const signedIn = renderToStaticMarkup(
      createElement(InsufficientCreditsIceScreen, { guest: false, overlay: true }),
    );
    expect(signedIn).toContain("data-insufficient-credits-pricing");
    expect(signedIn).not.toContain("data-insufficient-credits-register");
  });

  it("installs the ice host on every page and intercepts 402 fetches", () => {
    expect(read("app/layout.tsx")).toContain("InsufficientCreditsIceHost");
    const host = read("components/credits/InsufficientCreditsIceHost.tsx");
    expect(host).toContain("installInsufficientCreditsFetchGuard");
    expect(read("lib/credits/insufficient.ts")).toContain("window.fetch");
    expect(read("lib/credits/insufficient.ts")).toContain("res.status === 402");
  });

  it("Learn guest-link 402 renders the ice; minted guests grant 100 credits", () => {
    const learnPage = read("app/learn/session/[token]/page.tsx");
    expect(learnPage).toContain("InsufficientCreditsIceScreen");
    expect(learnPage).toContain("ensured.status === 402");
    expect(read("lib/aycl-fork-guest.ts")).toContain("applyGuestGrantIfNeeded");
    expect(read("app/register/page.tsx")).toContain("safeInternalReturnPath");
    expect(read("supabase/migrations/20261102140000_guest_starter_credits.sql")).toContain(
      "guest_starter",
    );
  });
});
