/**
 * Academic white paper: Knowledge Tomography as methodologies that prompt
 * human and agentic entities to reproduce their state of knowledge, framed
 * against knowledge induction tech, with a planned TAP validation study.
 * Content is structured so tests can assert definitional terms and study outline.
 */

import type { ScienceWhitepaper, WhitepaperExperimentStep } from "@/lib/science/whitepaper-types";
import {
  getWhitepaperExperimentText,
  getWhitepaperFullText,
} from "@/lib/science/whitepaper-types";

export const KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH =
  "/science/knowledge-tomography" as const;

export const KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_META = {
  title:
    "Knowledge Tomography: Prompting Human and Agentic Entities to Reproduce Their State of Knowledge",
  shortTitle: "Knowledge Tomography White Paper",
  authors: "Uncertain Systems Research",
  version: "1.0",
  status: "Working paper · Methods and planned study",
  date: "2026",
  description:
    "A methods white paper defining knowledge tomography as methodologies that prompt human and agentic entities to reproduce their state of knowledge, framed against the ultimate goal of knowledge induction technology, with a planned study validating TAP as an initial tomography tool.",
} as const;

/** Terms that must appear in the shipped paper (tests and science link). */
export const KNOWLEDGE_TOMOGRAPHY_METHOD_TERMS = [
  "knowledge tomography",
  "reproduce",
  "state of knowledge",
  "human",
  "agentic",
  "knowledge induction",
  "Think Aloud Protocol",
  "TAP",
  "tomography tool",
] as const;

/** Planned study step anchors (substance, not sales). */
export const KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS: readonly WhitepaperExperimentStep[] = [
  {
    id: "protocol-instrumentation",
    title: "Instrument TAP sessions as tomography probes",
    summary:
      "Run timed Think Aloud Protocol sessions that prompt participants to reproduce target knowledge states under controlled workspace goals, capturing dual-stream Proof of Work traces as tomographic slices.",
  },
  {
    id: "reconstruction-validity",
    title: "Measure reconstruction fidelity of the knowledge state",
    summary:
      "Score how completely and accurately externalized traces reconstruct the intended knowledge configuration, including gap detection, transfer items, and inter-rater agreement on recovery quality.",
  },
  {
    id: "agentic-extension",
    title: "Extend tomography prompts to agentic entities",
    summary:
      "Apply the same reproduce-your-knowledge elicitation to agentic systems under matched targets, comparing human and agent reconstruction profiles as co-equal tomographic subjects.",
  },
] as const;

