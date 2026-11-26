/**
 * Retired public product. Canonical copy is Embeddable Knowledge Verification Protocols.
 */
import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PRODUCT_COPY,
} from "@/lib/marketing/verification-product";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { HARNESS_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const HARNESS_PRODUCT_COPY = {
  ...VERIFICATION_PRODUCT_COPY,
  productName: "Embeddable Knowledge Verification Protocols",
  related: VERIFICATION_APPROACH_COPY.related,
  relatedLinks: VERIFICATION_APPROACH_COPY.relatedLinks,
  foraging: VERIFICATION_APPROACH_COPY.foraging,
  foragingHref: VERIFICATION_APPROACH_COPY.foragingHref,
  foragingLabel: VERIFICATION_APPROACH_COPY.foragingLabel,
  thesisLinks: HARNESS_THESIS_LINKS,
  directoryEyebrow: VERIFICATION_APPROACH_COPY.directoryEyebrow,
  directoryTitle: VERIFICATION_APPROACH_COPY.directoryTitle,
  points: [
    {
      eyebrow: "POLICY",
      title: "Epistemic foraging",
      body: "An active search for information that shrinks what you do not know, instead of optimizing for tests and practice repetition.",
      href: SCIENCE_EPISTEMIC_FORAGING_PATH,
      linkLabel: "Read the policy",
      image: "/lp-boxes/epistemic-foraging-blueprint.jpg",
      imageAlt: "Blueprint of a gold search path foraging through a scatter of unknown diamond marks",
    },
    {
      eyebrow: "UNCERTAINTY MODEL",
      title: LEARNING_MODEL_PUBLIC_LABEL,
      body: "A generative model of the concept you are trying to verify: hidden states, observations, priced edges, and policies.",
      href: SCIENCE_LEARNING_MODEL_PATH,
      linkLabel: "Open the model",
      image: "/lp-boxes/unsys-hidden-state-tree.jpg",
      imageAlt: "Blueprint of a hidden-state tree: diamond nodes on priced edges",
    },
    {
      eyebrow: "FREE ENERGY PRINCIPLE",
      title: "Uncertainty minimization",
      body: "Learning is reducing uncertainty. The Free Energy Principle is an influence on that view: treat work as shrinking what is still unknown.",
      href: SCIENCE_FEP_PATH,
      linkLabel: "Read the science",
      image: "/lp-boxes/uncertainty-minimization-blueprint.jpg",
      imageAlt: "Blueprint of nested diamonds shrinking toward a focus, uncertainty collapsing",
    },
  ],
  workspaceCta: "Open dashboard",
  workspaceHref: "/workspace/new",
  modelImageSrc: "/unsysmodel.png",
  modelImageAlt:
    "Hidden-state diagram of Integrals: meaning, setup, and technique branches, with the cheapest edge marked as the policy",
  screenshots: [
    {
      src: "/harness.png",
      alt: "Workspace map with knowledge blocks, simulation, and expansion tools",
      caption: "Workspace · Map · Blocks",
      body: "Build and navigate a living knowledge map. Expand, connect, and steer practice from the blocks you actually hold.",
      width: 2906,
      height: 1656,
    },
    {
      src: "/harness-2.png",
      alt: "Practice session with chapter map, tools, and a guided project workspace",
      caption: "Practice · Chapters · Tools",
      body: "Work a chapter with the map, notebook, and thought tools in one session, then mark the landscape as you go.",
      width: 2912,
      height: 1654,
    },
  ],
} as const;
