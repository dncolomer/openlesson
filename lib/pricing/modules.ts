/**
 * Product modules and combination plan ids.
 * Organizations still store a single `plan` string; combos are the tiers.
 */

export const PRODUCT_MODULES = ["learn", "author", "verify", "calibrate"] as const;
export type ProductModule = (typeof PRODUCT_MODULES)[number];

export const COMBO_PLAN_IDS = [
  "learn",
  "author",
  "verify",
  "calibrate",
  "verify_calibrate",
  "learn_verify",
  "learn_calibrate",
  "learn_verify_calibrate",
  "author_verify",
  "author_calibrate",
  "author_verify_calibrate",
] as const;

export type ComboPlanId = (typeof COMBO_PLAN_IDS)[number];

export type ModulePlanId = "inactive" | "trial" | "api_metered" | ComboPlanId;

export const MODULE_SKU_IDS = [
  "trial_3day",
  "module_learn",
  "module_author",
  "module_verify",
  "module_calibrate",
  "bundle_verify_calibrate",
] as const;

export type ModuleSkuId = (typeof MODULE_SKU_IDS)[number];

/** Learning module monthly (same sticker as the former public harness). */
export const LEARN_MONTHLY_PRICE_CENTS = 2499;
/** Course authoring monthly (includes Learning + Your Shop). */
export const AUTHOR_MONTHLY_PRICE_CENTS = 4999;
/** Verification monthly. */
export const VERIFY_MONTHLY_PRICE_CENTS = 4999;
/** Calibration monthly. */
export const CALIBRATE_MONTHLY_PRICE_CENTS = 4999;
/** Verification + Calibration bundle monthly. */
export const VERIFY_CALIBRATE_BUNDLE_PRICE_CENTS = 7999;
/** Try-everything one-time (3 days). */
export const TRY_EVERYTHING_PRICE_CENTS = 2499;

export const ALL_PRODUCT_MODULES: readonly ProductModule[] = PRODUCT_MODULES;

const COMBO_SET = new Set<string>(COMBO_PLAN_IDS);
const SKU_SET = new Set<string>(MODULE_SKU_IDS);

export function isComboPlanId(value: string | null | undefined): value is ComboPlanId {
  return typeof value === "string" && COMBO_SET.has(value);
}

