/**
 * Science-page copy: overlapping research approaches to cognitive enhancement.
 * Dresler et al. 2019 supply the biochemical / physical / behavioral taxonomy.
 * Our third heading is a narrower product-relevant adaptation of part of physical.
 */

export const SCIENCE_ENHANCEMENT_COPY = {
  eyebrow: "APPROACHES",
  title: "Approaches to cognitive enhancement",
  lead: "If the aim is difficult knowledge at lower cognitive demand, cognitive enhancement research is part of the landscape. It is a research literature. Association with that literature does not validate Uncertain Systems.",
  taxonomyBefore:
    "In ",
  dreslerLinkLabel: "Hacking the Brain: Dimensions of Cognitive Enhancement",
  dreslerHref: "https://doi.org/10.1021/acschemneuro.8b00571",
  taxonomyAfter:
    " (Dresler, Sandberg, Bublitz, Ohla, Trenado, Mroczko-Wąsowicz, Kühn, and Repantis, ACS Chemical Neuroscience, 2019), Martin Dresler and colleagues group strategies by main mode of action into biochemical, physical, and behavioral. They also stress other dimensions: the cognitive domain targeted, personal factors, time scale, side effects, availability, and social acceptance. Benefits can be domain-specific, vary by person, and involve trade-offs. A plausible mechanism is not an established useful effect. No route is uniformly effective or appropriate.",
  adaptation:
    "Our headings follow that paper for the first two labels. \"Neural interfaces and neuromodulation\" is our narrower, product-relevant adaptation of part of their physical category, with overlaps. Physical approaches in the paper are broader than brain-computer interfaces or stimulation alone. These three headings are ours. They are overlapping research approaches. They are not a ladder, an intelligence scale, a cost ranking, or an inevitable product sequence.",
  behavioral: {
    id: "behavioral-cognitive-enhancement",
    title: "Behavioral cognitive enhancement",
    body: "Behavioral strategies change what people do: tasks, habits, training, and the structure of interaction. Dresler and colleagues discuss examples including mnemonic strategies and meditation. They also note that computerized training has faced serious questions about broad transfer: gains often stay close to the trained task.",
    product:
      "Uncertain Systems' solve flows and structured problem exploration sit in this research area as software. That is a starting point, not validation by association, and not evidence of general cognitive enhancement.",
    thinkAloud:
      "Think-aloud can make aspects of reasoning observable. Observing cognition is distinct from enhancing it. Effects, and measurement reactivity, depend on the task and the protocol. We do not treat think-aloud as a proven general-purpose attention booster.",
  },
  biochemical: {
    id: "biochemical-cognitive-enhancement",
    title: "Biochemical cognitive enhancement",
    body: "Biochemical strategies influence cognition through biochemical mechanisms. The research category includes pharmacological agents and other biological approaches, discussed in the literature at a high level. Psychological priming is a narrower construct than chemical or biological intervention, and we do not use priming as an umbrella for this category. Biological mechanisms do not all belong in one clean box.",
    status:
      "This is a possible research direction. It is not an Uncertain Systems service, recommendation, or announced development program. Any future exploration would need appropriate expertise, consent, ethical oversight, and applicable regulation.",
  },
  neural: {
    id: "neural-interfaces",
    title: "Neural interfaces and neuromodulation",
    cinelLinkLabel:
      "Cinel, Valeriani, and Poli (2019)",
    cinelHref: "https://doi.org/10.3389/fnhum.2019.00013",
    body: " survey neurotechnologies that observe brain activity and neurotechnologies that influence it. Recording can support interaction or adaptation. Stimulation and other neuromodulation can change neural activity. Systems may combine both. Recording is distinct from stimulation. Neither implies that understanding can be uploaded.",
    invasiveness:
      "Approaches may be invasive or non-invasive. Non-invasive is a placement description. It is not a safety conclusion. Neuromodulation can also involve biochemical mechanisms, so these headings overlap.",
    caveat:
      "Cinel and colleagues is a 2019 review with forecasts, not a current product-readiness assessment. Uncertain Systems does not read neural activity in today's software.",
  },
} as const;

export function getScienceEnhancementFullText(
  copy: typeof SCIENCE_ENHANCEMENT_COPY = SCIENCE_ENHANCEMENT_COPY,
): string {
  return [
    copy.eyebrow,
    copy.title,
    copy.lead,
    copy.taxonomyBefore,
    copy.dreslerLinkLabel,
    copy.taxonomyAfter,
    copy.adaptation,
    copy.behavioral.title,
    copy.behavioral.body,
    copy.behavioral.product,
    copy.behavioral.thinkAloud,
    copy.biochemical.title,
    copy.biochemical.body,
    copy.biochemical.status,
    copy.neural.title,
    copy.neural.cinelLinkLabel,
    copy.neural.body,
    copy.neural.invasiveness,
    copy.neural.caveat,
  ].join("\n");
}
