/**
 * Academic white paper: TAP Stash/Submit as a method for externalizing
 * System 1 / System 2 thinking and gathering Proof of Work data.
 * Content is structured so tests can assert method terms and experiment outline.
 */

export const TAP_WHITEPAPER_PATH = "/science/think-aloud-protocol" as const;

export const TAP_WHITEPAPER_META = {
  title:
    "Think Aloud Protocol with Selective Stash/Submit: Externalizing System 1 and System 2 as Proof of Work",
  shortTitle: "TAP Stash/Submit White Paper",
  authors: "Uncertain Systems Research",
  version: "1.0",
  status: "Working paper · Methods and planned experiment",
  date: "2026",
  description:
    "A methods white paper on the Think Aloud Protocol Stash/Submit interface for externalizing dual-process thought traces as Proof of Work data, and a planned experiment on embeddings and Map of Knowledge regions.",
} as const;

/** Terms that must appear in the shipped paper (tests and science link). */
export const TAP_WHITEPAPER_METHOD_TERMS = [
  "Think Aloud Protocol",
  "Stash",
  "Submit",
  "System 1",
  "System 2",
  "Proof of Work",
  "embedding",
  "Map of Knowledge",
] as const;

/** Experiment-step anchors (substance, not sales). */
export const TAP_WHITEPAPER_EXPERIMENT_STEPS = [
  {
    id: "data-gathering",
    title: "Data gathering via TAP Stash/Submit Proof of Work",
    summary:
      "Collect timed TAP sessions in which learners externalize thinking under a selective Stash/Submit interface, producing dual-stream PoW traces.",
  },
  {
    id: "embeddings",
    title: "Embedding representations of PoW thought traces",
    summary:
      "Research vector representations of stashed and submitted traces (and session aggregates) suitable for proximity and region analysis in a shared embedding space.",
  },
  {
    id: "map-regions",
    title: "Map of Knowledge high-dimensional regions for knowledge areas",
    summary:
      "Define and evaluate high-dimensional regions in embedding space that correspond to labeled knowledge areas, and project them onto the Map of Knowledge.",
  },
] as const;

