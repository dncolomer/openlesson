/**
 * Combined Vision + Science hub: one entry, jump links to the part you care about.
 * Canonical URL stays /science so existing hashes and papers keep working.
 */

import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH } from "@/lib/science/knowledge-tomography-whitepaper";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";
import { TAP_WHITEPAPER_PATH } from "@/lib/science/tap-stash-submit-whitepaper";

export const SCIENCE_HUB_PATH = "/science" as const;
export const SCIENCE_WHY_PATH = "/science#why" as const;
export const SCIENCE_THESIS_PATH = "/science#science-thesis-slide" as const;
export const SCIENCE_FEP_PATH = "/science#science-free-energy" as const;
export const SCIENCE_RESEARCH_PATH = "/science#research" as const;
export const SCIENCE_TOMOGRAPHY_PATH = "/science#knowledge-tomography-induction" as const;

export const SCIENCE_HUB_COPY = {
  eyebrowVision: "VISION",
  eyebrowScience: "SCIENCE",
  title: "Automating Human Learning",
  lead:
    "We are building self-driving technology for learning: non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy. The science is a physical view of knowledge — configuration, proximity, and a shorter path through it.",
  workspaceCta: "Create your Workspace",
  workspaceHref: "/workspace/new",
  directoryEyebrow: "START HERE",
  directoryTitle: "Pick the part you care about.",
  directoryLead: "Same page. Jump to the why, the policy, the generative model, or the papers.",
  whyEyebrow: "WHY",
  whyTitle: "Why we exist",
} as const;

export const SCIENCE_HUB_WHY = [
  {
    eyebrow: "Problem",
    title: "Low ROI Learning",
    body: "For most people, learning is physically and mentally expensive. Attention, retention, and deep understanding still require too much effort for the output they get back.",
  },
  {
    eyebrow: "Vision",
    title: "Self-Driving Learning",
    body: "We are building non-invasive technology that guarantees the same or more human learning with significantly less physical and mental effort.",
  },
  {
    eyebrow: "Goal",
    title: "More Attention, Same Energy",
    body: "Increase attention markers without a proportional energy cost to the user, then compound that into a full automation stack for human learning.",
  },
] as const;

export type ThesisDeepLink = {
  href: string;
  label: string;
  hint: string;
};

export const SCIENCE_HUB_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: "#why", label: "Why we exist", hint: "Problem, goal, self-driving learning" },
  { href: "#science-thesis-slide", label: "The thesis", hint: "Knowledge as proximity" },
  { href: "#science-free-energy", label: "Free Energy Principle", hint: "Learning is reducing uncertainty" },
  { href: "#science-epistemic-foraging", label: "Epistemic foraging", hint: "Search, not scores" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
  {
    href: "#knowledge-tomography-induction",
    label: "Tomography & induction",
    hint: "Measure, then steer",
  },
  { href: "#research", label: "Working papers", hint: "TAP and knowledge tomography" },
];

export const HARNESS_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Hidden states, actions, policy" },
  { href: SCIENCE_WHY_PATH, label: "Why we exist", hint: "Self-driving learning" },
];

export const VERIFICATION_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "The policy" },
  { href: SCIENCE_TOMOGRAPHY_PATH, label: "Knowledge tomography", hint: "Measure what is held" },
  { href: TAP_WHITEPAPER_PATH, label: "Think Aloud Protocol", hint: "How we collect proof" },
];

export const HARNESS_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_EPISTEMIC_FORAGING_PATH, label: "Epistemic foraging", hint: "What you are paying to run" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "Calibrate, Learn, the generative model" },
];

export const VERIFICATION_PRICING_THESIS_LINKS: readonly ThesisDeepLink[] = [
  { href: SCIENCE_TOMOGRAPHY_PATH, label: "Knowledge tomography", hint: "Why this is not an exam" },
  { href: TAP_WHITEPAPER_PATH, label: "Think Aloud Protocol", hint: "Live probe vs deep project" },
  { href: KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH, label: "Tomography paper", hint: "The measurement method" },
];
