/**
 * Vision-page copy: knowledge tomography + knowledge induction framing.
 * Structured so tests assert terms against shipped strings (not re-implemented prose).
 */

import { KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH } from "@/lib/science/knowledge-tomography-whitepaper";

export const VISION_TOMOGRAPHY_INDUCTION_PATHS = {
  science: "/science",
  knowledgeTomographyPaper: KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
} as const;

/** Terms that must appear in the shipped vision copy. */
export const VISION_TOMOGRAPHY_INDUCTION_TERMS = [
  "knowledge tomography",
  "reproduce",
  "state of knowledge",
  "human",
  "agentic",
  "knowledge induction",
] as const;

export const VISION_TOMOGRAPHY_INDUCTION_COPY = {
  eyebrow: "SCIENCE PATH",
  title: "Knowledge tomography, then knowledge induction.",
  lead:
    "Self-driving learning needs two complementary layers. First we measure what an entity currently holds; then we steer transformation toward useful configurations with less wasted effort.",
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
    "We keep the two distinct on purpose. Tomography externalizes and reconstructs current state. Knowledge induction tech uses that measurement to steer learning. Without tomography, induction is blind steering; without induction, measurement never compounds into self-driving learning.",
  links: {
    scienceLabel: "Science thesis",
    paperLabel: "Knowledge tomography white paper",
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
    copy.tomography.eyebrow,
    copy.tomography.title,
    copy.tomography.body,
    copy.induction.eyebrow,
    copy.induction.title,
    copy.induction.body,
    copy.distinction,
    copy.links.scienceLabel,
    copy.links.paperLabel,
  ].join("\n");
}
