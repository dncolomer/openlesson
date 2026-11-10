import {
  DISCOVERY_CTA_LABEL,
  ENTERPRISE_SETUP_MAILTO,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  USE_CASES_PATH,
} from "@/lib/marketing/paths";
import type { ThesisDeepLink } from "@/lib/science/hub";

export { USE_CASES_PATH };

export const USE_CASES_COPY = {
  eyebrow: "USE CASES",
  title: "Put knowledge building to work",
  lead: [
    "A candidate can reach the right answer without showing how they got there. A lead can collect work traces and still not see where people sit relative to the goals that matter. A researcher can hold an AI-generated argument no one on the team can yet question.",
    "Verify Protocol, Map Protocol, and Solve Protocol can work together in each of these situations. The system organizes work around proof of work and evidence of understanding.",
  ],
  directoryEyebrow: "ON THIS PAGE",
  directoryTitle: "The cases.",
  directoryLead: "Jump to a use case, then discuss yours.",
  ideasEyebrow: "TWO IDEAS",
  ideasTitle: "What connects the cases.",
  ideasLead: "Two ideas connect the use cases below.",
  ideas: [
    {
      title: "Knowledge region",
      body: "A knowledge region describes the expertise you want to explore, grounded in problems and work from that domain. It gives a team a shared reference that can develop with its needs.",
    },
    {
      title: "Solve flow",
      body: "A solve flow structures work on a problem, creating traces that can inform further investigation, verification, and mapping.",
    },
  ],
  otherEyebrow: "OTHER DIRECTIONS",
  otherTitle: "Other directions to explore",
  closeEyebrow: "START",
  closeTitle: "Start with one problem your team needs to understand",
  closeBody:
    "Bring a frontier artifact, an assessment problem, or stored work you want to read against a region. We can discuss the target knowledge, the work that would make understanding visible, and a focused first use case.",
  closeCta: DISCOVERY_CTA_LABEL,
  closeHref: ENTERPRISE_SETUP_MAILTO,
} as const;

export const USE_CASES_OTHER = [
  {
    title: "Agent-harness evaluation",
    body: "Investigate how an agent setup approaches a defined problem space and compare work patterns. This is a related extension. It is not a validated benchmark that treats people and agents as equivalent.",
  },
  {
    title: "Institute and course-authoring programs",
    body: "Specialist course authoring is a distinct service: organize a demanding topic around problems and target understanding. Treat it separately from the self-serve harness. Completion of authored material is not mastery.",
  },
  {
    title: "Knowledge and neuroscience studies",
    body: "Research collaborations can ask how knowledge regions relate to studies of the brain. That work lives on the science page. It is not a shipped mapping or assessment feature.",
  },
] as const;

