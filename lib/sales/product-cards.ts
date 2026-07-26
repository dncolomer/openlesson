import { DEMO_BOOKING_URL } from "@/lib/seo/product-page";

export type SalesTableRow = {
  label: string;
  value: string;
};

export type SalesComparisonRow = {
  without: string;
  with: string;
};

export type SalesProductCard = {
  slug: string;
  path: string;
  title: string;
  eyebrow: string;
  oneLine: string;
  whatItIs: string;
  /**
   * Optional product visual (public path). Same assets as landing PLATFORM /
   * Verification at Scale sections when relevant.
   */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  specs: SalesTableRow[];
  inputsHeading: string;
  inputs: SalesTableRow[];
  inputsNote?: string;
  integration?: {
    title: string;
    body: string;
    bullets: string[];
    note?: string;
  };
  experience: string[];
  experienceNote?: string;
  deliverables: SalesTableRow[];
  deliverablesNote?: string;
  whenToUse: string[];
  comparisonTitle: string;
  comparisonWithoutLabel: string;
  comparisonWithLabel: string;
  comparison: SalesComparisonRow[];
  valueModes?: Array<{ title: string; body: string }>;
  funnel: string;
  funnelNote?: string;
  pilot: string[];
  successMetrics: string;
  ask: string[];
  footer: string;
  demoUrl: string;
};

