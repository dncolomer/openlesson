import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import {
  AYCL_PATH,
  DISCOVERY_CTA_LABEL,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  WORKSPACE_NEW_PATH,
  discoveryMailto,
} from "@/lib/marketing/paths";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { HARNESS_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const HARNESS_PRODUCT_COPY = {
  eyebrow: "PROBLEM SOLVING HARNESS",
  title: "Build understanding through hard problems.",
  productName: "Problem Solving Harness",
  lead: "The Problem Solving Harness structures work on difficult problems around the understanding you need to develop, rather than stopping at an answer.",
  body: "This is the working software for Build Understanding. You stay with a demanding problem or concept, make reasoning observable through the inputs the session supports, and continue into the gaps that work reveals.",
  workflowEyebrow: "IN A SESSION",
  workflowTitle: "What working with the harness involves.",
  workflow: [
    {
      title: "Work a demanding problem",
      body: "Start from a concept or problem worth understanding, not from a request for a summary. In a Learn session you speak, write, and draw on the work canvas. That canvas work is the record.",
    },
    {
      title: "Make reasoning observable",
      body: "Supported inputs are speech, writing, and drawing on the canvas, plus a written takeaway when you commit an insight. The harness uses that observable work. It does not ingest a document library or author a course for you.",
    },
    {
      title: "Investigate the gaps",
      body: "The session can point you toward relevant further exploration based on the unsys model of the concept. You still do the investigation. Completing a session records work. It does not guarantee retention or mastery.",
    },
  ],
  exampleEyebrow: "ILLUSTRATIVE",
  exampleTitle: "Why a method works",
  example:
    "A researcher needs to understand why a technical method works, not merely collect an AI summary of it. They work a representative case on the canvas, spell out the assumptions they are using, and follow up on the step they cannot yet justify. The tangible result is a work trace and a clearer split between what they can stand behind and what still needs investigation.",
  related:
    "Knowledge Mapping holds the domain region this work can refer to. Knowledge Verification is another way to examine the understanding the same kind of work reveals.",
  relatedLinks: [
    { href: KNOWLEDGE_MAPPING_PATH, label: "Knowledge Mapping" },
    { href: KNOWLEDGE_VERIFICATION_PATH, label: "Knowledge Verification" },
  ],
  foraging:
    "Epistemic foraging is the policy influence: search for information that reduces uncertainty, rather than optimizing for tests and practice repetition.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
  thesisLinks: HARNESS_THESIS_LINKS,
  directoryEyebrow: "THESIS",
  directoryTitle: "The science.",
  points: [
    {
      eyebrow: "POLICY",
      title: "Epistemic foraging",
      body: "An active search for information that shrinks what you do not know, instead of optimizing for tests and practice repetition. The harness uses that policy to suggest further investigation from the work in front of you.",
      href: SCIENCE_EPISTEMIC_FORAGING_PATH,
      linkLabel: "Read the policy",
      image: "/lp-boxes/epistemic-foraging-blueprint.jpg",
      imageAlt: "Blueprint of a gold search path foraging through a scatter of unknown diamond marks",
    },
    {
      eyebrow: "UNSYS MODEL",
      title: LEARNING_MODEL_PUBLIC_LABEL,
      body: "A generative model of the concept you are trying to learn or verify: hidden states, observations, priced edges, and policies. Calibrate, Learn, and Verify freeze that model and act on it.",
      href: SCIENCE_LEARNING_MODEL_PATH,
      linkLabel: "Open the model",
      image: "/lp-boxes/unsys-hidden-state-tree.jpg",
      imageAlt: "Blueprint of a hidden-state tree: diamond nodes on priced edges",
    },
    {
      eyebrow: "FREE ENERGY PRINCIPLE",
      title: "Uncertainty minimization",
      body: "Learning is reducing uncertainty. The Free Energy Principle is an influence on that view: treat work as shrinking what is still unknown. It is not a computed metabolic saving, and it does not prove that a session found the best next step.",
      href: SCIENCE_FEP_PATH,
      linkLabel: "Read the science",
      image: "/lp-boxes/uncertainty-minimization-blueprint.jpg",
      imageAlt: "Blueprint of nested diamonds shrinking toward a focus, uncertainty collapsing",
    },
  ],
  ayclEyebrow: "ALL-YOU-CAN-LEARN",
  ayclTitle: "Lifetime workspace buys",
  ayclBody:
    "All-You-Can-Learn is part of the Problem Solving Harness. Browse ready-made workspaces and buy lifetime access as a one-time purchase.",
  ayclCta: "Browse All-You-Can-Learn",
  ayclHref: AYCL_PATH,
  pricingCta: "See pricing",
  pricingHref: HARNESS_PRICING_PATH,
  workspaceCta: "Create your Workspace",
  workspaceHref: WORKSPACE_NEW_PATH,
  discoveryCta: DISCOVERY_CTA_LABEL,
  discoveryHref: discoveryMailto("Build Understanding use case"),
  modelImageSrc: "/unsysmodel.png",
  modelImageAlt:
    "Hidden-state diagram of Integrals: meaning, setup, and technique branches, with the cheapest edge marked as the policy",
  screenshots: [
    {
      src: "/harness.png",
      alt: "Problem Solving Harness workspace map with knowledge blocks, simulation, and expansion tools",
      caption: "Workspace · Map · Blocks",
      body: "Build and navigate a living knowledge map. Expand, connect, and steer practice from the blocks you actually hold.",
      width: 2906,
      height: 1656,
    },
    {
      src: "/harness-2.png",
      alt: "Problem Solving Harness practice session with chapter map, tools, and a guided project workspace",
      caption: "Practice · Chapters · Tools",
      body: "Work a chapter with the map, notebook, and thought tools in one session, then mark the landscape as you go.",
      width: 2912,
      height: 1654,
    },
  ],
} as const;
