import {
  BRAIN_PRIMING_JOIN_PATH,
  BRAIN_PRIMING_PATH,
} from "@/lib/marketing/paths";

export { BRAIN_PRIMING_JOIN_PATH, BRAIN_PRIMING_PATH };

export const BRAIN_PRIMING_PLANS = ["3", "6"] as const;
export type BrainPrimingPlanMonths = (typeof BRAIN_PRIMING_PLANS)[number];

export const BRAIN_PRIMING_DOMAINS = [
  { id: "mathematics", name: "Mathematics" },
  { id: "computer-science", name: "Computer science" },
  { id: "chemistry-biology", name: "Chemistry and biology" },
] as const;
export type BrainPrimingDomainId = (typeof BRAIN_PRIMING_DOMAINS)[number]["id"];

const DOMAIN_IDS = new Set(BRAIN_PRIMING_DOMAINS.map((item) => item.id));

/**
 * Brain Priming Protocol: you name the subject, we build the map.
 * Mathematics, computer science, or chemistry and biology.
 * Weekly tailored Solve + Verify. Next dose follows that work.
 * Waitlist: email, domain, what you want to learn.
 */
export const BRAIN_PRIMING_COPY = {
  pill: "BRAIN PRIMING",
  title: "Brain Priming Protocol",
  kicker: "brain priming",
  positioning: "tailored to you",
  product: "supplement",
  h1: "Tell us what you want to learn. The map and the supplement follow.",
  p1: "The Brain Priming Protocol starts with your subject. Mathematics, computer science, or chemistry and biology. We build a Learning Map and tailored exercises around exactly that.",
  p2: "Each week you Solve, then Verify, on that map. The work is brain priming, tailored to you. The supplement follows the same weeks. Three months or six.",
  lead:
    "Brain Priming Protocol: tell us what you want to learn. Weekly tailored exercises plus a brain priming supplement tailored to you.",
  thesisTitle: "Your subject first",
  thesis:
    "You tell us what you want to learn. Weekly Solve and Verify work on that map is the primary signal used to customize that supplement.",
  domains: {
    eyebrow: "SUBJECTS",
    title: "Mathematics. Computer science. Chemistry and biology.",
    lead: "Pick a field. Then tell us the exact thing you want to hold.",
    items: [
      {
        id: "mathematics" as const,
        name: "Mathematics",
        body: "Analysis, algebra, probability, the proof you keep missing.",
      },
      {
        id: "computer-science" as const,
        name: "Computer science",
        body: "Systems, algorithms, ML internals, the stack you actually need.",
      },
      {
        id: "chemistry-biology" as const,
        name: "Chemistry and biology",
        body: "Mechanisms, pathways, lab-hard topics where slides are not enough.",
      },
    ],
  },
  loop: {
    eyebrow: "HOW IT RUNS",
    title: "You name it. We build the week. The bottle follows.",
    items: [
      {
        eyebrow: "01",
        name: "You tell us",
        body: "The field, and the exact topic. That is the brief. The program is built around it.",
      },
      {
        eyebrow: "02",
        name: "Tailored exercises",
        body: "A Learning Map of Solve and Verify flows on that topic. You run it every week.",
      },
      {
        eyebrow: "03",
        name: "The supplement",
        body: "One initial blood result, then the next month's dose follows how you worked the map.",
      },
    ],
  },
  spine: {
    eyebrow: "THE PLAN",
    title: "Your subject, the map, the bottles.",
    items: [
      {
        eyebrow: "TOPIC",
        name: "What you want to learn",
        body: "You name it. We do not hand you a generic course.",
      },
      {
        eyebrow: "MAP",
        name: "Tailored exercises",
        body: "Weekly Solve and Verify on a Learning Map built for that subject.",
      },
      {
        eyebrow: "BOTTLE",
        name: "The supplement",
        body: "A third-party manufacturer packs a food supplement for Europe and the US, adapted each month from that work.",
      },
      {
        eyebrow: "ACCESS",
        name: "Uncertain Systems included",
        body: "The plan covers the map, the flows, and the bottles. You bring the topic and one blood result.",
      },
    ],
  },
  plans: {
    eyebrow: "TERM",
    title: "Three months or six.",
    lead: "Pick a term. Everything in the protocol is inside it.",
    items: [
      {
        id: "3" as const,
        name: "3 months",
        body: "Twelve weeks on the map. Three monthly bottles. Dose adapts after each month of work.",
      },
      {
        id: "6" as const,
        name: "6 months",
        body: "Twenty-four weeks on the map. Six monthly bottles. Dose adapts after each month of work.",
      },
    ],
  },
  layers: {
    eyebrow: "INSIDE THE OFFER",
    title: "Your topic, tailored exercises, the bottle.",
    items: [
      {
        eyebrow: "TOPIC",
        name: "What you want to learn",
        body: "Mathematics, computer science, or chemistry and biology. You name the exact cut.",
        image: "/lp-boxes/harness-books-blueprint.jpg",
        imageAlt: "Blueprint of a gridded notebook and volumes",
      },
      {
        eyebrow: "EXERCISES",
        name: "Weekly Solve and Verify",
        body: "A Learning Map built for that topic. Tailored exercises. You run it every week.",
        image: "/lp-boxes/tapbench-maps-blueprint.jpg",
        imageAlt: "Blueprint of a folded map and compass",
      },
      {
        eyebrow: "SUPPLEMENT",
        name: "Next month's bottle",
        body: "Packed as a supplement. The dose follows last month's work on your map.",
        image: "/lp-boxes/verification-bottles-blueprint.jpg",
        imageAlt: "Blueprint of laboratory bottles",
      },
    ],
  },
  ingredientsTitle: "In the bottle",
  ingredientsLead: "A clean stack. Europe and the US. Dose moves with your weeks.",
  ingredients: [
    { name: "Caffeine + L-theanine", role: "Clean focus when the week asks for it." },
    { name: "Bacopa", role: "Staying power across the map." },
    { name: "Creatine", role: "Fuel when the weeks run long." },
    { name: "Citicoline", role: "Sharp attention on Solve." },
    { name: "Omega-3 (DHA)", role: "The long game." },
    { name: "Magnesium", role: "Settle the system." },
    { name: "B12 and D", role: "In the bottle only if the baseline says so." },
  ],
  bloodTitle: "One initial blood result",
  bloodLead:
    "When the protocol starts, you supply one nutrition panel. Vitamin D, B12, ferritin, omega-3, and magnesium. That baseline plus weekly Solve and Verify set the dose. Wellness only: not a diagnosis.",
  waitlist: {
    pill: "WAITLIST",
    title: "Join the waitlist",
    h1: "Tell us what you want to learn.",
    lead: "Pick a field, name the topic, leave an email. Waitlist only. No checkout yet.",
    submit: "Join the waitlist",
    note: "Waitlist only. Blood comes later, when the protocol starts, and is not scored as a diagnosis.",
    success: "You're on the waitlist. We will write when a seat opens.",
    planLabel: "Plan",
    emailLabel: "Email",
    domainLabel: "Field",
    topicLabel: "What you want to learn",
    topicPlaceholder: "The exact topic. A course, a proof, a system, a mechanism.",
  },
  disclaimer:
    "Food / dietary supplement for brain priming, tailored to you. These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. In the EU and UK it is a food supplement, not a medicine.",
  ctaStart: "Start the protocol",
  ctaStartHref: "#join",
  ctaSecondary: "How the week runs",
  ctaSecondaryHref: "#how",
} as const;