export type WhitepaperSection = {
  id: string;
  heading: string;
  /** Optional kicker for methods framing */
  kicker?: string;
  paragraphs: string[];
  bullets?: string[];
  /** Nested subsections (e.g. experiment steps) */
  subsections?: Array<{
    id: string;
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
};

export type TapWhitepaper = {
  path: typeof TAP_WHITEPAPER_PATH;
  meta: typeof TAP_WHITEPAPER_META;
  abstract: string;
  keywords: string[];
  sections: WhitepaperSection[];
  references: Array<{ id: string; citation: string }>;
};

export const TAP_STASH_SUBMIT_WHITEPAPER: TapWhitepaper = {
  path: TAP_WHITEPAPER_PATH,
  meta: TAP_WHITEPAPER_META,
  abstract: [
    "This working paper documents a software-mediated Think Aloud Protocol (TAP) designed to externalize cognition under contemporary AI-assisted work.",
    "Rather than treating the final answer as sufficient evidence of skill, the protocol elicits continuous verbalization and records a deliberate Stash / Submit decision on each crystallized thought fragment.",
    "We operationalize dual-process language for measurement: System 1 traces include spontaneous crystallized speech and stashed (unsent) fragments; System 2 traces include deliberate submit, edit, skip, select/deselect, and resend actions into the dialogue.",
    "Both streams are retained as first-class Proof of Work (PoW) data for later analysis—not as a polished transcript alone.",
    "We then outline a planned research program: (1) gather TAP Stash/Submit PoW at scale under controlled workspace goals; (2) study embedding representations of these dual-stream traces; and (3) construct a Map of Knowledge in which high-dimensional regions correspond to labeled areas of knowledge, enabling proximity-based measurement of “knowing X” beyond quiz pass rates.",
  ].join(" "),
  keywords: [
    "think-aloud protocol",
    "dual-process theory",
    "System 1 / System 2",
    "selective thought interface",
    "Stash / Submit",
    "proof of work",
    "learning measurement",
    "knowledge embeddings",
    "Map of Knowledge",
    "knowledge configuration space",
  ],
  sections: [
    {
      id: "introduction",
      heading: "1. Introduction",
      paragraphs: [
        "Skill verification and learning analytics increasingly face a measurement crisis: generative models can produce fluent final answers that obscure whether a human (or agent) can retrieve, apply, and transform knowledge under real constraints. Multiple-choice scores and deliverable-only portfolios sample thin output slices. Classic think-aloud methods (Ericsson & Simon, 1980/1993) remain a gold standard for process evidence, but they were not designed for AI-saturated workflows, shareable session links, or machine-readable dual streams of spontaneous versus filtered thought.",
        "We present an implementation of TAP that keeps the core scientific commitment—externalize thinking while it occurs—while adding a selective thought interface. Learners think out loud; each crystallized fragment is either stashed (kept private relative to the dialogue partner) or submitted into the dialogue. The intentionality of that choice is itself signal. The resulting dual stream becomes Proof of Work data: artifacts of process that can be scored, embedded, and compared against labeled regions of knowledge space.",
        "This paper is a methods and design document. It does not claim completed empirical region-learning results. Section 5 describes the experiment we plan to run.",
      ],
    },
    {
      id: "background",
      heading: "2. Background",
      kicker: "Think-aloud methods and dual-process framing",
      paragraphs: [
        "Protocol analysis of verbal reports has long treated concurrent verbalization as a window onto intermediate cognitive products, with careful caveats about reactivity and incomplete reportability (Ericsson & Simon, 1980/1993). In learning science and HCI, think-alouds are used for usability, tutoring research, and assessment design. Our contribution is not to replace that tradition, but to instrument a modern selective interface that separates spontaneous crystallization from deliberate dialogue participation.",
        "Dual-process accounts colloquially contrast fast, intuitive processing with slow, deliberative control (Kahneman, 2011). We adopt System 1 / System 2 as an operational measurement vocabulary, not as a claim of clean neurological modules. In product and research code, the mapping is explicit: System 1 ≈ spontaneous crystallized speech, including stashed/unsent thoughts; System 2 ≈ deliberate send, edit, skip, select/deselect, or resend into the dialogue. The interface makes metacognitive filtering inspectable—knowledge that is articulated but not submitted can indicate hesitation, incomplete understanding, or strategic withholding—while still preserving those fragments as PoW rather than discarding them.",
        "This operationalization is stated upfront so academic readers can evaluate construct validity without conflating product labels with clinical dual-process assays.",
      ],
    },
    {
      id: "protocol",
      heading: "3. Method: Think Aloud Protocol with Stash/Submit",
      kicker: "Selective thought interface",
      paragraphs: [
        "A TAP session is a timed, scoped episode inside a workspace that defines a knowledge or skill target (for example, a role skill block or a learning goal). A facilitator agent elicits continuous externalization with short prompts—definitions, causal steps, examples, transfer, and repair—without scoring live or lecturing the domain answer. The primary scientific goal of the live session is to maximize genuine thought-trace signal.",
        "The selective thought interface is central. Learners do not only stream audio into a black box. They produce transcribed thought fragments. For each fragment, they may Stash (retain as System 1 / unsent evidence) or Submit (enter System 2 dialogue participation). Related System 2 actions—edit, skip, select/deselect, resend—capture intentional revision and selection under social and evaluative pressure.",
        "Protocol purity constraints keep the method tool-agnostic: pen-and-paper, mental calculation, or LLM assistance may be present in the environment; the scored object remains the thinking that is externalized and the Stash/Submit decisions around it. The protocol thereby resists the failure mode in which AI-polished finals are mistaken for demonstrated skill, while remaining practical under real AI use.",
      ],
      bullets: [
        "Session goal: externalize cognition about a workspace-scoped target under time bounds.",
        "Elicitation: brief directed prompts that thicken traces (example, causal link, repair), not multi-paragraph lectures.",
        "Stash: fragment is crystallized and retained as System 1 / unsent PoW without becoming the dialogue turn of record.",
        "Submit (and related deliberate actions): fragment or revision enters System 2 dialogue evidence.",
        "Both streams are first-class: later analysis may contrast what was said privately versus what was advanced publicly.",
      ],
    },
    {
      id: "pow-data",
      heading: "4. Proof of Work data model",
      kicker: "What is captured and how it is used",
      paragraphs: [
        "We use Proof of Work (PoW) to mean machine- and human-inspectable process artifacts that stand as a proxy for proximity to a target knowledge configuration. In TAP, PoW includes the dialogue transcript, System 1 and System 2 thought-trace files, timestamps and inter-event structure (for example dwell before send, idle before crystallize), and session-level manifests that list attached traces.",
        "After the session, analysis may jointly consider transcript and traces. Scoring instructions treat System 1 counts (spontaneous and stashed speech) and System 2 counts (deliberate dialogue actions) as primary genuine-cognition signal: unsent knowledge can reveal gaps and metacognitive filtering; submitted reasoning can reveal what the learner is willing to stand behind.",
        "Separately, agent-facing APIs mirror the same intent taxonomy (buffer, then Stash or Submit into the regular PoW stack), so human TAP and agent evaluation can share a dual-stream PoW ontology. This paper focuses on the human TAP Stash/Submit method; the shared ontology is noted for completeness of the measurement stack.",
      ],
      bullets: [
        "Captured: verbalized fragments, Stash vs Submit (and edit/skip/select/resend) decisions, timestamps, dialogue context, workspace target labels.",
        "Retained: stashed/unsent traces as System 1 PoW; submitted turns and deliberate actions as System 2 PoW.",
        "Downstream: performance snapshots and related analyses consume both streams; polished finals alone are insufficient.",
      ],
    },
    {
      id: "planned-experiment",
      heading: "5. Planned experiment",
      kicker: "From dual-stream PoW to Map of Knowledge regions",
      paragraphs: [
        "We plan a multi-stage research program. The Map of Knowledge product surface already visualizes public embedding locations and regions for workspaces; the experiment below is the research program to systematically gather dual-stream TAP data, learn robust representations, and define high-dimensional regions that map to knowledge areas. Results are not claimed here.",
      ],
      subsections: [
        {
          id: "data-gathering",
          heading: "5.1 Data gathering via TAP Stash/Submit Proof of Work",
          paragraphs: [
            "Recruit participants (or consented production cohorts under appropriate ethics review) across a set of labeled workspace targets spanning well-bounded knowledge areas (for example algebraic procedures, systems design tradeoffs, or domain onboarding modules). Each participant completes one or more timed TAP sessions under the Stash/Submit interface with a fixed facilitator protocol.",
            "Primary deliverables of this stage are dual-stream PoW corpora: System 1 traces (including stashed fragments), System 2 deliberate actions, full transcripts, timing features, and ground-truth labels for the intended knowledge area and, where available, independent skill ratings. Inclusion criteria require sufficient System 1 and System 2 events per session to support later representation learning.",
          ],
          bullets: [
            "Independent variable (design): knowledge-area label and session goal scaffold.",
            "Protocol constant: Stash/Submit selective interface + short elicitation facilitator.",
            "Outputs: PoW packages suitable for embedding research and region supervision.",
          ],
        },
        {
          id: "embeddings",
          heading: "5.2 Embedding representations of PoW thought traces",
          paragraphs: [
            "We will research embedding functions that map dual-stream traces (and session aggregates) into a high-dimensional vector space. Candidate inputs include: (i) concatenated System 1 text; (ii) System 2 submitted text; (iii) joint encodings that mark stash vs submit as discrete channels; (iv) temporal features fused with text embeddings.",
            "Evaluation criteria include within-area cohesion, between-area separation, stability under paraphrase, sensitivity to genuine gap markers (missing definitions, weak causal links), and preservation of System 1 vs System 2 contrast. Embeddings from different model identifiers will not be mixed—a constraint already enforced in Map of Knowledge loaders—so experiment runs must fix and report embedding_model_id and dimension.",
          ],
          bullets: [
            "Hypothesis (directional): dual-stream encodings improve discrimination of knowledge areas over final-answer-only embeddings.",
            "Ablations: System 1 only, System 2 only, joint, transcript-only baselines.",
            "Reporting: model id, dim, training/adaptation procedure, and leakage controls vs workspace text.",
          ],
        },
        {
          id: "map-regions",
          heading: "5.3 Map of Knowledge high-dimensional regions for knowledge areas",
          paragraphs: [
            "Given embeddings of sessions (and/or learners at a given as-of time), we will define regions in high-dimensional space associated with specific knowledge areas—for example centroids and radii, density clusters, or supervised region models with confidence. These regions operationalize “knowing X” as proximity to a labeled region rather than a binary exam pass.",
            "Regions will be projected for human inspection on the Map of Knowledge (2D/3D views of public or study-cohort configurations) while primary claims remain in the native embedding dimension. Success metrics include region purity, calibration of confidence against held-out ratings, and qualitative expert review of boundary cases. The existing Map of Knowledge UI is a visualization and exploration substrate; region learning is the planned research contribution of this stage.",
          ],
          bullets: [
            "Target construct: high-dim regions ↔ labeled knowledge areas.",
            "Use of map: visualization, public cohort exploration, and hypothesis generation—not a substitute for high-dim evaluation.",
            "Outcomes: documented region definitions, uncertainty estimates, and open limitations.",
          ],
        },
      ],
    },
    {
      id: "limitations",
      heading: "6. Limitations and ethics",
      paragraphs: [
        "Verbal reports are incomplete and can be reactive; the Stash/Submit interface may alter what participants choose to say. We treat dual-stream PoW as a richer proxy, not as a full readout of neural state. System 1 / System 2 labels are operational, not clinical diagnoses.",
        "AI-assisted environments complicate attribution; protocol purity emphasizes externalized reasoning quality but cannot eliminate all confounds. Embedding spaces inherit biases of underlying models; region definitions must be audited for demographic and linguistic skew.",
        "Human subjects research requires informed consent, clear data retention, and careful handling of stashed content (which participants may reasonably treat as more private). Production telemetry and research corpora should be separated by policy. We do not claim that proximity in embedding space is identical to physical brain configuration; it is a measurement proxy aligned with our knowledge-configuration thesis.",
      ],
    },
    {
      id: "conclusion",
      heading: "7. Conclusion",
      paragraphs: [
        "The Think Aloud Protocol with a Stash/Submit selective interface provides a practical, researchable method for externalizing System 1 and System 2 thinking as dual-stream Proof of Work. By retaining stashed as well as submitted cognition, the method resists final-answer theater and yields process data suitable for embedding research.",
        "Our planned experiment will gather such data, study representations that respect dual streams, and define high-dimensional Map of Knowledge regions tied to specific knowledge areas. Completing that program is future work; this paper fixes the method and experimental outline so the research can proceed with transparent constructs.",
      ],
    },
  ],
  references: [
    {
      id: "ericsson-simon",
      citation:
        "Ericsson, K. A., & Simon, H. A. (1980/1993). Protocol analysis: Verbal reports as data. MIT Press.",
    },
    {
      id: "kahneman",
      citation:
        "Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.",
    },
    {
      id: "chi",
      citation:
        "Chi, M. T. H. (1997). Quantifying qualitative analyses of verbal data: A practical guide. Journal of the Learning Sciences, 6(3), 271–315.",
    },
    {
      id: "uncertain-systems-method",
      citation:
        "Uncertain Systems. (2026). Think Aloud Protocol surface and selective thought interface (implementation notes): System 1 as spontaneous/stashed crystallized speech; System 2 as deliberate submit/edit/skip/select/resend; both as workspace Proof of Work for later analysis.",
    },
  ],
};

/** Flatten all body text for term search / tests. */
export function getTapWhitepaperFullText(paper: TapWhitepaper = TAP_STASH_SUBMIT_WHITEPAPER): string {
  const parts: string[] = [
    paper.meta.title,
    paper.meta.description,
    paper.abstract,
    ...paper.keywords,
  ];
  for (const section of paper.sections) {
    parts.push(section.heading, ...(section.paragraphs ?? []), ...(section.bullets ?? []));
    for (const sub of section.subsections ?? []) {
      parts.push(sub.heading, ...(sub.paragraphs ?? []), ...(sub.bullets ?? []));
    }
  }
  for (const ref of paper.references) {
    parts.push(ref.citation);
  }
  return parts.join("\n");
}

/** Experiment section only (for verification excerpts). */
export function getTapWhitepaperExperimentText(
  paper: TapWhitepaper = TAP_STASH_SUBMIT_WHITEPAPER,
): string {
  const section = paper.sections.find((s) => s.id === "planned-experiment");
  if (!section) return "";
  const parts: string[] = [section.heading, ...section.paragraphs];
  for (const sub of section.subsections ?? []) {
    parts.push(sub.heading, ...sub.paragraphs, ...(sub.bullets ?? []));
  }
  // Also include canonical step titles/summaries for stable anchors
  for (const step of TAP_WHITEPAPER_EXPERIMENT_STEPS) {
    parts.push(step.title, step.summary);
  }
  return parts.join("\n");
}