export const USE_CASES = [
  {
    id: "technical-hiring",
    eyebrow: "ASSESSMENT",
    directoryLabel: "Assessment",
    hint: "Verify",
    title: "Assess capability through proof of work",
    lead: "Examine how a candidate explores a demanding problem, including work with an allowed AI tool when the problem says so.",
    body: "You define a knowledge region and a problem your experts consider meaningful, then run a Verify session under stated conditions. Reviewers open the stored work. Where Distance is shown, it is a model-relative relationship to that region, not a score of the whole person. The product does not enforce a tool policy, replace interviews, or claim the result predicts job performance. Agent-harness comparison is a related extension, not a validated benchmark that treats people and agents as equivalent.",
    example:
      "A team doing technical hiring for a distributed-systems engineer writes a replication problem that includes a network partition, and states that an AI tool is allowed. The candidate proposes a design, then explores what happens when two nodes accept conflicting writes. They accept one model suggestion and reject another. The reviewer opens the stored session and looks at whether the candidate spotted the inconsistency, revised an assumption, and explained the trade-off.",
    imageSrc: "/unsysmodel.png",
    imageAlt:
      "Hidden-state diagram of Integrals: meaning, setup, and technique branches, with the cheapest edge marked as the policy",
    imageFit: "contain" as const,
    links: [
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verify" },
      { href: KNOWLEDGE_MAPPING_PATH, label: "Map" },
      { href: LEARNING_HARNESS_PATH, label: "Solve" },
    ],
  },
  {
    id: "team-insight",
    eyebrow: "TEAM INSIGHT",
    directoryLabel: "Team insight",
    hint: "Map · Solve · Verify",
    title: "Turn work into actionable insight",
    lead: "Skills and expertise don't fit on a leaderboard or a two-axis chart. See your team, or yourself, across many dimensions at once, set against the goals that matter to you.",
    body: "Calibrate, Learn, and Verify sessions store work, as do Solve runs. Data Studio currently plots Calibrate, Verify, and Solve runs against a knowledge region you define, so you can see position and distance. Learn traces can be opened; they are not yet plotted there. You still read the stored work to decide what to do next. A packaged leaderboard that ranks people is not what this is. An automatic report that compares every person on every goal at once is still being built.",
    example:
      "A technical lead defines a private knowledge region for a billing subsystem and a representative incident problem. Three colleagues each complete a Verify session on that problem. The lead opens Data Studio, looks at the three runs against the region, and opens the stored trace for the run farthest from it to see which assumptions still need work.",
    imageSrc: "/regions1.png",
    imageAlt:
      "Illustrative 2D projection of knowledge regions for Physics, Maths, Code, and Design, with positions and distances between them",
    imageFit: "contain" as const,
    links: [
      { href: KNOWLEDGE_MAPPING_PATH, label: "Map" },
      { href: LEARNING_HARNESS_PATH, label: "Solve" },
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verify" },
    ],
  },
  {
    id: "research-ai",
    eyebrow: "FRONTIER WORK",
    directoryLabel: "Frontier work",
    hint: "Solve · Map · Verify",
    title: "Understand difficult work",
    lead: "Investigate an unfamiliar argument, including AI-generated work, until the assumptions and open questions are explicit.",
    body: "You work the argument in a Solve or Learn session. Speech, writing, and drawing on the canvas are stored, and the unsys model can suggest a next place to look. Completing a session records what you examined. It does not certify that the argument is correct. The interface uses behavioral cognitive enhancements such as think-aloud work on the canvas so you can question the work yourself. Human interpretability here means acquiring enough understanding to question the work. It is distinct from mechanistic interpretability of a model, and distinct from automated proof certification.",
    example:
      "A researcher is given an AI-generated proof of a lemma the team has not checked. They start a Solve session, write the first claim on the canvas, and talk through why the second step follows. They cannot justify a substitution, so they mark that gap and stop. A colleague opens the stored session, reads those notes, and continues from the substitution instead of starting over.",
    imageSrc: "/lp-boxes/hero3.jpg",
    imageAlt:
      "Full session: left command sidebar and a Work canvas with a mathematical argument, notes, and a Thinking panel",
    imageFit: "cover" as const,
    links: [
      { href: LEARNING_HARNESS_PATH, label: "Solve" },
      { href: KNOWLEDGE_MAPPING_PATH, label: "Map" },
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verify" },
    ],
  },
] as const;

export const USE_CASES_DIRECTORY: readonly ThesisDeepLink[] = [
  { href: "#ideas", label: "Two ideas", hint: "Region and solve flow" },
  ...USE_CASES.map((item) => ({
    href: `#${item.id}`,
    label: item.directoryLabel,
    hint: item.hint,
  })),
  { href: "#other-directions", label: USE_CASES_COPY.otherTitle, hint: "More uses" },
  { href: "#start", label: "Start with one problem", hint: USE_CASES_COPY.closeCta },
];

export function useCasesCopyText(): string {
  return [
    USE_CASES_COPY.title,
    ...USE_CASES_COPY.lead,
    USE_CASES_COPY.ideasLead,
    ...USE_CASES_COPY.ideas.flatMap((item) => [item.title, item.body]),
    ...USE_CASES.flatMap((item) => [
      item.eyebrow,
      item.directoryLabel,
      item.title,
      item.lead,
      item.body,
      item.example,
      item.imageSrc,
      ...item.links.flatMap((link) => [link.href, link.label]),
    ]),
    USE_CASES_COPY.otherTitle,
    ...USE_CASES_OTHER.flatMap((item) => [item.title, item.body]),
    USE_CASES_COPY.closeTitle,
    USE_CASES_COPY.closeBody,
    USE_CASES_COPY.closeCta,
  ].join("\n");
}
