import {
  AYCL_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  USE_CASES_PATH,
} from "@/lib/marketing/paths";
import type { ThesisDeepLink } from "@/lib/science/hub";

export { USE_CASES_PATH };

export const USE_CASES_COPY = {
  eyebrow: "USE CASES",
  title: "Where the three uses land.",
  lead:
    "Acquisition, verification, and mapping are the tools for knowledge building on autopilot. We guide people through hard problems to build knowledge, verify understanding and make sense of complex AI-generated work. The exploration is guided, but the thinking stays yours.",
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "Seven jobs.",
  directoryLead: "Jump to a use case, then open the product it sits on.",
} as const;

export const USE_CASES = [
  {
    id: "frontier-learning",
    product: "Acquisition",
    productHref: LEARNING_HARNESS_PATH,
    title: "Frontier learning",
    body:
      "Acquire a field as it is being made. Photonic computing, new materials, BCI, thermodynamic computing: the Problem Solving Harness guides what to explore next on the live edge. The thinking stays yours.",
    hrefLabel: "Problem Solving Harness",
  },
  {
    id: "research-labs",
    product: "Acquisition",
    productHref: LEARNING_HARNESS_PATH,
    title: "Research labs",
    body:
      "Bring a lab onto a new stack with a Learning Map of Solve, then Verify. The work is the curriculum. The autopilot chooses the next hard problem; proof of work stays with the people who did the thinking.",
    hrefLabel: "Open acquisition",
  },
  {
    id: "recruitment",
    product: "Verification",
    productHref: KNOWLEDGE_VERIFICATION_PATH,
    title: "Recruitment screening",
    body:
      "Score candidates from genuine work traces, not take-home theater. A short Verify session shows whether a person actually holds the skill. The probe is guided; the thinking stays theirs. The same bar applies across a whole hiring cohort.",
    hrefLabel: "Knowledge Verification",
  },
  {
    id: "agent-harnesses",
    product: "Verification",
    productHref: KNOWLEDGE_VERIFICATION_PATH,
    title: "Agent harness checks",
    body:
      "Benchmark what an agentic setup knows, and make sense of complex AI-generated work in the same geometry as a person. Flows put humans and agents side by side, so a lab can compare harnesses without a cheatable exam.",
    hrefLabel: "Verify agents",
  },
  {
    id: "institute-programs",
    product: "Acquisition · Verification",
    productHref: "https://thewiser.org",
    title: "Institute programs",
    body:
      "WISER is the blend: specialized course authoring, lifetime Unsys workspaces, capstone work, and a path that also screens who can carry the field. Acquisition, verification, and a recruitment-shaped gate in one program.",
    hrefLabel: "WISER",
  },
  {
    id: "mapping-studies",
    product: "Mapping",
    productHref: KNOWLEDGE_MAPPING_PATH,
    title: "Knowledge mapping studies",
    body:
      "Sit neurological patterns next to knowledge regions. Mapping is the science product for proximity, distance, and how a position moves as work continues. That geometry is also how we make sense of complex AI-generated work.",
    hrefLabel: "Knowledge Mapping",
  },
  {
    id: "education",
    product: "Acquisition",
    productHref: AYCL_PATH,
    title: "Education that holds",
    body:
      "Students get a workspace for life, not a course that expires. All-You-Can-Learn keeps Solve and Verify on the topic they actually need to hold. The exploration is guided; the thinking stays theirs.",
    hrefLabel: "All-You-Can-Learn",
  },
] as const;

export const USE_CASES_DIRECTORY: readonly ThesisDeepLink[] = USE_CASES.map((item) => ({
  href: `#${item.id}`,
  label: item.title,
  hint: item.product,
}));
