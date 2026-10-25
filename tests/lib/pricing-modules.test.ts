import { describe, expect, it } from "vitest";
import {
  canonicalPlanFromModules,
  mergePlanIds,
  modulesForPlan,
  planFeatureList,
  planHasModule,
  priceCentsForPlan,
  PUBLIC_SKU_CARDS,
  resolveModuleCheckout,
  skuAlreadyCovered,
  TRY_EVERYTHING_PRICE_CENTS,
  LEARN_MONTHLY_PRICE_CENTS,
  AUTHOR_MONTHLY_PRICE_CENTS,
  VERIFY_CALIBRATE_BUNDLE_PRICE_CENTS,
} from "@/lib/pricing/modules";

describe("module combination plans", () => {
  it("author includes learning", () => {
    expect(modulesForPlan("author")).toEqual(["learn", "author"]);
    expect(planHasModule("author", "learn")).toBe(true);
    expect(planHasModule("learn", "author")).toBe(false);
  });

  it("trial and api_metered include every module", () => {
    expect(modulesForPlan("trial")).toEqual(["learn", "author", "verify", "calibrate"]);
    expect(modulesForPlan("api_metered")).toEqual(["learn", "author", "verify", "calibrate"]);
  });

  it("canonicalizes unions onto combination plan ids", () => {
    expect(canonicalPlanFromModules(["learn", "verify"])).toBe("learn_verify");
    expect(canonicalPlanFromModules(["author", "learn"])).toBe("author");
    expect(canonicalPlanFromModules(["verify", "calibrate"])).toBe("verify_calibrate");
    expect(canonicalPlanFromModules(["learn", "author", "verify", "calibrate"])).toBe(
      "author_verify_calibrate",
    );
  });

  it("merges buy-more onto a combination tier", () => {
    expect(mergePlanIds("learn", "verify")).toBe("learn_verify");
    expect(mergePlanIds("learn", "author")).toBe("author");
    expect(mergePlanIds("verify", "calibrate")).toBe("verify_calibrate");
    expect(mergePlanIds("trial", "learn")).toBe("learn");
    expect(mergePlanIds("learn", "trial")).toBe("learn");
    expect(mergePlanIds("learn", "api_metered")).toBe("api_metered");
  });

  it("prices the try-everything pass at $24.99 and Learning at $24.99/mo", () => {
    expect(TRY_EVERYTHING_PRICE_CENTS).toBe(2499);
    expect(LEARN_MONTHLY_PRICE_CENTS).toBe(2499);
    expect(priceCentsForPlan("trial")).toBe(2499);
    expect(priceCentsForPlan("learn")).toBe(2499);
    expect(priceCentsForPlan("author")).toBe(AUTHOR_MONTHLY_PRICE_CENTS);
    expect(priceCentsForPlan("learn_verify")).toBe(
      LEARN_MONTHLY_PRICE_CENTS + 4999,
    );
    expect(priceCentsForPlan("verify_calibrate")).toBe(VERIFY_CALIBRATE_BUNDLE_PRICE_CENTS);
  });

  it("resolves checkout onto the merged combo price", () => {
    const addVerify = resolveModuleCheckout("learn", "module_verify");
    expect(addVerify.alreadyEntitled).toBe(false);
    expect(addVerify.plan).toBe("learn_verify");
    expect(addVerify.unitAmount).toBe(LEARN_MONTHLY_PRICE_CENTS + 4999);
    expect(addVerify.mode).toBe("subscription");

    const trial = resolveModuleCheckout("inactive", "trial_3day");
    expect(trial.plan).toBe("trial");
    expect(trial.mode).toBe("payment");
    expect(trial.unitAmount).toBe(2499);

    expect(skuAlreadyCovered("author", "module_learn")).toBe(true);
    expect(skuAlreadyCovered("author", "module_author")).toBe(true);
    expect(skuAlreadyCovered("learn", "module_author")).toBe(false);
    expect(resolveModuleCheckout("author", "module_learn").alreadyEntitled).toBe(true);
  });

  it("names Verification and Calibration as flows in plan and SKU copy", () => {
    expect(planFeatureList("verify")).toContain("Verification flows and knowledge regions");
    expect(planFeatureList("calibrate")).toContain("Calibration flows and knowledge regions");
    expect(planFeatureList("verify")).not.toContain("Verification workspaces");
    expect(planFeatureList("calibrate")).not.toContain("Calibration workspaces");
    const verify = PUBLIC_SKU_CARDS.find((card) => card.id === "module_verify");
    const calibrate = PUBLIC_SKU_CARDS.find((card) => card.id === "module_calibrate");
    const bundle = PUBLIC_SKU_CARDS.find((card) => card.id === "bundle_verify_calibrate");
    expect(verify?.body).toContain("Verification flows and knowledge regions");
    expect(verify?.features).toContain("Verification flows");
    expect(calibrate?.body).toContain("Calibration flows and knowledge regions");
    expect(calibrate?.features).toContain("Calibration flows");
    expect(bundle?.features).toContain("Verification flows and regions");
    expect(bundle?.features).toContain("Calibration flows and regions");
  });
});
