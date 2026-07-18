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
        "Confirm what candidates, employees, and agents can actually do — before you hire, promote, certify, or deploy. Signal beyond polished deliverables and benchmark pass rates.",
      backgroundImage: PITCH_ASSETS.aesthetics.verification,
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
          "Polished output is no longer proof of skill — assist makes take-homes, interviews, and agent demos look production-ready.",
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
        "One workspace model scores live cognition and tool traces. Auditable gap reports — not vanity completion metrics — before hire, deploy, or certify.",
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
      layout: "split",
      kicker: "Integration depth",
      title: "Three tiers — pick speed vs depth vs native embed",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      left: {
        label: "01 TAP · 02 ILE — hosted processes",
        items: [
          "TAP and ILE are hosted processes on Uncertain Systems — shareable links, no build-your-own UX required",
          "Think Aloud Protocol: live, time-framed verification sessions as a hosted product experience",
          "ILE: hosted open-ended assignment and project-style depth for complex judgment under coach",
          "Ideal when you want speed (screening, interviews) or depth without integrating scoring into your stack first",
        ],
      },
      right: {
        label: "03 Proof-of-Work API — native integration",
        items: [
          "Full integration into ATS, HRIS, LMS, CI, agent pipelines when you own the UX",
          "Pipe recordings, documents, traces, and screen shares — including anonymized or redacted payloads",
          "Scoring endpoints wired to your gates and data model",
          "Same markers for human and agent paths as the hosted TAP and ILE processes",
        ],
      },
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
        "Marker scores with rationale — not a single opaque pass/fail score",
        "Compare candidates on the same workspace scenarios",
        "Surface cognitive skills and judgment moves multiple-choice cannot fake",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · TAP-cha",
      title: "Prove a live human is behind the keyboard.",
      subtitle:
        "A short Think Aloud Protocol session confirms a real person — not a bot, scripted agent, or AI-fed impersonation. Hesitations, self-corrections, and causal reasoning under probe are signal a completion checkbox cannot fake.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      ...labeledHighlights([
        [
          "Use case",
          "TAP-cha: a short Think Aloud Protocol to prove a live human is behind the keyboard — not a bot or AI-fed impersonation.",
        ],
        [
          "Signal that sticks",
          "Hesitations, self-corrections, and causal reasoning under probe — signal a completion checkbox cannot fake.",
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
        "Validate agentic skill before production rollout. Score tool traces and run scenarios the same way you gate human hires — one standard across your stack.",
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
        "Internal mobility & promotion gates — realistic workflows, not self-reported proficiency",
        "Staffing & talent marketplace quality — auditable gap reports per skill block for buyers",
        "Certification & compliance attestations — verification links per role or regulation",
        "Soft skill & judgment checks — tradeoffs, stakeholder reasoning, metacognitive moves",
      ],
    },
    {
      layout: "bullets",
      kicker: "Why it works",
      title: "Highlights buyers care about",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      ...labeledHighlights([
        [
          "One model",
          "One workspace model for human and agentic validation — same markers across TAP, ILE, and PoW API.",
        ],
        [
          "Auditable depth",
          "Gap reports with rationale, not vanity completion metrics — pick hosted speed or native PoW embed.",
        ],
      ]),
      bullets: [
        "One workspace model for human and agentic validation",
        "Auditable gap reports — not vanity completion metrics",
        "Pick depth by role: TAP for speed, ILE for complexity, PoW API for native integration",
        "Learning world model + Trace Interruption Model under every probe",
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
