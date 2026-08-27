import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { TAPBENCH_PATH, VERIFICATION_PRICING_PATH } from "@/lib/marketing/paths";

export const VERIFICATION_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE VERIFICATION",
  title: "Verify Human Knowledge.",
  lead: "A Knowledge Verification product for enterprise use cases: confirm that knowledge is actually held, without traditional tests and exams, with the guarantee that results cannot be cheated or faked.",
  pricingCta: "See verification pricing",
  pricingHref: VERIFICATION_PRICING_PATH,
  tapbenchCta: "See TAPBench",
  tapbenchHref: TAPBENCH_PATH,
} as const;

export const VERIFICATION_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "See skill as distance in knowledge space.",
  p1: "Every workspace puts people into a shared embedding geometry. Create knowledge regions, multi-select users, and read distance to knowledge live: see how people do against your defined knowledge regions.",
  p2: "Create custom knowledge regions from internal expert data and measure your workforce readiness without sharing confidential information about your internal systems. Regions stay private to the workspace.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "We help you build a living map of proximity to any kind of knowledge. We ground our results on real and genuine work traces, with the guarantee that results cannot be cheated or faked.",
  imageSrc: "/knowledgeg2.png",
  imageAlt:
    "Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions and knowledge distance",
} as const;

export const VERIFICATION_APPROACH_COPY = {
  eyebrow: "THE APPROACH",
  title: "A learning world model.",
  p1: "Uncertain Systems builds a learning world model from real work: skills, scenarios, proof of work, and where reasoning breaks. Our hosted interfaces as well as our API products are all specially designed to elicit genuine raw work data from the user while at the same time minimizing the disruption of the natural cognitive process.",
  p2: "Our conversational interfaces run on top of an interruption model (TIM — Trace Interruption Model) that uses the evolving learner model to proactively steer the thinking process.",
  p3: "We score whether people actually hold the knowledge from genuine work traces, with the guarantee that results cannot be cheated or faked.",
  foraging:
    "The harness searches for information that reduces uncertainty about what is held. That policy is epistemic foraging.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
} as const;

export const VERIFICATION_SCALE_COPY = {
  eyebrow: "VERIFICATION AT SCALE",
  title: "Verify and rank knowledge against your own knowledge regions at scale.",
  p1: "The same measurement stack runs knowledge verification at scale — many people against the same knowledge regions — without sharing proprietary skills and specs into a public repository or database.",
  p2: "Our hosted Think Aloud Protocol (TAP) runs live, time-framed verification in parallel, without building your own UX. With our Integrated Learning Environment (ILE) we add open-ended assignment depth that stays practical as volume grows. We help you surface data that no traditional tech can beat.",
  tapbench:
    "TAPBench is the public benchmark of this stack: agents think aloud and build knowledge regions.",
  tapbenchHref: TAPBENCH_PATH,
  tapbenchLabel: "TAPBench",
  imageSrc: "/ranking_app.png",
  imageAlt: "Ranking by proximity to a knowledge region bar",
} as const;
