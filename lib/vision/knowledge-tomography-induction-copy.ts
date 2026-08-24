/**
 * Vision-page copy: knowledge tomography + knowledge induction framing.
 * Structured so tests assert terms against shipped strings (not re-implemented prose).
 */

import { KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH } from "@/lib/science/knowledge-tomography-whitepaper";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";

export const VISION_TOMOGRAPHY_INDUCTION_PATHS = {
  science: "/science",
  knowledgeTomographyPaper: KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
  epistemicForaging: SCIENCE_EPISTEMIC_FORAGING_PATH,
} as const;

/** Terms that must appear in the shipped vision copy. */
export const VISION_TOMOGRAPHY_INDUCTION_TERMS = [
  "knowledge tomography",
  "reproduce",
  "state of knowledge",
  "human",
  "agentic",
  "knowledge induction",
  "epistemic foraging",
] as const;

export const VISION_TOMOGRAPHY_INDUCTION_COPY = {
  eyebrow: "SCIENCE PATH",
  title: "Knowledge tomography, then knowledge induction.",
  lead:
    "Self-driving learning needs a policy and two complementary layers. Epistemic foraging is the policy: search for information that reduces uncertainty, rather than chasing scores. Then we measure what an entity currently holds, and steer transformation toward useful configurations with less wasted effort.",
  policy: {
    eyebrow: "Policy",
    title: "Epistemic foraging",
    body:
      "Epistemic foraging (Friston / active inference) is an active search for information that reduces uncertainty about an environment, rather than immediately chasing rewards. Tomography measures the state being foraged; induction is later steering.",
  },
  tomography: {
    eyebrow: "Measurement",
    title: "Knowledge tomography",
    body:
      "Knowledge tomography is the family of methodologies that prompt human as well as agentic entities to try to reproduce their state of knowledge—multi-angle projections of what is held, missing, and transferable, not finals alone.",
  },
  induction: {
    eyebrow: "Long-horizon aim",
    title: "Knowledge induction tech",
    body:
      "Knowledge induction is the longer-horizon aim: technology that guides transformation through knowledge configuration space—raising proximity to useful states without asking minds to burn proportionally more energy. Tomography measures; induction transforms.",
  },
  distinction:
    "We keep the layers distinct on purpose. Epistemic foraging is the policy. Tomography externalizes and reconstructs current state. Knowledge induction tech uses that measurement to steer learning. Without tomography, induction is blind steering; without induction, measurement never compounds into self-driving learning.",
  links: {
    scienceLabel: "Science thesis",
    paperLabel: "Knowledge tomography white paper",
    foragingLabel: "Epistemic foraging",
  },
} as const;

/** Flatten all visitor-facing strings for term search / tests. */
export function getVisionTomographyInductionFullText(
  copy: typeof VISION_TOMOGRAPHY_INDUCTION_COPY = VISION_TOMOGRAPHY_INDUCTION_COPY,
): string {
  return [
    copy.eyebrow,
    copy.title,
    copy.lead,
    copy.policy.eyebrow,
    copy.policy.title,
    copy.policy.body,
    copy.tomography.eyebrow,
    copy.tomography.title,
    copy.tomography.body,
    copy.induction.eyebrow,
    copy.induction.title,
    copy.induction.body,
    copy.distinction,
    copy.links.scienceLabel,
    copy.links.paperLabel,
    copy.links.foragingLabel,
  ].join("\n");
}
