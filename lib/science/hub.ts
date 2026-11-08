/**
 * Combined Vision + Science hub: one entry, jump links to the part you care about.
 * Canonical URL stays /science so existing hashes keep working.
 *
 * Visitor strings in this file are an FEP public surface: do not say "map".
 */

import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const SCIENCE_HUB_PATH = "/science" as const;
export const SCIENCE_WHY_PATH = "/science#why" as const;
export const SCIENCE_FEP_PATH = "/science#science-free-energy" as const;
export const SCIENCE_TOMOGRAPHY_PATH = "/science#knowledge-tomography-induction" as const;
export const SCIENCE_ENHANCEMENT_PATH = "/science#cognitive-enhancement" as const;
export const SCIENCE_SYMBIOSIS_PATH = "/science#human-ai-symbiosis" as const;
export const SCIENCE_HORIZON_PATH = "/science#software-and-research" as const;
export const SCIENCE_REFERENCES_PATH = "/science#science-references" as const;

export const SCIENCE_HUB_COPY = {
  eyebrowVision: "VISION",
  eyebrowScience: "SCIENCE",
  title: "Tools for knowledge building on autopilot",
  description:
    "Scientific influences, current software, and a longer-term aim: systems that adapt around a mind so difficult knowledge takes less cognitive effort to acquire. The science includes epistemic foraging.",
  lead: [
    "Uncertain Systems is the autopilot for knowledge building. That sentence is a vision: a system that adapts around a person's mind, so difficult knowledge takes less cognitive effort to acquire, and the gap between what machines can discover and what people can understand gets smaller.",
    "Today's software is narrower. Authors define knowledge regions and solve flows. People work through hard problems in Calibrate, Learn, Verify, and Solve sessions. The system records observable work, estimates a provisional knowledge state on a generative model, and can suggest a next step in that model. Understanding still happens in the person. The longer-term aim is knowledge acquisition with less conscious steering and less effort spent managing the path. That aim remains a research horizon, and it is not knowledge uploading.",
  ],
  workspaceCta: "Create your Workspace",
  workspaceHref: "/workspace/new",
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "Jump to a section.",
  directoryLead:
    "Why understanding matters, the scientific influences, the measurement frame, and the research horizon.",
  whyEyebrow: "WHY",
  whyTitle: "Why human understanding matters",
  whyImageSrc: "/why.jpg",
  whyImageAlt:
    "Field depth pulling away from the people who can understand and teach it: thermodynamic computing, quantum computing, and mathematics as examples of growing nested structure.",
  whyP1:
    "New knowledge keeps arriving, and its nested structure keeps getting deeper. Fields such as thermodynamic computing, quantum computing, and mathematics are examples: more material, and more structure inside it. A person still has to understand, retain, and teach that structure. The capacity to do so does not automatically keep pace with the field.",
  whyP2:
    "The same pressure now shows up as an understanding gap. A model can produce a useful proof, a technical design, or a long argument that still exceeds someone's ability to inspect, question, and use it. We exist to close that gap: to make difficult knowledge cheaper, in cognitive demand, to acquire, while the person's understanding remains the point of the work.",
  whyP3:
    "Closing that gap is why this work exists. Today's software guides exploration through hard problems, stores the work, and estimates a provisional knowledge state. The larger aim is less cognitive effort spent acquiring the understanding that machines can already outrun.",
  whyProofEyebrow: "EXAMPLE",
  whyProofTitle: "A difficult proof",
  whyProof:
    "Take an AI-generated mathematical proof that a team cannot yet stand behind. A person still has to work through its assumptions, intermediate reasoning, and unfamiliar concepts. Human interpretability here means acquiring enough understanding to question and use the work. It is distinct from mechanistic interpretability of a model's internals, and distinct from automatic proof certification. The system's proposed role is to identify gaps in that understanding and to structure further investigation.",
  whyContexts:
    "The same pattern appears in technical hiring and in company expertise. A candidate or a colleague can reach an answer, or read the documentation, and still be unable to explore an unfamiliar constraint. Verification, in that setting, is about exploration and reasoning, including work with an allowed model or harness when the problem says so. It is about the path, including the final answer. A score from that path does not, by itself, predict job performance.",
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
  { href: "#why", label: "Why human understanding matters", hint: "The understanding gap" },
  { href: "#science-free-energy", label: "Free Energy Principle", hint: "Uncertainty as influence" },
  { href: "#science-epistemic-foraging", label: "Epistemic foraging", hint: "Information-seeking policy" },
  { href: SCIENCE_LEARNING_MODEL_PATH, label: LEARNING_MODEL_PUBLIC_LABEL, hint: "A generative model you can act on" },
  {
    href: "#knowledge-tomography-induction",
    label: "Tomography and induction",
    hint: "Policy, measurement, transformation",
  },
  { href: "#cognitive-enhancement", label: "Cognitive enhancement", hint: "Three overlapping approaches" },
  { href: "#human-ai-symbiosis", label: "Human-AI symbiosis", hint: "Adaptive-loop framing" },
  { href: "#software-and-research", label: "Software and research", hint: "Now versus horizon" },
  { href: "#science-references", label: "References", hint: "Influences and reviews" },
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
