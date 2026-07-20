import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import {
  THESIS_HIGHLIGHT_LABELS,
  thesisScienceHighlights,
} from "@/lib/sales/thesis-science-snippet";

export const AUGMENTATION_PITCH_DECK: SolutionSlideDeck = {
  vertical: "augmentation",
  label: "Augmentation Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.augmentation,
  slides: [
    {
      layout: "title",
      kicker: "Learning Augmentation · Uncertain Systems",
      title: "Augment thinking where courses stop at recall.",
      subtitle:
        "Strengthen how learners think inside paths you already ship. Example: an online course platform or corporate academy replaces “check your knowledge” quizzes with timed probes and coached practice in the lesson flow.",
      backgroundImage: PITCH_ASSETS.aesthetics.augmentation,
      cards: [
        {
          label: "1 · Drop probes into the lesson",
          body: "Embed TAP or ILE blocks after a module instead of a multiple-choice gate. Learners talk through real scenarios on a clock while staying in course context.",
        },
        {
          label: "2 · Interrupt shallow fluency",
          body: "TIM fires probes when the workspace detects weak causal chains or hesitation—not on a fixed quiz schedule. Completion no longer means only recall passed.",
        },
        {
          label: "3 · Score and coach in-path",
          body: "Gap reports and practice route back into the same LMS or academy flow. Publishers and prep programs ship verification layers with content, not a bolt-on tutor tab.",
        },
      ],
    },
    ...buildFounderSlides("augmentation"),
    {
      layout: "statement",
      kicker: "The problem",
      title: "“Check your knowledge” is not understanding.",
      subtitle:
        "EdTech, certification prep, and course platforms still measure recall with linear quizzes. Learners claim completion while shallow fluency survives every multiple-choice gate.",
      backgroundImage: PITCH_ASSETS.aesthetics.problem,
      ...labeledHighlights([
        [
          "The trap",
          "“Check your knowledge” is not understanding.",
        ],
        [
          "What survives",
          "Shallow fluency survives every multiple-choice gate while learners claim completion.",
        ],
      ]),
      bullets: [
        "Video-and-quiz curricula never surface hesitations or bad causal chains",
        "Prep agencies drill banks without defending decisions under probe",
        "Corporate academies equate completion with readiness",
        "Bootcamps coach homework volume instead of verified reasoning traces",
      ],
    },
    {
      layout: "statement",
      kicker: "Our thesis",
      title: "Interrupt shallow fluency with probes the model already knows to fire.",
      subtitle:
        "Augmentation is the third vertical: Trace Interruption Model breaks turn-based quiz linearity and embeds verification-plus-practice in the learning path.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      highlights: thesisScienceHighlights("augmentation"),
      highlightLabels: [...THESIS_HIGHLIGHT_LABELS],
      bullets: [
        "Onboarding, courses, and prep get the same workspace world model",
        "TAP and ILE replace lightweight recall widgets where depth matters",
        "Probes arrive in context",
        "Coaching tuned to the gap the workspace already detected",
      ],
    },
    {
      layout: "split",
      kicker: "How it embeds",
      title: "Links, practice, and API without a bolt-on tutoring tab",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      left: {
        label: "In the flow",
        items: [
          "Drop TAP or ILE blocks into lesson sequences",
          "Shareable probes aligned to real exam or product domains",
          "Interruptions timed by TIM, not fixed quiz slots",
          "Learners stay inside course context while reasoning is scored",
        ],
      },
      right: {
        label: "In your stack",
        items: [
          "Embeddable links and API hooks for LMS and course builders",
          "Proof-of-Work scoring for publishers and partners",
          "Verification layers that travel with content catalogs",
          "Same markers as platform verification and optimization",
        ],
      },
    },
    {
      layout: "statement",
      kicker: "Use case · Onboarding",
      title: "Corporate academy & product onboarding depth",
      subtitle:
        "Augment video-and-quiz curricula with interruption moments that catch shallow fluency before learners claim completion.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "Onboarding probes for judgment, not only feature tours",
        "Surface tradeoffs and stakeholder reasoning early",
        "Route weak spots into coached practice without leaving the program",
        "Managers get auditable reasoning traces, not attendance",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · Courses",
      title: "EdTech platforms & “check your knowledge” replacement",
      subtitle:
        "Replace lightweight knowledge checks with verification that measures understanding.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      ...labeledHighlights([
        [
          "Use case",
          "Replace “check your knowledge” widgets with verification that measures understanding in-course.",
        ],
        [
          "Outcome",
          "Weak spots route into coached practice inside the same course context.",
        ],
      ]),
      bullets: [
        "Drop TAP or ILE into lesson flows on learning apps",
        "Hesitations, causal reasoning, and revision patterns MC items miss",
        "Keep lightweight recall where it belongs; add depth where it counts",
        "Publisher & content licensing: verification layers travel with catalogs",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · Prep probes",
      title: "Certification prep under timed, probed scenarios",
      subtitle:
        "Move beyond drill banks. Verify whether candidates can explain tradeoffs and defend decisions under scenarios aligned to the real exam domain.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "Bootcamp & cohort programs get reasoning traces per learner",
        "Instructors calibrate coaching to verified gaps, not homework volume",
        "Prep agencies differentiate on depth, not bank size",
        "TIM interruptions force reconstruction",
      ],
    },
    {
      layout: "bullets",
      kicker: "More augmentation motions",
      title: "Where reasoning depth is the product",
      backgroundImage: PITCH_ASSETS.aesthetics.augmentation,
      bullets: [
        "Online course platform integration with LMS-native hooks",
        "Corporate academy depth beyond video completion",
        "Bootcamp & cohort programs with auditable traces",
        "Publisher & content licensing of verification layers",
      ],
    },
    {
      layout: "close",
      kicker: "Next step",
      title: "Augment thinking inside the paths you already ship.",
      backgroundImage: PITCH_ASSETS.aesthetics.close,
      bullets: [
        "Integrate learning augmentation into your edTech stack or prep program",
        "Pilot onboarding, course depth, or certification probes on one cohort",
        "Create a Workspace and drop the first TAP or ILE block into a live lesson",
      ],
      footnote: "uncertain.systems · Learning Augmentation · TAP · ILE · Trace Interruption Model",
    },
  ],
};
