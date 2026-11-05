import { LEARNING_MODEL_PUBLIC_LABEL } from "@/lib/learning-model";
import { AYCL_PATH, HARNESS_PRICING_PATH } from "@/lib/marketing/paths";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";
import { HARNESS_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";
import { SCIENCE_LEARNING_MODEL_PATH } from "@/lib/science/learning-model-copy";

export const HARNESS_PRODUCT_COPY = {
  eyebrow: "PROBLEM SOLVING HARNESS",
  title: "Problem Solving Harness",
  lead: "A harness designed to help you learn in the age of AI. It steers your learning process so you can use tools like AI to outsource certain parts of the work without accidentally outsourcing the learning itself.",
  body: "Guardrails sit in the flow. You stay in the driver's seat when you pull data from different sources. The harness does not build content or a course for you — it steers you into the right learning actions and the internal model updates that make knowledge actually held.",
  foraging:
    "That policy is epistemic foraging: learning as reducing uncertainty, rather than optimizing for tests and practice repetition.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
  thesisLinks: HARNESS_THESIS_LINKS,
  points: [
    {
      eyebrow: "POLICY",
      title: "Epistemic foraging",
      body: "An active search for information that shrinks what you do not know, instead of optimizing for tests and practice repetition. The harness forages for the next genuine gap.",
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
      body: "Learning is reducing uncertainty. The Free Energy Principle is the influence: persist by minimizing surprise, and treat work as shrinking what is still unknown rather than chasing a test score.",
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
  pricingCta: "See Problem Solving Harness pricing",
  pricingHref: HARNESS_PRICING_PATH,
  workspaceCta: "Create your Workspace",
  workspaceHref: "/workspace/new",
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
      body: "Work a chapter with the map, notebook, and thought tools in one session — then mark the landscape as you go.",
      width: 2912,
      height: 1654,
    },
  ],
} as const;
