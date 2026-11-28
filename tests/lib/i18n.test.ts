import { describe, expect, it } from "vitest";
import {
  isSupportedLocale,
  loadLocaleBundle,
  translateWithLocale,
} from "@/lib/i18n";

describe("i18n lazy locale loading and translation", () => {
  it("validates supported locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("es")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });

  it("translates English keys synchronously and falls back to English for unknown locales", () => {
    const enValue = translateWithLocale("en", "common.loading");
    expect(enValue).not.toBe("common.loading");
    expect(translateWithLocale("unknown-locale", "common.loading")).toBe(enValue);
    expect(translateWithLocale("en", "nonexistent.dotted.key")).toBe("nonexistent.dotted.key");
  });

  it("lazy-loads non-English bundles and translates localized values", async () => {
    await loadLocaleBundle("es");
    const enTitle = translateWithLocale("en", "organization.searchOrganizations");
    const esTitle = translateWithLocale("es", "organization.searchOrganizations");
    expect(esTitle).not.toBe("organization.searchOrganizations");
    expect(esTitle).not.toBe(enTitle);
  });

  it("interpolates named parameters", () => {
    const rendered = translateWithLocale("en", "organization.organizationSwitcherMore", {
      remaining: 7,
    });
    expect(rendered).toContain("7");
    expect(rendered).not.toContain("{remaining}");
  });
});
