import { AYCL_PATH, HARNESS_PRICING_PATH } from "@/lib/marketing/paths";
import { SCIENCE_EPISTEMIC_FORAGING_PATH } from "@/lib/science/epistemic-foraging-copy";

export const HARNESS_PRODUCT_COPY = {
  eyebrow: "LEARNING HARNESS",
  title: "A Learning Harness for humans",
  lead: "A harness designed to help you learn in the age of AI. It steers your learning process so you can use tools like AI to outsource certain parts of the work without accidentally outsourcing the learning itself.",
  body: "Guardrails sit in the flow. You stay in the driver's seat when you pull data from different sources. The harness does not build content or a course for you — it steers you into the right learning actions and the internal model updates that make knowledge actually held.",
  foraging:
    "That policy is epistemic foraging: learning as reducing uncertainty, rather than optimizing for tests and practice repetition.",
  foragingHref: SCIENCE_EPISTEMIC_FORAGING_PATH,
  foragingLabel: "epistemic foraging",
  points: [
    {
      eyebrow: "POLICY",
      title: "Epistemic Foraging Policy",
      body: "Learning as reducing uncertainty: an active search for information that shrinks what you don't know, instead of optimizing for tests and practice repetition.",
      href: null,
      linkLabel: null,
      image: "/harness-blocks/policy-cliff-villa.jpg",
      imageAlt: "Greco-futurist cliffside villa over water at dusk",
    },
    {
      eyebrow: "THE TRAP",
      title: "Easy to fool yourself",
      body: "Everyone wants to learn, but it's easy to fool yourself into feeling like you are. This harness fixes that.",
      href: null,
      linkLabel: null,
      image: "/harness-blocks/trap-domed-city.jpg",
      imageAlt: "Greco-futurist city of marble and turquoise domes",
    },
    {
      eyebrow: "OPEN SOURCE",
      title: "Open source by design",
      body: "Set it up locally and bring your own key. Stay in control of how you learn. Don't leave yourself at the mercy of model providers.",
      href: "https://github.com/dncolomer/openlesson",
      linkLabel: "GitHub",
      image: "/harness-blocks/opensource-water-palace.jpg",
      imageAlt: "Greco-futurist palace terraces on water with statues and palms",
    },
  ],
  ayclEyebrow: "ALL-YOU-CAN-LEARN",
  ayclTitle: "Lifetime workspace buys",
  ayclBody:
    "All-You-Can-Learn is part of the Learning Harness. Browse ready-made workspaces and buy lifetime access as a one-time purchase.",
  ayclCta: "Browse All-You-Can-Learn",
  ayclHref: AYCL_PATH,
  pricingCta: "See Learning Harness pricing",
  pricingHref: HARNESS_PRICING_PATH,
  workspaceCta: "Create your Workspace",
  workspaceHref: "/workspace/new",
  screenshots: [
    {
      src: "/harness.png",
      alt: "Learning Harness workspace map with knowledge blocks, simulation, and expansion tools",
      caption: "Workspace · Map · Blocks",
      body: "Build and navigate a living knowledge map. Expand, connect, and steer practice from the blocks you actually hold.",
      width: 2906,
      height: 1656,
    },
    {
      src: "/harness-2.png",
      alt: "Learning Harness practice session with chapter map, tools, and a guided project workspace",
      caption: "Practice · Chapters · Tools",
      body: "Work a chapter with the map, notebook, and thought tools in one session — then mark the landscape as you go.",
      width: 2912,
      height: 1654,
    },
  ],
} as const;
