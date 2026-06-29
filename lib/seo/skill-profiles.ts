export type SkillProfileGap = {
  skill: string;
  severity: "High" | "Medium" | "Low";
  detail: string;
};

export type SkillProfileAction = {
  step: string;
  status: "Done" | "Open" | "Scheduled";
  ileHref?: string;
};

export type SkillProfile = {
  id: string;
  category: string;
  title: string;
  markers: { label: string; score: number }[];
  gaps: SkillProfileGap[];
  actions: SkillProfileAction[];
};

export const SKILL_PROFILES: SkillProfile[] = [
  {
    id: "quantum-computing",
    category: "Physics",
    title: "Quantum computing fundamentals",
    markers: [
      { label: "Qubit concepts", score: 77 },
      { label: "Entanglement", score: 62 },
      { label: "Error correction", score: 35 },
      { label: "Algorithm design", score: 51 },
      { label: "Hardware limits", score: 44 },
    ],
    gaps: [
      {
        skill: "Error correction",
        severity: "High",
        detail: "Can name surface-level codes but cannot explain why fault tolerance thresholds matter.",
      },
      {
        skill: "Hardware limits",
        severity: "Medium",
        detail: "Treats gate fidelity as abstract; skips decoherence impact on algorithm choice.",
      },
    ],
    actions: [
      { step: "Think-Aloud problem-set review", status: "Done" },
      { step: "Practice error-correction proofs in ILE", status: "Open", ileHref: "/ile/blocks/quantum-error-correction" },
      { step: "Submit lab notebook to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "ai-engineering",
    category: "Computer Science",
    title: "AI engineering systems",
    markers: [
      { label: "Model selection", score: 69 },
      { label: "Eval design", score: 42 },
      { label: "Data pipelines", score: 74 },
      { label: "Failure modes", score: 37 },
      { label: "Deployment judgment", score: 58 },
    ],
    gaps: [
      {
        skill: "Failure modes",
        severity: "High",
        detail: "Strong on happy-path demos; cannot articulate drift, hallucination, or safety failure chains.",
      },
      {
        skill: "Eval design",
        severity: "Medium",
        detail: "Relies on benchmark scores without explaining what each metric actually validates.",
      },
    ],
    actions: [
      { step: "Evidence API scoring of project artifacts", status: "Done" },
      { step: "Build eval harness exercise in ILE", status: "Open", ileHref: "/ile/blocks/eval-design" },
      { step: "Think-Aloud architecture defense", status: "Scheduled" },
    ],
  },
  {
    id: "machine-learning-theory",
    category: "Computer Science",
    title: "Machine learning theory",
    markers: [
      { label: "Bias-variance", score: 73 },
      { label: "Optimization", score: 48 },
      { label: "Generalization", score: 41 },
      { label: "Loss functions", score: 68 },
      { label: "Regularization", score: 55 },
    ],
    gaps: [
      {
        skill: "Generalization",
        severity: "High",
        detail: "Recites PAC bounds but cannot connect assumptions to when a model will fail on new data.",
      },
      {
        skill: "Optimization",
        severity: "Medium",
        detail: "Treats gradient descent as a black box; skips saddle points and learning-rate tradeoffs.",
      },
    ],
    actions: [
      { step: "Think-Aloud derivation walkthrough", status: "Done" },
      { step: "Practice generalization proofs in ILE", status: "Open", ileHref: "/ile/blocks/ml-generalization" },
      { step: "Submit problem set to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "linear-algebra",
    category: "Mathematics",
    title: "Linear algebra",
    markers: [
      { label: "Matrix operations", score: 81 },
      { label: "Eigenvalues", score: 52 },
      { label: "Vector spaces", score: 64 },
      { label: "Decompositions", score: 39 },
      { label: "Geometric intuition", score: 47 },
    ],
    gaps: [
      {
        skill: "Decompositions",
        severity: "High",
        detail: "Can compute SVD mechanically but cannot explain what singular values represent geometrically.",
      },
      {
        skill: "Geometric intuition",
        severity: "Medium",
        detail: "Jumps to formulas when asked why a transformation preserves or distorts structure.",
      },
    ],
    actions: [
      { step: "Think-Aloud proof review", status: "Done" },
      { step: "Visualize transformations in ILE", status: "Open", ileHref: "/ile/blocks/eigen-decomposition" },
      { step: "Upload worked examples to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "organic-chemistry",
    category: "Chemistry",
    title: "Organic chemistry mechanisms",
    markers: [
      { label: "Functional groups", score: 78 },
      { label: "Reaction arrows", score: 56 },
      { label: "Stereochemistry", score: 43 },
      { label: "Mechanism steps", score: 38 },
      { label: "Synthesis planning", score: 61 },
    ],
    gaps: [
      {
        skill: "Mechanism steps",
        severity: "High",
        detail: "Draws correct products but cannot justify electron movement intermediate-by-intermediate.",
      },
      {
        skill: "Stereochemistry",
        severity: "Medium",
        detail: "Confuses enantiomer outcomes when reaction conditions change under probe.",
      },
    ],
    actions: [
      { step: "Think-Aloud mechanism explanation", status: "Done" },
      { step: "Practice curved-arrow drills in ILE", status: "Open", ileHref: "/ile/blocks/mechanism-steps" },
      { step: "Submit lab report to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "statistical-inference",
    category: "Statistics",
    title: "Statistical inference",
    markers: [
      { label: "Distributions", score: 75 },
      { label: "Hypothesis tests", score: 58 },
      { label: "Confidence intervals", score: 44 },
      { label: "Causal claims", score: 36 },
      { label: "Experimental design", score: 52 },
    ],
    gaps: [
      {
        skill: "Causal claims",
        severity: "High",
        detail: "Treats correlation as causation; cannot state identifying assumptions for an estimand.",
      },
      {
        skill: "Confidence intervals",
        severity: "Medium",
        detail: "Misinterprets interval width as probability about a single parameter value.",
      },
    ],
    actions: [
      { step: "Think-Aloud interpretation review", status: "Done" },
      { step: "Practice causal diagrams in ILE", status: "Open", ileHref: "/ile/blocks/causal-inference" },
      { step: "Submit analysis notebook to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "molecular-biology",
    category: "Biology",
    title: "Molecular biology",
    markers: [
      { label: "Central dogma", score: 80 },
      { label: "Gene regulation", score: 49 },
      { label: "PCR & sequencing", score: 67 },
      { label: "Pathway logic", score: 40 },
      { label: "Experimental design", score: 54 },
    ],
    gaps: [
      {
        skill: "Pathway logic",
        severity: "High",
        detail: "Labels pathway components but cannot predict downstream effects when one node is knocked out.",
      },
      {
        skill: "Gene regulation",
        severity: "Medium",
        detail: "Skips mechanistic link between transcription factors and observable expression changes.",
      },
    ],
    actions: [
      { step: "Think-Aloud pathway walkthrough", status: "Done" },
      { step: "Simulate knockout experiments in ILE", status: "Open", ileHref: "/ile/blocks/gene-regulation" },
      { step: "Upload protocol notes to Evidence API", status: "Scheduled" },
    ],
  },
  {
    id: "algorithms",
    category: "Computer Science",
    title: "Algorithms & data structures",
    markers: [
      { label: "Complexity analysis", score: 72 },
      { label: "Recurrence relations", score: 45 },
      { label: "Graph algorithms", score: 58 },
      { label: "Correctness proofs", score: 34 },
      { label: "Tradeoff selection", score: 51 },
    ],
    gaps: [
      {
        skill: "Correctness proofs",
        severity: "High",
        detail: "Implements solutions that pass tests but cannot prove loop invariants hold.",
      },
      {
        skill: "Recurrence relations",
        severity: "Medium",
        detail: "Writes Big-O from pattern matching without deriving the recurrence under probe.",
      },
    ],
    actions: [
      { step: "Think-Aloud solution defense", status: "Done" },
      { step: "Practice invariant proofs in ILE", status: "Open", ileHref: "/ile/blocks/correctness-proofs" },
      { step: "Submit code artifacts to Evidence API", status: "Scheduled" },
    ],
  },
];