export const SALES_PRODUCT_CARDS: SalesProductCard[] = [
  {
    slug: "early-self-service-screening",
    path: "/sales/early-self-service-screening",
    title: "Early Self-Service Screening",
    eyebrow: "Hiring product",
    oneLine:
      "Candidates open a private link, complete a ~15-minute self-service think-aloud evaluation, and the client receives a role ranking plus optional per-candidate strength/weakness reports.",
    whatItIs:
      "An async screening product for high-volume hiring. Each candidate gets a link, goes through a timed self-service evaluation (~15 minutes), and thinks out loud through an interactive dialog (Think Aloud Protocol). No interviewer needs to be on the call.",
    image: "/ranking_app.png",
    imageAlt:
      "Role ranking UI — candidates ordered by latest Snapshot and GHC scores with strengths and gaps detail",
    imageCaption: "Client deliverable · role ranking + per-candidate Snapshot / GHC detail",
    specs: [
      { label: "Format", value: "Private session link" },
      { label: "Duration", value: "~15 minutes, timed" },
      { label: "Mode", value: "Fully self-service and parallelizable" },
      {
        label: "Core activity",
        value: "Think-out-loud problem solving via interactive dialog",
      },
      { label: "Who is present", value: "Candidate only (product-led evaluation)" },
      {
        label: "Integration",
        value: "Standalone links or API for full automation (ATS / recruiting stack)",
      },
    ],
    inputsHeading: "Inputs required",
    inputs: [
      {
        label: "Job description",
        value:
          "Required. Role definition used to scope the exercise and score fit for this position.",
      },
      {
        label: "Company culture / general hiring brief",
        value:
          "Optional. Values, bar for the team, what “good” looks like beyond the JD — improves ranking and strength/weakness framing.",
      },
    ],
    inputsNote:
      "Nothing else is required to stand up a first screening for a role. From those inputs we configure the timed dialog and the scoring bar.",
    integration: {
      title: "Integration (API)",
      body: "This product can also be integrated via API for full automation:",
      bullets: [
        "Issue and track session links from your ATS or recruiting tools",
        "Receive completion and report payloads without manual export",
        "Drive advance / reject / route-to-next-stage workflows programmatically",
      ],
      note: "Use hosted links for a fast pilot; use the API when screening must run hands-off at campaign scale.",
    },
    experience: [
      "Receive a private link (email, ATS, or recruiter message).",
      "Open the exercise and start the timer.",
      "Work through the task while verbalizing reasoning in an interactive dialog.",
      "Complete the session — no multi-day wait, no file-upload black box.",
    ],
    experienceNote:
      "Designed for hundreds of applicants in parallel when you are hiring at scale (e.g. ~50 seats in ~2 months).",
    deliverables: [
      {
        label: "Job-position report",
        value: "Ranking of candidates scored on how well they would perform in the role.",
      },
      {
        label: "Per-candidate breakdown",
        value: "Strengths and weaknesses for each applicant.",
      },
      {
        label: "Optional human use",
        value:
          "Reviewer can skim only edge cases or top-N; or skip deep review and trust rank for first cut.",
      },
      {
        label: "Downstream input",
        value:
          "Same breakdowns feed later stages (interview guides, calibration, take-home design, offer risk).",
      },
    ],
    whenToUse: [
      "Top-of-funnel or first technical / skill screen when volume is high",
      "When senior interview time is the bottleneck",
      "When AI-polished application CV look similar and you need early process signal",
      "Campaigns that must evaluate many people against one consistent bar",
    ],
    comparisonTitle: "Why it fits “hire a lot, fast”",
    comparisonWithoutLabel: "Without this product",
    comparisonWithLabel: "With Early Self-Service Screening",
    comparison: [
      {
        without: "Screeners and engineers bottleneck volume",
        with: "Dozens of evaluations run async in parallel",
      },
      {
        without: "Weak candidates reach expensive interviews",
        with: "Role-ranked shortlist before HM time",
      },
      {
        without: "Every interviewer invents a bar",
        with: "Same exercise and markers for the whole cohort",
      },
      {
        without: "No reusable artifact after screen",
        with: "Strengths/weaknesses pack for later stages",
      },
    ],
    funnel: `Apply → (optional) resume screen
     → Early Self-Service Screening (~15 min)  ← this product
     → HM / tech interview
     → deeper work sample (optional)
     → Offer`,
    pilot: [
      "Pick 1–2 high-volume roles in the hiring plan.",
      "Define the role exercise (scoped skill / job-position workspace).",
      "Send links to the next N applicants at the agreed stage.",
      "Calibrate pass/advance thresholds on the position ranking with hiring managers.",
      "Roll out to the full campaign.",
    ],
    successMetrics:
      "time-to-first-signal, % advanced to live interview, interviewer hours saved, shortlist quality vs. prior process.",
    ask: [
      "Align on roles and stage for screening.",
      "Book a demo with a real job description.",
    ],
    footer: "Uncertain Systems — early skill signal at hiring scale.",
    demoUrl: DEMO_BOOKING_URL,
  },
  {
    slug: "self-service-take-home-assignment",
    path: "/sales/self-service-take-home-assignment",
    title: "Self-service Take-Home Assignment",
    eyebrow: "Hiring product",
    oneLine:
      "Candidates complete an open-ended, multi-block assignment inside the tool (discussion, diagrams, notes, and more); the client gets a role ranking and per-applicant strengths/weaknesses — without the classic take-home cost curve.",
    whatItIs:
      "A self-service take-home where candidates work through multiple blocks in the product — not a single timed chat and not a silent weekend PDF. Work can include interactive discussion, diagrams, written notes, and other real work artifacts produced in-session. Built for depth (assignment / project-style judgment) while remaining structured and scoreable across a full hiring cohort.",
    image: "/knowledgeg2.png",
    imageAlt:
      "Knowledge embeddings projection with role regions and multi-subject trajectories",
    imageCaption:
      "In-product signal · multi-block work projected into knowledge space with role regions",
    specs: [
      { label: "Format", value: "Private assignment journey (multi-block)" },
      { label: "Scope", value: "Open-ended work sample across several blocks" },
      { label: "Mode", value: "Candidate-led, async-friendly" },
      {
        label: "Core activity",
        value: "Real work in-tool: dialog, diagrams, notes, multi-step reasoning",
      },
      {
        label: "Who reviews",
        value: "Product produces rankings and reports; humans review selectively",
      },
    ],
    inputsHeading: "Inputs",
    inputs: [
      {
        label: "Signals from Early Self-Service Screening",
        value:
          "Optional. Rankings and strength/weakness packs from the first product — used to personalize depth, route candidates, or calibrate the take-home bar.",
      },
      {
        label: "Take-home exercise description",
        value:
          "Recommended, but optional. Your brief for the multi-block assignment. If you do not have one, we can design the exercise ourselves from the role (and optional screening signals).",
      },
    ],
    inputsNote:
      "You can start with only a job/role context and let us author the blocks, or bring an existing take-home and we turn it into a structured multi-block journey.",
    experience: [
      "Receive access to the assignment (link / invitation).",
      "Progress through multiple blocks that mirror real role work.",
      "Interact with the environment: discuss, sketch, note, iterate.",
      "Complete the journey with full process visibility — not only a final deliverable.",
    ],
    experienceNote:
      "Unlike a classic take-home, the system captures how the candidate works, not only what they paste at the end.",
    deliverables: [
      {
        label: "Job-position report",
        value: "Ranking of candidates on expected role performance.",
      },
      {
        label: "Per-applicant report",
        value: "Strengths and weaknesses for human review and process design.",
      },
      {
        label: "Comparable cohort",
        value: "Same blocks and markers for every candidate on that role.",
      },
    ],
    deliverablesNote: "Same reporting model as Early Self-Service Screening.",
    valueModes: [
      {
        title: "A. Take-homes where they were not viable before",
        body: "For high-volume roles, classic take-homes fail economics: too many submissions, too much senior review time, slow cycle time. Self-service Take-Home makes a real work sample economically viable because evaluation is structured and report-driven — you can run take-homes on roles that previously skipped them.",
      },
      {
        title: "B. Lower cost on high-profile offers",
        body: "For senior / premium roles, take-homes still burn expensive reviewer hours and calendar lag. Use this product to reduce cost and resources to run and evaluate take-homes without lowering the bar — same ranking + per-person report, less ad-hoc grading.",
      },
    ],
    whenToUse: [
      "After a light screen or Early Self-Service Screening, as a work sample",
      "For roles that should have a take-home but review cost blocked it",
      "For high-profile pipelines where take-home quality matters and reviewer load is painful",
      "Anytime you need depth + consistency across many applicants for the same job position",
    ],
    comparisonTitle: "Why it fits “hire a lot, fast”",
    comparisonWithoutLabel: "Without this product",
    comparisonWithLabel: "With Self-service Take-Home",
    comparison: [
      {
        without: "Take-homes only for a few premium roles",
        with: "Viable work samples at higher volume",
      },
      {
        without: "Multi-day lag and uneven grading",
        with: "Structured multi-block journey + role ranking",
      },
      {
        without: "AI-polished PDFs with no process",
        with: "In-tool work + interactive signal",
      },
      {
        without: "Senior engineers grade every packet",
        with: "Reports first; humans on exceptions and finals",
      },
    ],
    funnel: `Apply → early screen (resume and/or Early Self-Service Screening)
     → HM / tech interview (optional order)
     → Self-service Take-Home Assignment   ← this product
     → Offer`,
    funnelNote:
      "Can also run before final interview when you want a ranked shortlist of deep work samples first.",
    pilot: [
      "Pick one volume role (viability case) and/or one high-profile role (cost-reduction case).",
      "Author a multi-block assignment mapped to the job.",
      "Run on finalists or on a defined slice of the funnel.",
      "Calibrate ranking vs. hiring-manager judgment.",
      "Expand blocks to sibling roles in the same campaign.",
    ],
    successMetrics:
      "take-home completion time, reviewer hours per candidate, consistency of rankings, offer quality after 30–60 days.",
    ask: [
      "Decide whether the pilot is volume enablement, premium cost reduction, or both.",
      "Book a demo with a real job description.",
    ],
    footer: "Uncertain Systems — work samples that scale without scaling review chaos.",
    demoUrl: DEMO_BOOKING_URL,
  },
];

export function getSalesProductCard(slug: string): SalesProductCard | undefined {
  return SALES_PRODUCT_CARDS.find((card) => card.slug === slug);
}
