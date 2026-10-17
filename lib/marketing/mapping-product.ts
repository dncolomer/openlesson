import { MAPPING_THESIS_LINKS, SCIENCE_FEP_PATH } from "@/lib/science/hub";

export const MAPPING_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE MAPPING",
  title: "Map Human Knowledge.",
  lead: "A Knowledge Mapping product for science use cases: knowledge regions as a living map of a domain — proximity, coverage, and the path through what is held — rather than as a verification exam.",
  scienceCta: "Read the science",
  scienceHref: SCIENCE_FEP_PATH,
  thesisLinks: MAPPING_THESIS_LINKS,
} as const;

export const MAPPING_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "See knowledge as position on a map of regions.",
  p1: "Every workspace puts people into a shared embedding geometry. Create knowledge regions, multi-select users, and read position live: the map shows where people sit against your defined knowledge regions.",
  p2: "Create custom knowledge regions from internal expert data and chart a domain without sharing confidential information about your internal systems. Regions stay private to the workspace.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "We help you build a living map of proximity to any kind of knowledge. Knowledge regions are the territories. People are positions on that map.",
  imageSrc: "/knowledgeg2.png",
  imageAlt:
    "Uncertain Systems Knowledge embeddings: multi-user projection with knowledge regions as a map of the domain",
} as const;
