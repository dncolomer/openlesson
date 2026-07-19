import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { buildPrivacyDataSlide } from "@/lib/sales/privacy-data-slide";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import {
  THESIS_HIGHLIGHT_LABELS,
  thesisScienceHighlights,
} from "@/lib/sales/thesis-science-snippet";

export const VERIFICATION_PITCH_DECK: SolutionSlideDeck = {
  vertical: "verification",
  label: "Verification Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.verification,
  slides: [
    {
      layout: "title",
      kicker: "Learning Verification · Uncertain Systems",
      title: "Verify skills before they cost you downstream.",
      subtitle:
        "Confirm what candidates, employees, and agents can actually do before hire, promote, certify, or deploy. Example: an HR tech or talent marketplace embeds verification into its existing funnel.",
      backgroundImage: PITCH_ASSETS.aesthetics.verification,
      cards: [
        {
          label: "1 · Hosted TAP in the ATS",
          body: "At screening or final interview, send a shareable Think Aloud Protocol link scoped to a role skill block. Candidates talk through real work on a clock. Scores and gap reports land back in the applicant record.",
        },
        {
          label: "2 · ILE for senior depth",
          body: "For staff and technical tracks, run coached ILE scenarios instead of one-shot take-homes. Same workspace markers; deeper multi-step judgment, debugging, or design tradeoffs.",
        },
        {
          label: "3 · PoW API in their stack",
          body: "When the product owns the UX, pipe recordings, docs, and agent tool traces into Proof-of-Work API endpoints. Anonymized payloads if needed. Deploy gates and compliance links use the same scoring model.",
        },
      ],
    },
    ...buildFounderSlides("verification"),
    {
      layout: "statement",
      kicker: "The problem",
      title: "Polished output is no longer proof of skill.",
      subtitle:
        "AI assist makes take-homes, interviews, and agent demos look production-ready. HR tech, recruitment platforms, and talent marketplaces need verification that survives the assist layer.",
      backgroundImage: PITCH_ASSETS.aesthetics.problem,
      ...labeledHighlights([
        [
          "The trap",
          "Polished output is no longer proof of skill.",
        ],
        [
          "What buyers need",
          "Verification that survives the assist layer before hire, promote, certify, or deploy.",
        ],
      ]),
      bullets: [
        "Candidates deliver AI-fed interviews and take-home fluff",
        "Employees self-report proficiency that manager anecdotes cannot stress-test",
        "Agents ship on benchmark scores that do not predict production tool use",
        "Compliance and certification still rely on checkbox completions",
      ],
    },
    {
      layout: "statement",
      kicker: "Our thesis",
      title: "The definition of Learning is radically changing",
      subtitle:
        "One workspace model scores live cognition and tool traces. Auditable gap reports.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      highlights: thesisScienceHighlights("verification"),
      highlightLabels: [...THESIS_HIGHLIGHT_LABELS],
      bullets: [
        "Human hard skill validation under probe",
        "Agentic skill validation from real tool traces",
        "Trace Interruption Model targets where reasoning actually breaks",
        "Proof of work tied to the decision you need to make",
      ],
    },
    {
      layout: "statement",
      kicker: "Integration depth",
      title: "Three flavours for speed, depth, and native embed",
      subtitle:
        "Same workspace scoring model in every flavour. Pick hosted speed, hosted depth, or full API integration into your stack.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      cards: [
        {
          label: "01 · TAP (Think Aloud Protocol)",
          body: "Hosted process. Live, time-framed verification links. Ideal for high-volume screening and interview stages without building your own UX.",
        },
        {
          label: "02 · ILE (Integrated Learning Environment)",
          body: "Hosted process. Open-ended assignment and project-style depth for complex judgment, debugging, and design tradeoffs under coach.",
        },
        {
          label: "03 · PoW API (Proof-of-Work)",
          body: "Native integration into ATS, HRIS, LMS, CI, and agent pipelines when you own the UX. Pipe traces and artifacts (including anonymized payloads) into the same markers.",
        },
      ],
    },
    buildPrivacyDataSlide(),
    {
      layout: "statement",
      kicker: "Use case · Hiring",
      title: "Recruitment & applicant screening",
      subtitle:
        "Replace thin take-home signals with verified reasoning. Score live think-aloud sessions or structured practice blocks before candidates reach final interviews.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "Shareable TAP links scoped to role-critical skill blocks",
        "Marker scores with rationale",
        "Compare candidates on the same workspace scenarios",
        "Surface cognitive skills and judgment moves multiple-choice cannot fake",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · TAP-cha",
      title: "Prove a live human is behind the keyboard.",
      subtitle:
        "A short Think Aloud Protocol session confirms a real person.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      ...labeledHighlights([
        [
          "Use case",
          "TAP-cha: a short Think Aloud Protocol to prove a live human is behind the keyboard.",
        ],
        [
          "Signal that sticks",
          "Hesitations, self-corrections, and causal reasoning under probe.",
        ],
      ]),
      bullets: [
        "Defends remote interviews and async assessments against AI assist abuse",
        "Socratic probes force on-the-spot reconstruction of the work",
        "Auditable traces for fraud review and compliance teams",
        "Lightweight enough for high-volume funnels; deep enough for high-stakes roles",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · Deploy gates",
      title: "Agent vendor & deploy readiness",
      subtitle:
        "Validate agentic skill before production rollout. Score tool traces and run scenarios the same way you gate human hires.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "Beyond benchmark pass rates: tool use under realistic workspace constraints",
        "Severity-ranked gaps feed ALE skill iteration before go-live",
        "Vendor evaluation with the same scoring model as internal agents",
        "CI-friendly Proof-of-Work API hooks for continuous gates",
      ],
    },
    {
      layout: "bullets",
      kicker: "More verification motions",
      title: "Where teams put verification first",
      backgroundImage: PITCH_ASSETS.aesthetics.verification,
      bullets: [
        "Internal mobility & promotion gates",
        "Staffing & talent marketplace quality",
        "Certification & compliance attestations",
        "Soft skill & judgment checks",
      ],
    },
    {
      layout: "close",
      kicker: "Next step",
      title: "Verify skills before hire, deploy, or certify.",
      backgroundImage: PITCH_ASSETS.aesthetics.close,
      bullets: [
        "Map TAP, ILE, and Proof-of-Work API tiers to your HR or recruitment product",
        "Pilot one gate: screening, TAP-cha, promotion, or agent deploy",
        "Create a Workspace and score the first real scenario this week",
      ],
      footnote: "uncertain.systems · Learning Verification · TAP · ILE · Proof-of-Work API",
    },
  ],
};
