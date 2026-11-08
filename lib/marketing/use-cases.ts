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
    "A researcher can hold an AI-generated argument no one on the team can yet question. A new colleague can read the documentation and still be unready to make a difficult call. A candidate can reach the right answer without showing how they got there.",
    "Understanding, verification, and mapping can work together in each of these situations. The system organizes work around a difficult problem and evidence of understanding.",
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
    "Bring a frontier artifact, an area of company expertise, or a hiring problem. We can discuss the target knowledge, the work that would make understanding visible, and a focused first use case.",
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
    id: "research-ai",
    eyebrow: "FRONTIER WORK",
    directoryLabel: "Frontier work",
    hint: "Understanding · Mapping · Verification",
    title: "Understand difficult work at the frontier",
    sections: [
      {
        title: "Make an unfamiliar argument inspectable",
        paragraphs: [
          "Automated checks only go so far. To really understand difficult work, especially AI-generated work, you have to work through it yourself and build your own insight. Uncertain Systems flows pair you with an AI-powered canvas and an interface that implements behavioral cognitive enhancements, so you get there faster and with less effort than in a chat window. Your work is also embedded in a knowledge embedding space, which helps you and others build insight more efficiently over time.",
        ],
      },
    ],
    example: "",
    afterExample:
      "Human interpretability here means acquiring enough understanding to question the work. It is distinct from mechanistic interpretability of a model, and distinct from automated proof certification.",
    links: [
      { href: LEARNING_HARNESS_PATH, label: "Build Understanding" },
      { href: KNOWLEDGE_MAPPING_PATH, label: "Knowledge Mapping" },
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Knowledge Verification" },
    ],
    close: {
      title: "Leave with a record of what was actually examined",
      paragraphs: [
        "A useful outcome is the region of dependencies the team has worked, plus traces and open questions. That record can support expert review. It is not a certificate of correctness.",
      ],
    },
  },
  {
    id: "company-expertise",
    eyebrow: "TEAM EXPERTISE",
    directoryLabel: "Team expertise",
    hint: "Mapping · Understanding · Verification",
    title: "Turn expert knowledge into team capability",
    sections: [
      {
        title: "Give colleagues a shared domain reference",
        paragraphs: [
          "A technical lead needs colleagues to reason through an unfamiliar subsystem, including design choices and failure cases. Documentation preserves information. It does not show whether someone can use it when the situation changes.",
          "Use expert material and representative problems to define a private knowledge region in the workspace, using the inputs authoring actually supports. Colleagues then work those problems in the Problem Solving Harness. Stored work helps locate further development needs. Knowledge Verification can examine understanding on a later problem under stated conditions.",
          "The durable asset is the company region and the associated work, not a course-consumption checklist. Ownership stays with the workspace that holds the region. Authors still decide what belongs in the region. The system does not automatically capture an expert or promise faster onboarding.",
        ],
      },
    ],
    example:
      "An engineer joins a team responsible for a data pipeline. Instead of only reading its runbook, they explore why an apparently healthy deployment is producing incomplete results. They trace dependencies, test explanations, and justify a recovery plan. An experienced colleague reviews the stored work and identifies which assumptions need another pass.",
    afterExample: "",
    links: [
      { href: KNOWLEDGE_MAPPING_PATH, label: "Knowledge Mapping" },
      { href: LEARNING_HARNESS_PATH, label: "Build Understanding" },
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Knowledge Verification" },
    ],
    close: {
      title: "Keep the region useful after the first cohort",
      paragraphs: [
        "The same region can support a new hire or later coaching. Calibrate, Learn, and Verify sessions gather further evidence. Revising the region is an authoring task as the architecture changes.",
      ],
    },
  },
  {
    id: "technical-hiring",
    eyebrow: "TECHNICAL HIRING",
    directoryLabel: "Technical hiring",
    hint: "Verification",
    title: "Assess capability through hard problems",
    sections: [
      {
        title: "Examine the approach, not only the answer",
        paragraphs: [
          "A technical hiring team wants to see how candidates approach a demanding problem, including work with an explicitly allowed AI tool. The useful evidence is how they explore, which assumptions they test, what they check, and how they develop their reasoning, alongside the result.",
          "Define a reference knowledge region and a problem your experts consider meaningful. Run a Verify session under clear assessment conditions. Review the stored work and the model-relative relationship to that reference. Knowledge Mapping holds the domain target. Build Understanding is available afterward when the evidence points to development.",
          "The result is work-derived evidence for a hiring or development conversation, not a total measure of the person. The product does not enforce a tool policy or claim predictive validity. Agent-harness comparison is a related extension, not a validated cross-species benchmark.",
        ],
      },
    ],
    example:
      "A team hiring a distributed-systems engineer uses a replication problem with a network partition. The candidate proposes a design, then explores what happens when two nodes accept conflicting writes. The reviewer examines whether they spot the inconsistency, revise their assumptions, and explain the trade-off they choose, including any allowed model suggestions they accepted or rejected.",
    afterExample:
      "The visible evidence is the candidate's work in that situation. Whether it transfers to the team's production environment remains a judgment to investigate through discussion and other hiring evidence.",
    links: [
      { href: KNOWLEDGE_VERIFICATION_PATH, label: "Knowledge Verification" },
      { href: KNOWLEDGE_MAPPING_PATH, label: "Knowledge Mapping" },
      { href: LEARNING_HARNESS_PATH, label: "Build Understanding" },
    ],
    close: {
      title: "Leave with a more specific hiring conversation",
      paragraphs: [
        "The useful artifact is a record of problem exploration against a defined target. Use it to support technical judgment, not to replace interviews or reduce a person to a single score.",
      ],
    },
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
      ...item.sections.flatMap((section) => [section.title, ...section.paragraphs]),
      item.example,
      item.afterExample,
      ...item.links.flatMap((link) => [link.href, link.label]),
      item.close.title,
      ...item.close.paragraphs,
    ]),
    USE_CASES_COPY.otherTitle,
    ...USE_CASES_OTHER.flatMap((item) => [item.title, item.body]),
    USE_CASES_COPY.closeTitle,
    USE_CASES_COPY.closeBody,
    USE_CASES_COPY.closeCta,
  ].join("\n");
}
