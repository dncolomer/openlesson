import { MAPPING_THESIS_LINKS, SCIENCE_FEP_PATH, SCIENCE_HUB_PATH } from "@/lib/science/hub";
import {
  DISCOVERY_CTA_LABEL,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  MAPPING_PRICING_PATH,
  USE_CASES_PATH,
  discoveryMailto,
} from "@/lib/marketing/paths";

export const MAPPING_PRODUCT_COPY = {
  eyebrow: "KNOWLEDGE MAPPING",
  title: "Make expertise a shared reference.",
  lead: "Build knowledge regions around your domain and relate work from your team to them.",
  body: "Knowledge Mapping is the domain asset in the same problem-solving system as Understanding and verification. Defining a region is different from authoring a whole domain map, and different from running a solve flow. The region is the reference; session work is what informs a position on it.",
  scienceCta: "Read the science",
  scienceHref: SCIENCE_FEP_PATH,
  pricingCta: "See mapping pricing",
  pricingHref: MAPPING_PRICING_PATH,
  discoveryCta: DISCOVERY_CTA_LABEL,
  discoveryHref: discoveryMailto("Knowledge mapping use case"),
  thesisLinks: MAPPING_THESIS_LINKS,
  directoryEyebrow: "THESIS",
  directoryTitle: "The science.",
} as const;

export const MAPPING_PLATFORM_COPY = {
  eyebrow: "PLATFORM",
  title: "A region, a position, and a reason to investigate further.",
  p1: "A knowledge region gathers the problems and reasoning that represent a slice of expertise, for example an expert team's reference cases around a technical method. Authors define that region in a workspace. It stays in the workspace that owns it. That is an access boundary, not an encryption or regulatory claim.",
  p2: "Work in supported sessions informs a position relative to that region. Distance is how close the position sits in the current model. Observed change is how that position moves as further work is recorded. The live illustration on this page is a projection of regions and positions, not a scan of knowledge, complete coverage of a domain, or a validated cognitive instrument.",
  p3: "Use the region as a shared reference while colleagues develop understanding, and when you examine that understanding through verification. Mapping remains an exploratory domain view. It is not another verification exam.",
  researchBefore:
    "Questions about relating knowledge regions to studies of the brain are a research direction on the",
  researchAfter: "They are not current mapping functionality.",
  researchHref: SCIENCE_HUB_PATH,
  researchLabel: "science page",
  interpretability:
    "Human understanding of difficult AI-generated work is an application of this knowledge framework: people still have to acquire enough of the argument to question it. Mapping does not expose model internals or certify mathematical correctness.",
  visualCaption: "Knowledge · Embeddings · Knowledge regions · Proof of Work",
  visualBody:
    "Illustrative projection: knowledge regions are territories in an embedding. People are positions relative to those territories.",
  imageSrc: "/map.jpg",
  imageAlt:
    "Illustrative 2D projection of knowledge regions for Physics, Maths, Code, and Design, with a position and distances between them",
  relatedLinks: [
    { href: `${USE_CASES_PATH}#company-expertise`, label: "Team expertise" },
    { href: `${USE_CASES_PATH}#research-ai`, label: "Frontier work" },
    { href: LEARNING_HARNESS_PATH, label: "Solve" },
    { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verify" },
  ],
} as const;
