/**
 * Public science hub at /science.
 * Visitor strings in this file are an FEP public surface: do not say "map".
 */

import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const SCIENCE_HUB_PATH = "/science" as const;
export const SCIENCE_WHY_PATH = "/science#why" as const;
export const SCIENCE_FEP_PATH = "/science#science-free-energy" as const;
export const SCIENCE_UNSYS_PATH = "/science#science-unsys-model" as const;
export const SCIENCE_TOMOGRAPHY_PATH = "/science#science-free-energy" as const;
export const SCIENCE_ENHANCEMENT_PATH = "/science" as const;
export const SCIENCE_SYMBIOSIS_PATH = "/science" as const;
export const SCIENCE_HORIZON_PATH = "/science" as const;
export const SCIENCE_REFERENCES_PATH = "/science" as const;

export const SCIENCE_HUB_COPY = {
  eyebrowScience: "SCIENCE",
  title: "Science",
  description:
    "Why answers are no longer enough, the Free Energy Principle, and the Unsys model that reads how a person reasons.",
  lead: [
    "Universities and employers can't trust answers anymore because AI writes them. We show how a person reasons through a real problem, with or without AI in the loop, so they can grade and hire with confidence.",
  ],
  workspaceCta: "Open dashboard",
  workspaceHref: "/dashboard",
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "Jump to a section.",
  directoryLead: "Why this matters, the Free Energy Principle, and the Unsys model.",
  whyEyebrow: "WHY",
  whyTitle: "Why this matters",
  whyImageSrc: "/science/why.jpg",
  whyImageAlt:
    "Pitch quote: universities and employers cannot trust answers anymore because AI writes them.",
  whyP1:
    "Universities and employers can't trust answers anymore because AI writes them. We show how a person reasons through a real problem, with or without AI in the loop, so they can grade and hire with confidence.",
  whyP2:
    "A finished answer can be generated. Understanding has to be shown as work: what someone asks, revises, and checks. That is why this page exists. The rest is the science that makes that work readable.",
  fepImageSrc: "/science/proof-of-work.jpg",
  fepImageAlt:
    "Pitch work canvas: spoken questions, canvas revisions, and checks projected onto hidden states.",
  unsysEyebrow: "UNSYS MODEL",
  unsysTitle: "The Unsys model",
  unsysKicker: "Hidden states, state factors, priced edges",
  unsysImageSrc: "/science/unsys-model.jpg",
  unsysImageAlt:
    "Pitch Unsys model for integrals: hidden states on three state factors, with priced edges and the cheapest policy marked.",
  unsysP1:
    "The Unsys model is the reference the system uses to read behaviour. Actions on the canvas and transcribed speech are projected onto its hidden states; each step is travel along a priced edge.",
  unsysP2:
    "The system can generate and simulate the model for a problem, or a lecturer or expert can adapt it.",
  unsysCallout:
    "No LLM-as-judge: behaviour is read against an explicit model you can inspect and adapt.",
  unsysP3:
    "LLM grading is unreliable and hard to explain. An explicit model is easier to explain and audit.",
  unsysExplore: "Open the Unsys model",
} as const;

export function scienceHubLeadText(
  copy: typeof SCIENCE_HUB_COPY = SCIENCE_HUB_COPY,
): string {
  return copy.lead.join("\n");
}

export type ThesisDeepLink = {
  href: string;
  label: string;
  hint: string;
};

export const SCIENCE_HUB_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: "#why", label: "Why this matters", hint: "Answers are no longer enough" },
  { href: "#science-free-energy", label: "Free Energy Principle", hint: "Reducing uncertainty" },
  { href: "#science-unsys-model", label: LEARNING_MODEL_PUBLIC_LABEL, hint: "How behaviour is read" },
];

export const HARNESS_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "Reducing uncertainty" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Hidden states, actions, policy" },
  { href: SCIENCE_WHY_PATH, label: "Why this matters", hint: "Answers are no longer enough" },
];

export const VERIFICATION_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "Reducing uncertainty" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Hidden states, actions, policy" },
  { href: SCIENCE_WHY_PATH, label: "Why this matters", hint: "Answers are no longer enough" },
];

export const MAPPING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "Learning is reducing uncertainty" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
  { href: SCIENCE_WHY_PATH, label: "Why this matters", hint: "Answers are no longer enough" },
];

export const HARNESS_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "What you are paying to run" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Calibrate, Learn, the generative model" },
];

export const VERIFICATION_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_FEP_PATH, label: "Free Energy Principle", hint: "Reducing uncertainty" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
];
