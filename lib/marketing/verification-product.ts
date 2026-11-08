import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { VERIFICATION_THESIS_LINKS } from "@/lib/science/hub";
import {
  DISCOVERY_CTA_LABEL,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  LEARNING_HARNESS_PATH,
  USE_CASES_PATH,
  discoveryMailto,
} from "@/lib/marketing/paths";

export const VERIFICATION_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE VERIFICATION",
  title: "Assess understanding through hard problems.",
  lead: "Look beyond the final answer. Examine how someone explores a demanding problem, tests assumptions and develops their reasoning.",
  body: "Knowledge Verification uses a supported session around a target you define. The useful record is the work itself: exploration, checks, and reasoning, together with the result. Interpretation depends on the conditions you stated and the work observed. One session is evidence for a decision, not definitive proof that someone holds a skill.",
  pricingCta: "See pricing",
  pricingHref: HARNESS_PRICING_PATH,
  discoveryCta: DISCOVERY_CTA_LABEL,
  discoveryHref: discoveryMailto("Knowledge verification use case"),
} as const;

export const VERIFICATION_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "Relate work to a defined knowledge region.",
  p1: "Define a knowledge region and a problem that represents the understanding you care about. Run a Verify session against that target. The session stores canvas work from the timed problem. Workspace views can then show how that work sits relative to the region in the current model.",
  p2: "Distance in this setting is a model-specific relationship to the reference domain. It is not an intelligence score, a certified skill measurement, or a validated predictor of job performance. Regions stay in the workspace that owns them. That is an access boundary, not a confidentiality guarantee.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "Illustrative projection of knowledge regions. Positions and distances describe a relationship in the model, grounded in recorded work.",
  imageSrc: "/regions1.png",
  imageAlt:
    "Illustrative 2D projection of knowledge regions for Physics, Maths, Code, and Design, with positions and distances",
} as const;

export const VERIFICATION_FLOW_COPY = {
  eyebrow: "IN PRACTICE",
  title: "Define the target, run the session, examine the work.",
  steps: [
    {
      title: "Set the target",
      body: "Choose the knowledge region and the problem that should reveal the understanding you care about. Spell out the conditions of the session, including whether an AI tool is allowed. Those conditions live in the problem. The product does not enforce a tool policy.",
    },
    {
      title: "Run the session",
      body: "The person works the question on the canvas before the clock ends. Speech, writing, and drawing are the supported ways to make that reasoning visible, matching the session that is actually running. Work is stored when the session ends.",
    },
    {
      title: "Examine the evidence",
      body: "Review the stored work alongside the model-relative result. A correct answer is one part of that record. Use it to support a hiring or development conversation. Do not treat it as a total measure of the person.",
    },
  ],
  aiNote:
    "Assessment with an explicitly allowed AI tool is a relevant scenario: the work then includes how someone uses, questions, and revises model suggestions. The platform records the work under the conditions you stated. It does not police those conditions.",
} as const;

export const VERIFICATION_APPROACH_COPY = {
  eyebrow: "THE MODEL",
  title: "How the model informs verification",
  p1: "Uncertain Systems uses an unsys model built from the concept you are examining: hidden states, observations, priced edges, and a policy. Hosted Calibrate, Learn, and Verify sessions act on that frozen model. Observable work is the input. The model estimates a provisional relationship to the target. Understanding still happens in the person.",
  p2: "Conversational sessions follow a Free Energy Principle influence based on epistemic foraging: search for information that reduces uncertainty about what is held. That policy can shape what the session asks next. It is an influence on the software, not a claim that the result is scientifically validated or immune to assistance.",
  p3: "A related application is examining how an agent setup works a defined problem. That use needs a confirmed configuration. It is not evidence that people and agents are measured the same way.",
  foraging:
    "The session searches for information that reduces uncertainty about what is held. That policy is epistemic foraging.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
  thesisLinks: VERIFICATION_THESIS_LINKS,
  directoryEyebrow: "THESIS",
  directoryTitle: "The science.",
  related:
    "Use Knowledge Mapping as the domain reference, and Knowledge Acquisition when the evidence points to further development.",
  relatedLinks: [
    { href: `${USE_CASES_PATH}#technical-hiring`, label: "Hard-problem assessment" },
    { href: LEARNING_HARNESS_PATH, label: "Knowledge Acquisition" },
    { href: KNOWLEDGE_MAPPING_PATH, label: "Knowledge Mapping" },
  ],
} as const;

export const VERIFICATION_SCALE_COPY = {
  eyebrow: "VERIFICATION AT SCALE",
  title: "Verify and rank knowledge against your own knowledge regions at scale.",
  p1: "The same measurement stack can run knowledge verification for many people against the same knowledge regions, without placing proprietary skills and specs into a public repository.",
  p2: "Hosted Calibrate, Learn, and Verify sessions run live, time-framed verification in parallel, without building your own session interface. Learn adds open-ended assignment depth as volume grows.",
  imageSrc: "/ranking_app.png",
  imageAlt: "Ranking by proximity to a knowledge region bar",
} as const;