export const KNOWLEDGE_TOMOGRAPHY_WHITEPAPER: ScienceWhitepaper = {
  path: KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_PATH,
  meta: KNOWLEDGE_TOMOGRAPHY_WHITEPAPER_META,
  abstract: [
    "Knowledge induction technology aims to move a mind—or an agent—from one knowledge configuration toward another useful one with less wasted effort.",
    "Before induction can be steered reliably, we need measurement methods that externalize what an entity currently “knows,” not merely what it outputs on a thin quiz slice.",
    "We define knowledge tomography as the family of methodologies that prompt human as well as agentic entities to try to reproduce their state of knowledge under controlled elicitation, producing inspectable process artifacts (tomographic slices) of that state.",
    "Like medical tomography, the goal is reconstruction from projections: each probe is incomplete alone; a designed battery of prompts yields a multi-angle recovery of configuration, gaps, and proximity to target knowledge.",
    "We position the Think Aloud Protocol (TAP) with selective Stash/Submit as an initial tomography tool, and outline a planned validation study that tests whether TAP-elicited dual-stream Proof of Work reconstructs knowledge state more faithfully than final-answer-only baselines for both human learners and agentic systems.",
  ].join(" "),
  keywords: [
    "knowledge tomography",
    "knowledge induction",
    "state of knowledge",
    "reproduce knowledge",
    "think-aloud protocol",
    "TAP",
    "agentic systems",
    "proof of work",
    "learning measurement",
    "knowledge configuration",
  ],
  experimentSteps: KNOWLEDGE_TOMOGRAPHY_STUDY_STEPS,
  sections: [
    {
      id: "introduction",
      heading: "1. Introduction",
      paragraphs: [
        "Educational technology and agent evaluation share a measurement problem. Final answers, multiple-choice scores, and polished deliverables sample thin output surfaces. They often fail to distinguish fluent generation from a recoverable, transformable state of knowledge—especially under AI-assisted work where the surface answer may not originate in the evaluated mind.",
        "We introduce knowledge tomography as a methodological frame: prompt human and agentic entities to try to reproduce their state of knowledge, capture the process of that reproduction, and treat the resulting artifacts as projections from which a fuller picture of configuration can be reconstructed. Tomography is not the end goal. It is the measurement substrate required for knowledge induction technology—systems that actively transform configuration toward useful proximity with calibrated effort.",
        "This working paper is a methods and design document. Section 2 frames tomography against induction. Section 3 defines the construct. Section 4 states methodological principles for humans and agents. Section 5 outlines a planned study validating the Think Aloud Protocol (TAP) as an initial tomography tool. We do not claim completed empirical results.",
      ],
    },
    {
      id: "induction-framing",
      heading: "2. Knowledge induction as the long-horizon aim",
      kicker: "Why measurement must precede steering",
      paragraphs: [
        "Knowledge induction tech names the long-horizon goal: methods and systems that induce desired knowledge configurations—moving an entity through configuration space toward states where target material can be retrieved, applied, and transformed with high reliability. Induction is transformation under guidance: shorter paths, less wasted effort, preserved depth.",
        "Induction without tomography is blind steering. If we cannot externalize and reconstruct what an entity currently knows—and does not know—we cannot choose interventions, estimate proximity, or evaluate whether a transformation succeeded beyond a single test item. Quizzes and final products remain useful outcomes, but they are insufficient control signals for closed-loop induction.",
        "Knowledge tomography therefore sits upstream of induction product roadmaps. Software attention loops, Socratic facilitation, proof-of-work verification, and later world models or biofeedback layers all depend on richer state estimates than pass/fail. This paper fixes the measurement vocabulary so induction research can cite a named family of methods rather than ad hoc “ask them to explain.”",
      ],
      bullets: [
        "Ultimate aim: knowledge induction—guided transformation of knowledge configuration.",
        "Prerequisite: tomographic measurement of current state via reproduce-your-knowledge prompts.",
        "Scope of this paper: define tomography; outline TAP as first tool; leave full induction systems to future work.",
      ],
    },
    {
      id: "definition",
      heading: "3. Defining knowledge tomography",
      kicker: "Reproduce the state of knowledge",
      paragraphs: [
        "We define knowledge tomography as methodologies that prompt human as well as agentic entities to try to reproduce their state of knowledge, capturing multi-angle process evidence from which that state can be reconstructed and compared to a target configuration.",
        "Three commitments distinguish the construct. First, the primary act is reproduction: the entity is asked to re-externalize what it holds—definitions, causal structure, procedures, examples, boundary cases, and transfer—not merely to select among options. Second, subjects include both humans and agentic systems; the same family of prompts and scoring ontology should apply so co-evaluation is possible. Third, each elicitation is a projection (a tomographic slice), incomplete alone; designed batteries of prompts yield reconstruction of configuration, gaps, and proximity.",
        "The medical metaphor is deliberate but bounded. We do not claim neural imaging. We claim a measurement program: controlled projections → reconstruction of an unobservable internal configuration (operationalized as knowledge state) → uncertainty estimates and gap maps. Proof of Work (PoW) dual-stream traces, embeddings, and Map of Knowledge regions are engineering substrates that can carry tomographic slices; they are not synonyms for the methodology itself.",
      ],
      bullets: [
        "Core verb: reproduce (re-externalize) the entity’s state of knowledge under prompt.",
        "Subjects: human learners and agentic entities under matched targets.",
        "Output: inspectable process artifacts (slices) for multi-angle reconstruction, not finals alone.",
        "Relation to induction: tomography measures; induction transforms.",
      ],
    },
    {
      id: "method-principles",
      heading: "4. Methodological principles for human and agentic subjects",
      kicker: "Shared elicitation ontology",
      paragraphs: [
        "A tomography protocol specifies a knowledge target, a prompt battery designed to force reproduction across facets of that target, capture rules for process artifacts, and a reconstruction / scoring procedure. Facets typically include definition, mechanism or procedure, worked example, counterexample or edge case, transfer, and self-reported uncertainty. Incomplete or contradictory reproduction is signal, not noise.",
        "For human subjects, concurrent verbalization and selective thought interfaces (for example TAP Stash/Submit) preserve spontaneous crystallization alongside deliberate dialogue participation. For agentic entities, matched prompts request the same facets with explicit instructions to externalize intermediate reasoning and to withhold or revise under a dual-stream ontology where available. In both cases, polished final answers alone are insufficient tomography.",
        "Construct validity requires that prompts target reproduction of held knowledge rather than open-book retrieval or tool-mediated generation that bypasses the entity under test. Environments may include tools; scoring focuses on what is externalized as the entity’s attempted reconstruction of its own state. Protocol purity, consent for humans, and disclosure of agent scaffolding are mandatory reporting items.",
      ],
      bullets: [
        "Prompt batteries force multi-facet reproduction of a labeled knowledge target.",
        "Capture process: verbal/text traces, timing, revisions, stash vs submit where instrumented.",
        "Humans and agents share facet ontology and scoring rubrics for comparable slices.",
        "Reconstruction metrics: completeness, accuracy, gap localization, transfer, rater agreement.",
      ],
    },
    {
      id: "planned-study",
      heading: "5. Planned study: validating TAP as an initial tomography tool",
      kicker: "Think Aloud Protocol as first tomographic instrument",
      paragraphs: [
        "We plan a validation study that treats the Think Aloud Protocol (TAP)—in particular the selective Stash/Submit interface documented in our companion methods paper—as an initial knowledge tomography tool. The study asks whether TAP-elicited dual-stream Proof of Work reconstructs human knowledge state more faithfully than final-answer-only baselines, and whether the same elicitation frame extends to agentic entities under matched targets. Results are not claimed here; the outline below fixes aims, design, and success criteria.",
      ],
      subsections: [
        {
          id: "study-aims",
          heading: "5.1 Aims and hypotheses",
          paragraphs: [
            "Primary aim: validate TAP as an initial tomography tool for human knowledge-state reconstruction. Secondary aim: pilot agentic tomography under the same reproduce-your-knowledge battery. Exploratory aim: compare human and agent reconstruction profiles on identical targets as a co-evaluation substrate for later induction research.",
            "Directional hypothesis: dual-stream TAP traces (System 1 spontaneous/stashed plus System 2 deliberate submit actions) improve reconstruction fidelity—completeness of facets, gap detection, and agreement with independent skill ratings—relative to final-answer-only or transcript-without-stash baselines.",
          ],
          bullets: [
            "H1: TAP dual-stream PoW > final-answer-only on reconstruction fidelity for humans.",
            "H2: Multi-facet prompt batteries yield higher gap localization accuracy than single free-response items.",
            "H3 (pilot): Agentic entities produce scorable tomographic slices under matched prompts; profiles differ systematically from humans on the same targets.",
          ],
        },
        {
          id: "protocol-instrumentation",
          heading: "5.2 Design: instrument TAP sessions as tomography probes",
          paragraphs: [
            "Participants complete timed TAP sessions inside workspaces with labeled knowledge targets. A facilitator protocol prompts continuous externalization and multi-facet reproduction (definition, causal/procedural steps, example, edge case, transfer, repair). The Stash/Submit selective interface records spontaneous crystallization and deliberate dialogue participation as dual-stream PoW—the tomographic slices for each session.",
            "Conditions include at least: (A) full TAP Stash/Submit tomography battery; (B) final-answer-only control; (C) optional free-response without stash instrumentation. Knowledge-area labels and session goals are fixed within blocks. Inclusion requires minimum System 1 and System 2 event counts for the TAP arm so dual-stream analysis is powered.",
          ],
          bullets: [
            "Independent variables: elicitation condition (TAP tomography vs baselines); knowledge-area label.",
            "Protocol constant: multi-facet reproduce-your-knowledge battery + timed session bounds.",
            "Outputs: dual-stream PoW packages, finals, independent skill ratings where available.",
          ],
        },
        {
          id: "reconstruction-validity",
          heading: "5.3 Measures: reconstruction fidelity of the knowledge state",
          paragraphs: [
            "Reconstruction fidelity is the primary dependent family: expert or calibrated rater scores for facet completeness and accuracy; gap localization (correct identification of missing or weak components); transfer item performance; and inter-rater reliability. Secondary measures include timing structure, stash/submit ratios as metacognitive filters, and embedding-space proximity to labeled knowledge regions when available.",
            "We will pre-register scoring rubrics that map externalized traces onto target knowledge configurations without rewarding mere verbosity. Sensitivity analyses will separate transcript-only vs dual-stream encodings to isolate the tomography value of stash-retained cognition.",
          ],
          bullets: [
            "Primary: facet completeness/accuracy, gap localization, transfer, rater agreement.",
            "Secondary: dual-stream structure features; optional embedding proximity to knowledge regions.",
            "Controls: leakage vs workspace text; fixed embedding model id when vectors are used.",
          ],
        },
        {
          id: "agentic-extension",
          heading: "5.4 Agentic extension and analysis plan",
          paragraphs: [
            "Under matched knowledge targets and facet batteries, agentic systems receive the same reproduce-your-knowledge prompts with instructions to externalize intermediate reasoning. Where agent tooling supports dual-stream buffer semantics (stash vs submit into PoW), those channels are recorded; otherwise intermediate chain artifacts are captured as the nearest available projection.",
            "Analysis compares reconstruction fidelity across conditions for humans first, then describes agent profiles and human–agent divergences. Success for TAP-as-tomography-tool is defined on the human arm (H1–H2). Agentic results are pilot evidence that knowledge tomography methodologies apply beyond humans, informing induction tech that must eventually co-steer mixed human–agent teams.",
          ],
          bullets: [
            "Matched targets and rubrics for human and agentic subjects.",
            "Primary validation claim rests on human TAP vs baseline reconstruction.",
            "Agent arm: feasibility of co-equal tomographic subjects; descriptive profile comparison.",
          ],
        },
      ],
    },
    {
      id: "limitations",
      heading: "6. Limitations and ethics",
      paragraphs: [
        "Reproduction is incomplete and can be reactive; prompting changes what is said. Tomographic reconstruction is a proxy for knowledge state, not a full neural readout. Agentic “knowledge” is tool- and context-dependent; we report scaffolding and do not equate weights with human understanding.",
        "TAP validation will not exhaust the space of tomography methods (written protocols, structured interviews, interactive probes, multi-session longitudinal slices). Claiming TAP as an initial tool is not a claim of uniqueness or optimality.",
        "Human subjects research requires informed consent, clear retention of stashed content, and separation of research corpora from production telemetry. Comparative agent studies must avoid overclaiming human-likeness. Induction systems built on tomographic estimates inherit measurement error; uncertainty should remain first-class in any closed loop.",
      ],
    },
    {
      id: "conclusion",
      heading: "7. Conclusion",
      paragraphs: [
        "Knowledge tomography is the family of methodologies that prompt human as well as agentic entities to try to reproduce their state of knowledge, yielding multi-angle process projections for reconstruction. It is the measurement counterpart to knowledge induction technology, which aims to transform configuration toward useful proximity with less wasted effort.",
        "We position TAP Stash/Submit as an initial tomography tool and outline a planned validation study with concrete aims, conditions, reconstruction metrics, and an agentic pilot arm. Completing that study is future work; this paper fixes the definitional frame and experimental outline so measurement research can proceed with transparent constructs.",
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
      id: "chi",
      citation:
        "Chi, M. T. H. (1997). Quantifying qualitative analyses of verbal data: A practical guide. Journal of the Learning Sciences, 6(3), 271–315.",
    },
    {
      id: "kahneman",
      citation:
        "Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.",
    },
    {
      id: "tap-companion",
      citation:
        "Uncertain Systems. (2026). Think Aloud Protocol with Selective Stash/Submit: Externalizing System 1 and System 2 as Proof of Work. Working paper. https://uncertain.systems/science/think-aloud-protocol",
    },
    {
      id: "knowledge-config",
      citation:
        "Uncertain Systems. (2026). Science thesis: knowledge configuration, proximity as knowing, and learning as transformation (platform science page).",
    },
  ],
};

/** Flatten all body text for term search / tests. */
export function getKnowledgeTomographyFullText(
  paper: ScienceWhitepaper = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER,
): string {
  return getWhitepaperFullText(paper);
}

/** Planned study section only (for verification excerpts). */
export function getKnowledgeTomographyStudyText(
  paper: ScienceWhitepaper = KNOWLEDGE_TOMOGRAPHY_WHITEPAPER,
): string {
  return getWhitepaperExperimentText(paper, ["planned-study"]);
}
