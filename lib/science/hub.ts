/**
 * Combined Vision + Science hub: one entry, jump links to the part you care about.
 * Canonical URL stays /science so existing hashes keep working.
 */

import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const SCIENCE_HUB_PATH = "/science" as const;
export const SCIENCE_WHY_PATH = "/science#why" as const;
export const SCIENCE_FEP_PATH = "/science#science-free-energy" as const;
export const SCIENCE_TOMOGRAPHY_PATH = "/science#knowledge-tomography-induction" as const;

export const SCIENCE_HUB_COPY = {
  eyebrowVision: "VISION",
  eyebrowScience: "SCIENCE",
  title: "Tools for knowledge building on autopilot",
  lead:
    "Uncertain Systems is creating tools for knowledge building on autopilot. We guide people through hard problems to build knowledge, verify understanding and make sense of complex AI-generated work. The exploration is guided, but the thinking stays yours: autopilot means the system helps choose what to explore next, not that understanding happens without you.",
  workspaceCta: "Create your Workspace",
  workspaceHref: "/workspace/new",
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "Jump to a section.",
  directoryLead: "Why we exist, the policy, the generative model, or how we measure.",
  whyEyebrow: "WHY",
  whyTitle: "Why we exist",
  whyImageSrc: "/why.jpg",
  whyImageAlt:
    "Field depth versus people who can teach it: thermodynamic computing, quantum computing, and mathematics pull away from the number of experts who can teach, and the gap grows every year.",
  whyP1:
    "New knowledge is expanding, and the depth of that knowledge is accelerating. Fields such as thermodynamic computing, quantum computing, and mathematics steepen every year: more material, and more nested structure inside it.",
  whyP2:
    "Explainability and human acquisition stay slow. A person still has to understand, retain, and teach. The number of experts who can carry that depth grows on a nearly flat line.",
  whyP3:
    "The gap between field depth and people who can teach it widens every year. We exist to close it with tools for knowledge building on autopilot: guided exploration through hard problems, while the thinking stays yours.",
} as const;

export type ThesisDeepLink = {
  href: string;
  label: string;
  hint: string;
};

export const SCIENCE_HUB_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: "#why", label: "Why we exist", hint: "The teaching gap" },
  { href: "#science-free-energy", label: "Free Energy Principle", hint: "Learning is reducing uncertainty" },
  { href: "#science-epistemic-foraging", label: "Epistemic foraging", hint: "Search, not scores" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
  {
    href: "#knowledge-tomography-induction",
    label: "Tomography & induction",
    hint: "Measure, then steer",
  },
];

export const HARNESS_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Hidden states, actions, policy" },
  { href: SCIENCE_WHY_PATH, label: "Why we exist", hint: "The teaching gap" },
];

export const VERIFICATION_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_TOMOGRAPHY_PATH, label: "Knowledge tomography", hint: "Measure what is held" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Hidden states, actions, policy" },
];

export const MAPPING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "Learning is reducing uncertainty" },
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
];

export const HARNESS_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "What you are paying to run" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Calibrate, Learn, the generative model" },
];

export const VERIFICATION_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_TOMOGRAPHY_PATH, label: "Knowledge tomography", hint: "Why this is not an exam" },
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
];
