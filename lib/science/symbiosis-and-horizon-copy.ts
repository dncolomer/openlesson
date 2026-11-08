/**
 * Science-page copy: human-AI symbiosis framing, current software, and research horizon.
 */

export const SCIENCE_SYMBIOSIS_COPY = {
  eyebrow: "FRAME",
  title: "Human-AI symbiosis",
  lead: "The unifying frame is human-AI symbiosis: people and computational systems adapting in response to each other during knowledge building.",
  lickliderLinkLabel: "J. C. R. Licklider (1960)",
  lickliderHref: "https://groups.csail.mit.edu/medg/people/psz/Licklider.html",
  lickliderAfter:
    ", in Man-Computer Symbiosis, described a hoped-for coupling in which people set goals, formulate hypotheses, determine criteria, and perform evaluations, while computing machines do the preparative work that makes insight and decision possible. He was writing about formulative thinking: bringing the machine into the posing of the question, as well as into the solution of already-posed problems. That paper is a historical influence on how we talk about partnership. It is not evidence that Uncertain Systems has achieved measured co-adaptation.",
  loopLead:
    "A design and research framing for a closed loop is: observe work, estimate a provisional knowledge state, adapt the interaction, and check subsequent understanding.",
  loopSoftware:
    "Parts of that loop exist in software as projections of taps, speech, and canvas work onto a frozen generative model, with Learn showing preferred next edges and Verify recording distance from a cheapest policy. That is an engineering mechanism on author-seeded structure. It is not a readout of neural activity, and it is not evidence of measured human-AI co-adaptation. The loop as a whole remains a research framing wherever those stronger claims are unconfirmed.",
  cognition:
    "Cognition remains in the person. The ambition is less conscious steering and lower cognitive demand while that cognition is happening. Understanding is still the person's work. The ambition is also larger than keeping every step under fully manual control.",
} as const;

export const SCIENCE_HORIZON_COPY = {
  eyebrow: "NOW AND NEXT",
  title: "Software now, and the research horizon",
  currentEyebrow: "Current software",
  current:
    "Authors define a knowledge region as a shared target of problems and concepts. A solve flow guides someone through a problem and stores work traces. Calibrate, Learn, and Verify use a generative model of hidden states, state factors, observations, priced edges, and policies. Think-aloud probes and Proof of Work traces make parts of exploration reviewable. Workspace agents can help prepare maps and flows for authors to review. The model is not a readout of a mind. Distance from a cheapest policy is not a certificate of understanding.",
  horizonEyebrow: "Research horizon",
  horizon:
    "The larger aim is an autopilot for knowledge building: adaptation around the person so that acquiring difficult knowledge costs less attention and less conscious management of the path, and so that people can inspect, question, and use work that machines can already produce. Biochemical and neural routes, if ever explored, would be research under the constraints below, not a present offering.",
  progressEyebrow: "What would count as progress",
  progress:
    "We would ask evaluation questions, rather than announce results we do not have. Against appropriate baselines: does understanding retain. Does it transfer to unfamiliar problems. Does reasoning quality improve on inspection of the work. Does subjective workload fall. Time saved or a higher score, taken alone, does not establish knowledge acquisition. Effort, in these questions, means cognitive demand and reported workload. It is not metabolic energy.",
  validation:
    "Existing website copy is a description of intent and of current software. It is not independent validation.",
  ethicsEyebrow: "If neural or biochemical research were ever pursued",
  ethics:
    "It would require consent, protection of sensitive data, ethical oversight, and applicable regulation. Workplace use would have to confront the danger of coercion: a person should not have to submit neural or biochemical measurement as a condition of hiring or advancement.",
} as const;

export const SCIENCE_REFERENCES_COPY = {
  eyebrow: "SOURCES",
  title: "References",
  lead: "Published research, theoretical influences, and historical papers that this page draws on. They are context. They are not evidence that Uncertain Systems works.",
} as const;

export function getScienceSymbiosisFullText(
  copy: typeof SCIENCE_SYMBIOSIS_COPY = SCIENCE_SYMBIOSIS_COPY,
): string {
  return [
    copy.eyebrow,
    copy.title,
    copy.lead,
    copy.lickliderLinkLabel,
    copy.lickliderAfter,
    copy.loopLead,
    copy.loopSoftware,
    copy.cognition,
  ].join("\n");
}

export function getScienceHorizonFullText(
  copy: typeof SCIENCE_HORIZON_COPY = SCIENCE_HORIZON_COPY,
): string {
  return [
    copy.eyebrow,
    copy.title,
    copy.currentEyebrow,
    copy.current,
    copy.horizonEyebrow,
    copy.horizon,
    copy.progressEyebrow,
    copy.progress,
    copy.validation,
    copy.ethicsEyebrow,
    copy.ethics,
  ].join("\n");
}
