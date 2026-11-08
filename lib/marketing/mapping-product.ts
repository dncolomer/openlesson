import { MAPPING_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";
import { MAPPING_PRICING_PATH } from "@/lib/marketing/paths";

export const MAPPING_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE MAPPING",
  title: "Map Human Knowledge.",
  lead: "A Knowledge Mapping product for science use cases: knowledge regions as a living map of a domain, proximity, coverage, and the path through what is held, rather than as a verification exam. Use it to make sense of complex AI-generated work. The map helps choose what to explore next; the thinking stays yours.",
  scienceCta: "Read the science",
  scienceHref: SCIENCE_FEP_PATH,
  pricingCta: "See mapping pricing",
  pricingHref: MAPPING_PRICING_PATH,
  thesisLinks: MAPPING_THESIS_LINKS,
  directoryEyebrow: "THESIS",
  directoryTitle: "The science.",
} as const;

export const MAPPING_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "See knowledge as position on a map of regions.",
  p1: "Every workspace puts people into a shared embedding geometry. Create knowledge regions, multi-select users, and read position live: the map shows where people sit against your defined knowledge regions. That position is how the autopilot chooses what to explore next.",
  p2: "Create custom knowledge regions from internal expert data and chart a domain without sharing confidential information about your internal systems. Regions stay private to the workspace.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "We help you build a living map of proximity to any kind of knowledge. Knowledge regions are the territories. People are positions on that map.",
  imageSrc: "/map.jpg",
  imageAlt:
    "Illustrative 2D projection of knowledge regions for Physics, Maths, Code, and Design, with an agent position and distances between them",
} as const;