export type BrainPrimingWaitlistInput = {
  email: string;
  domain?: string;
  topic?: string;
  plan?: BrainPrimingPlanMonths | string;
};

export type BrainPrimingWaitlistResult = {
  stored: "waitlist";
  scored: false;
  diagnostic: false;
  domain: BrainPrimingDomainId | null;
  topic: string;
  plan: BrainPrimingPlanMonths | null;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBrainPrimingPlan(
  value: unknown,
): BrainPrimingPlanMonths | null {
  const raw = String(value || "").trim();
  if (raw === "3" || raw === "6") return raw;
  return null;
}

export function normalizeBrainPrimingDomain(
  value: unknown,
): BrainPrimingDomainId | null {
  const raw = String(value || "").trim();
  if (DOMAIN_IDS.has(raw as BrainPrimingDomainId)) return raw as BrainPrimingDomainId;
  return null;
}

/** Record waitlist: email, what they want to learn. No files, no diagnosis. */
export function storeBrainPrimingWaitlist(
  input: BrainPrimingWaitlistInput,
): BrainPrimingWaitlistResult {
  const email = String(input.email || "").trim();
  if (!EMAIL_RE.test(email)) {
    throw new Error("A valid email is required to join the waitlist.");
  }
  const topic = String(input.topic || "").trim();
  if (topic.length < 3) {
    throw new Error("Tell us what you want to learn.");
  }
  const domain = normalizeBrainPrimingDomain(input.domain);
  const plan = normalizeBrainPrimingPlan(input.plan);
  return {
    stored: "waitlist",
    scored: false,
    diagnostic: false,
    domain,
    topic,
    plan,
    message: BRAIN_PRIMING_COPY.waitlist.success,
  };
}

function walkStrings(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, into);
  }
}

export function brainPrimingFullText(): string {
  const parts: string[] = [];
  walkStrings(BRAIN_PRIMING_COPY, parts);
  return parts.join("\n");
}
