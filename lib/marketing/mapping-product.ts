import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { MAPPING_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";

export const MAPPING_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE MAPPING",
  title: "Map Human Knowledge.",
  lead: "A Knowledge Mapping product for science use cases: knowledge regions as a living map of a domain — proximity, coverage, and the path through what is held — rather than as a verification exam.",
  scienceCta: "Read the science",
  scienceHref: SCIENCE_FEP_PATH,
} as const;

export const MAPPING_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "See knowledge as position on a map of regions.",
  p1: "Every workspace puts people into a shared embedding geometry. Create knowledge regions, multi-select users, and read position live: the map shows where people sit against your defined knowledge regions.",
  p2: "Create custom knowledge regions from internal expert data and chart a domain without sharing confidential information about your internal systems. Regions stay private to the workspace.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "We help you build a living map of proximity to any kind of knowledge. Knowledge regions are the territories. People are positions on that map.",
  imageSrc: "/knowledgeg2.png",
  imageAlt:
    "Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions as a map of the domain",
} as const;

export const MAPPING_APPROACH_COPY = {
  eyebrow: "THE APPROACH",
  title: "A learning world model.",
  p1: "Uncertain Systems builds a learning world model from real work: skills, scenarios, proof of work, and where reasoning breaks. Our hosted interfaces as well as our API products are all specially designed to elicit genuine raw work data from the user while at the same time minimizing the disruption of the natural cognitive process.",
  p2: "Our conversational interfaces run on a Free Energy Principle approach based on epistemic foraging: the evolving learner model searches for information that reduces uncertainty, and steers the thinking process toward what is still unknown.",
  p3: "We plot whether people actually hold the knowledge as position on knowledge regions, grounded in genuine work traces.",
  foraging:
    "The harness searches for information that reduces uncertainty about what is held. That policy is epistemic foraging.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
  thesisLinks: MAPPING_THESIS_LINKS,
} as const;

export const MAPPING_SCALE_COPY = {
  eyebrow: "MAPPING AT SCALE",
  title: "Map knowledge against your own knowledge regions at scale.",
  p1: "The same measurement stack runs knowledge mapping at scale — many people against the same knowledge regions — without sharing proprietary skills and specs into a public repository or database.",
  p2: "Our hosted Calibrate, Learn, and Verify sessions plot live, time-framed positions in parallel, without building your own UX. Learn adds open-ended assignment depth that stays practical as volume grows. We help you surface a map that no traditional tech can beat.",
  imageSrc: "/ranking_app.png",
  imageAlt: "People plotted by proximity to a knowledge region on the map",
} as const;