export function isModuleSkuId(value: string | null | undefined): value is ModuleSkuId {
  return typeof value === "string" && SKU_SET.has(value);
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function uniqueModules(modules: readonly ProductModule[]): ProductModule[] {
  const set = new Set<ProductModule>();
  for (const module of modules) {
    set.add(module);
    if (module === "author") set.add("learn");
  }
  return PRODUCT_MODULES.filter((module) => set.has(module));
}

export function modulesForPlan(plan: string | null | undefined): ProductModule[] {
  if (plan === "trial" || plan === "api_metered") {
    return [...ALL_PRODUCT_MODULES];
  }
  switch (plan) {
    case "learn":
      return ["learn"];
    case "author":
      return ["learn", "author"];
    case "verify":
      return ["verify"];
    case "calibrate":
      return ["calibrate"];
    case "verify_calibrate":
      return ["verify", "calibrate"];
    case "learn_verify":
      return ["learn", "verify"];
    case "learn_calibrate":
      return ["learn", "calibrate"];
    case "learn_verify_calibrate":
      return ["learn", "verify", "calibrate"];
    case "author_verify":
      return ["learn", "author", "verify"];
    case "author_calibrate":
      return ["learn", "author", "calibrate"];
    case "author_verify_calibrate":
      return ["learn", "author", "verify", "calibrate"];
    default:
      return [];
  }
}

export function planHasModule(plan: string | null | undefined, module: ProductModule): boolean {
  return modulesForPlan(plan).includes(module);
}

export function canonicalPlanFromModules(
  modules: readonly ProductModule[],
): ComboPlanId | "inactive" {
  const owned = uniqueModules(modules);
  const hasAuthor = owned.includes("author");
  const hasLearn = hasAuthor || owned.includes("learn");
  const hasVerify = owned.includes("verify");
  const hasCalibrate = owned.includes("calibrate");

  if (!hasLearn && !hasVerify && !hasCalibrate) return "inactive";
  if (hasAuthor && hasVerify && hasCalibrate) return "author_verify_calibrate";
  if (hasAuthor && hasVerify) return "author_verify";
  if (hasAuthor && hasCalibrate) return "author_calibrate";
  if (hasAuthor) return "author";
  if (hasLearn && hasVerify && hasCalibrate) return "learn_verify_calibrate";
  if (hasLearn && hasVerify) return "learn_verify";
  if (hasLearn && hasCalibrate) return "learn_calibrate";
  if (hasLearn) return "learn";
  if (hasVerify && hasCalibrate) return "verify_calibrate";
  if (hasVerify) return "verify";
  return "calibrate";
}

export function modulesForSku(sku: ModuleSkuId): ProductModule[] {
  switch (sku) {
    case "trial_3day":
      return [...ALL_PRODUCT_MODULES];
    case "module_learn":
      return ["learn"];
    case "module_author":
      return ["learn", "author"];
    case "module_verify":
      return ["verify"];
    case "module_calibrate":
      return ["calibrate"];
    case "bundle_verify_calibrate":
      return ["verify", "calibrate"];
  }
}

export function planIdForSku(sku: ModuleSkuId): ModulePlanId {
  if (sku === "trial_3day") return "trial";
  return canonicalPlanFromModules(modulesForSku(sku)) as ComboPlanId;
}

export function priceCentsForModules(modules: readonly ProductModule[]): number {
  const owned = uniqueModules(modules);
  let cents = 0;
  if (owned.includes("author")) cents += AUTHOR_MONTHLY_PRICE_CENTS;
  else if (owned.includes("learn")) cents += LEARN_MONTHLY_PRICE_CENTS;
  if (owned.includes("verify") && owned.includes("calibrate")) {
    cents += VERIFY_CALIBRATE_BUNDLE_PRICE_CENTS;
  } else if (owned.includes("verify")) {
    cents += VERIFY_MONTHLY_PRICE_CENTS;
  } else if (owned.includes("calibrate")) {
    cents += CALIBRATE_MONTHLY_PRICE_CENTS;
  }
  return cents;
}

export function priceCentsForPlan(plan: string | null | undefined): number {
  if (plan === "inactive") return 0;
  if (plan === "trial") return TRY_EVERYTHING_PRICE_CENTS;
  if (plan === "api_metered") return 9900;
  return priceCentsForModules(modulesForPlan(plan));
}

export function mergePlanIds(
  current: string | null | undefined,
  incoming: string | null | undefined,
): ModulePlanId {
  if (incoming === "api_metered" || current === "api_metered") return "api_metered";
  if (incoming === "trial") {
    if (current && current !== "inactive" && current !== "trial" && isComboPlanId(current)) {
      return current;
    }
    return "trial";
  }
  if (!incoming || incoming === "inactive") {
    if (current === "trial") return "trial";
    if (current === "api_metered") return "api_metered";
    if (current && isComboPlanId(current)) return current;
    return "inactive";
  }
  if (current === "trial" || !current || current === "inactive") {
    if (isComboPlanId(incoming)) return incoming;
    return "inactive";
  }
  const merged = canonicalPlanFromModules([
    ...modulesForPlan(current),
    ...modulesForPlan(incoming),
  ]);
  return merged === "inactive" ? "inactive" : merged;
}

export function skuAlreadyCovered(
  currentPlan: string | null | undefined,
  sku: ModuleSkuId,
): boolean {
  if (sku === "trial_3day") return false;
  if (currentPlan === "trial" || currentPlan === "inactive" || !currentPlan) return false;
  const owned = new Set(modulesForPlan(currentPlan));
  return modulesForSku(sku).every((module) => owned.has(module));
}

export type ResolvedModuleCheckout = {
  sku: ModuleSkuId;
  plan: ModulePlanId;
  unitAmount: number;
  mode: "subscription" | "payment";
  alreadyEntitled: boolean;
};

export function resolveModuleCheckout(
  currentPlan: string | null | undefined,
  sku: ModuleSkuId,
): ResolvedModuleCheckout {
  if (sku === "trial_3day") {
    return {
      sku,
      plan: "trial",
      unitAmount: TRY_EVERYTHING_PRICE_CENTS,
      mode: "payment",
      alreadyEntitled: false,
    };
  }

  const incoming = planIdForSku(sku);
  const alreadyEntitled = skuAlreadyCovered(currentPlan, sku);
  const plan = alreadyEntitled ? (currentPlan as ModulePlanId) : mergePlanIds(currentPlan, incoming);
  return {
    sku,
    plan,
    unitAmount: alreadyEntitled ? 0 : priceCentsForPlan(plan),
    mode: "subscription",
    alreadyEntitled,
  };
}

export const MODULE_LABELS: Record<ProductModule, string> = {
  learn: "Learning",
  author: "Course authoring",
  verify: "Verification",
  calibrate: "Calibration",
};

export function planDisplayName(plan: string | null | undefined): string {
  if (plan === "inactive") return "Free";
  if (plan === "trial") return "Try everything";
  if (plan === "api_metered") return "API Metered";
  const modules = modulesForPlan(plan);
  if (modules.length === 0) return plan || "Free";
  return modules.map((module) => MODULE_LABELS[module]).join(" + ");
}

export function planFeatureList(plan: string | null | undefined): string[] {
  const modules = modulesForPlan(plan);
  const features: string[] = [];
  if (modules.includes("learn")) features.push("Learning workspaces and Learn sessions");
  if (modules.includes("author")) features.push("Course authoring and Your Shop (All You Can Learn listings)");
  if (modules.includes("verify")) features.push("Verification workspaces and knowledge regions");
  if (modules.includes("calibrate")) features.push("Calibration workspaces and knowledge regions");
  if (plan === "trial") features.unshift("All modules for 3 days");
  if (plan === "api_metered") {
    features.push("Proof-of-Work API keys + MCP");
    features.push("$99/mo platform + usage");
  }
  if (features.length === 0) {
    features.push("Home, My Maps, and Quick Work Session");
    features.push("3 sessions per week");
  }
  return features;
}

export type PublicSkuCard = {
  id: ModuleSkuId;
  eyebrow: string;
  name: string;
  priceLabel: string;
  cadence: string;
  body: string;
  features: readonly string[];
  cta: string;
  highlighted?: boolean;
};

export const PUBLIC_SKU_CARDS: readonly PublicSkuCard[] = [
  {
    id: "trial_3day",
    eyebrow: "TRY EVERYTHING",
    name: "Try everything",
    priceLabel: formatUsdFromCents(TRY_EVERYTHING_PRICE_CENTS),
    cadence: "one-time · 3 days",
    body: "Learning, course authoring, Verification, and Calibration for three days. One payment.",
    features: [
      "All modules for 3 days",
      "Learning and Your Shop",
      "Verification and Calibration",
      `${formatUsdFromCents(TRY_EVERYTHING_PRICE_CENTS)} one-time`,
    ],
    cta: `Try everything for ${formatUsdFromCents(TRY_EVERYTHING_PRICE_CENTS)}`,
    highlighted: true,
  },
  {
    id: "module_learn",
    eyebrow: "LEARNING",
    name: "Learning",
    priceLabel: formatUsdFromCents(LEARN_MONTHLY_PRICE_CENTS),
    cadence: "/ month",
    body: "Learn in workspaces. Open the foraging loop without listing a shop.",
    features: [
      "Learning workspaces",
      "Learn sessions",
      "Unlimited workspaces on this module",
    ],
    cta: "Get Learning",
  },
  {
    id: "module_author",
    eyebrow: "AUTHORING",
    name: "Course authoring",
    priceLabel: formatUsdFromCents(AUTHOR_MONTHLY_PRICE_CENTS),
    cadence: "/ month",
    body: "Learning plus the tools to build courses and sell them in Your Shop.",
    features: [
      "Includes Learning",
      "Course authoring",
      "Your Shop · All You Can Learn listings",
    ],
    cta: "Get course authoring",
  },
  {
    id: "module_verify",
    eyebrow: "VERIFICATION",
    name: "Verification",
    priceLabel: formatUsdFromCents(VERIFY_MONTHLY_PRICE_CENTS),
    cadence: "/ month",
    body: "Verification workspaces and knowledge regions. Measure held knowledge.",
    features: [
      "Verification workspaces",
      "Knowledge regions",
      "Deep Project and live runs on this module",
    ],
    cta: "Get Verification",
  },
  {
    id: "module_calibrate",
    eyebrow: "CALIBRATION",
    name: "Calibration",
    priceLabel: formatUsdFromCents(CALIBRATE_MONTHLY_PRICE_CENTS),
    cadence: "/ month",
    body: "Calibration workspaces and knowledge regions. Write the opening picture of a domain.",
    features: [
      "Calibration workspaces",
      "Knowledge regions",
      "Calibrate sessions",
    ],
    cta: "Get Calibration",
  },
  {
    id: "bundle_verify_calibrate",
    eyebrow: "BUNDLE",
    name: "Verification + Calibration",
    priceLabel: formatUsdFromCents(VERIFY_CALIBRATE_BUNDLE_PRICE_CENTS),
    cadence: "/ month",
    body: "Both measurement modules together.",
    features: [
      "Verification workspaces and regions",
      "Calibration workspaces and regions",
      "Bundle price for both modules",
    ],
    cta: "Get the bundle",
  },
] as const;

/** Public /pricing list. Course authoring lives on /pricing/authoring. */
export const PRICING_PAGE_SKUS: readonly PublicSkuCard[] = PUBLIC_SKU_CARDS.filter(
  (card) => card.id !== "module_author",
);

export const AUTHORING_SKU_CARD = PUBLIC_SKU_CARDS.find(
  (card) => card.id === "module_author",
)!;

export function moduleSkuCheckoutPriceData(
  sku: ModuleSkuId,
  unitAmount: number,
  plan: ModulePlanId,
) {
  const card = PUBLIC_SKU_CARDS.find((row) => row.id === sku);
  const name = card?.name ?? planDisplayName(plan);
  if (sku === "trial_3day") {
    return {
      currency: "usd" as const,
      unit_amount: unitAmount,
      product_data: {
        name: "Uncertain Systems — Try everything (3 days)",
        description: "All modules for 3 days. One-time payment.",
      },
    };
  }
  return {
    currency: "usd" as const,
    unit_amount: unitAmount,
    recurring: { interval: "month" as const },
    product_data: {
      name: `Uncertain Systems — ${name}`,
      description: planFeatureList(plan).join(" · "),
    },
  };
}
