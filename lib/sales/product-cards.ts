import { DEMO_BOOKING_URL } from "@/lib/seo/product-page";

export type SalesTableRow = {
  label: string;
  value: string;
};

export type SalesComparisonRow = {
  without: string;
  with: string;
};

/** Sales index grouping (vertical / product line). */
export type SalesProductLine = "verification" | "optimization" | "augmentation";

export type SalesProductCard = {
  slug: string;
  path: string;
  title: string;
  /** Index section: Verification Products vs Optimization Product. */
  productLine: SalesProductLine;
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
  /**
   * Section heading for the experience flow (defaults to hiring “Candidate experience”).
   * Non-verification products should set a product-context label.
   */
  experienceHeading?: string;
  experience: string[];
  experienceNote?: string;
  /** Defaults to “What the client gets”. */
  deliverablesHeading?: string;
  deliverables: SalesTableRow[];
  deliverablesNote?: string;
  whenToUse: string[];
  comparisonTitle: string;
  comparisonWithoutLabel: string;
  comparisonWithLabel: string;
  comparison: SalesComparisonRow[];
  /** Defaults to “Two ways this product creates value”. */
  valueModesHeading?: string;
  valueModes?: Array<{ title: string; body: string }>;
  /** Defaults to “Suggested placement in the funnel”. */
  funnelHeading?: string;
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
    slug: "self-service-skill-check",
    path: "/sales/self-service-skill-check",
    title: "Self-Service Skill Check",
    productLine: "verification",
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
    comparisonWithLabel: "With Self-Service Skill Check",
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
     → Self-Service Skill Check (~15 min)  ← this product
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
    slug: "self-service-take-home",
    path: "/sales/self-service-take-home",
    title: "Self-Service Take-Home",
    productLine: "verification",
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
        label: "Signals from Self-Service Skill Check",
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
    deliverablesNote: "Same reporting model as Self-Service Skill Check.",
    valueModes: [
      {
        title: "A. Take-homes where they were not viable before",
        body: "For high-volume roles, classic take-homes fail economics: too many submissions, too much senior review time, slow cycle time. Self-Service Take-Home makes a real work sample economically viable because evaluation is structured and report-driven — you can run take-homes on roles that previously skipped them.",
      },
      {
        title: "B. Lower cost on high-profile offers",
        body: "For senior / premium roles, take-homes still burn expensive reviewer hours and calendar lag. Use this product to reduce cost and resources to run and evaluate take-homes without lowering the bar — same ranking + per-person report, less ad-hoc grading.",
      },
    ],
    whenToUse: [
      "After a light screen or Self-Service Skill Check, as a work sample",
      "For roles that should have a take-home but review cost blocked it",
      "For high-profile pipelines where take-home quality matters and reviewer load is painful",
      "Anytime you need depth + consistency across many applicants for the same job position",
    ],
    comparisonTitle: "Why it fits “hire a lot, fast”",
    comparisonWithoutLabel: "Without this product",
    comparisonWithLabel: "With Self-Service Take-Home",
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
    funnel: `Apply → early screen (resume and/or Self-Service Skill Check)
     → HM / tech interview (optional order)
     → Self-Service Take-Home   ← this product
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
  {
    slug: "learning-loop",
    path: "/sales/learning-loop",
    title: "Learning Loop",
    productLine: "optimization",
    eyebrow: "Learning product",
    oneLine:
      "After a class, tutorial video, group project, master class, or reading session — or mid–live stream — drive a customizable-length learning check via link or API so learners validate understanding and you get gap insights plus reteach guidance in near real time, not a quiz score AI can fake.",
    whatItIs:
      "A post-session (and mid-session) learning check for tutors, teachers, course creators, livestream hosts, and L&D. You trigger a private link after or during instruction (live class, livestream, tutorial video, group project, master class, book or article reading, workshop block). Learners open the check for a session of customizable length and work through a think-aloud / process-based flow that validates what they actually understood. Everything can be driven programmatically via API — issue links, collect completions, and pull gap reports — so the same product works for async courses and for livestreaming or live teaching where you need checks in real time. You receive cohort and per-learner reports: remaining knowledge gaps, where reasoning broke, and concrete guidance on how to correct those gaps — without relying on multiple-choice tests, open-book uploads, or project dumps that AI can polish and fake.",
    image: "/gaps.png",
    imageAlt:
      "Strengths and gaps cohort view — shared patterns and knowledge gap map for post-session learning checks",
    imageCaption:
      "Tutor deliverable · gap map + reteach guidance from real work traces, not cheatable test scores",
    specs: [
      { label: "Format", value: "Shareable private learner link and/or API-issued sessions" },
      {
        label: "Duration",
        value: "Customizable length (short pulse check through deeper comprehension block)",
      },
      {
        label: "Mode",
        value:
          "Self-service for learners; async, parallelizable, and programmatically triggerable in real time",
      },
      {
        label: "Core activity",
        value:
          "Process-based validation of understanding (think-aloud dialog and in-session work traces)",
      },
      {
        label: "Who is present",
        value: "Learner only during the check; tutor reviews reports and guidance after (or live via API)",
      },
      {
        label: "Automation",
        value:
          "Fully API-driven: issue checks, track completion, retrieve gap reports — including during livestreams",
      },
      {
        label: "Iterations",
        value: "Repeatable over time on the same cohort or topic to track learning evolution",
      },
    ],
    inputsHeading: "Inputs",
    inputs: [
      {
        label: "Session or content context",
        value:
          "Required. What just happened (or is happening live): class topic, stream segment, video/tutorial outline, project brief, master-class agenda, or reading selection (for reading comprehension).",
      },
      {
        label: "Learning goals / success bar",
        value:
          "Recommended. What “got it” looks like for this session — concepts, skills, or transfer you care about.",
      },
      {
        label: "Check length",
        value:
          "Configurable. Short pulse mid-stream or after a lecture, medium block after a video series, longer after a multi-day project or reading unit.",
      },
      {
        label: "Prior check history (optional)",
        value:
          "Optional. Earlier Learning Loop runs on the same learners or topic so the next report shows movement, not a one-off score.",
      },
    ],
    inputsNote:
      "You can stand up a first check from session notes or a syllabus snippet — or fire checks from your LMS, streaming stack, or bot via API. Length and depth scale from a 10-minute post-video pulse to a richer post-project block, including real-time pulses during a live session.",
    integration: {
      title: "Integration (API) — including livestreams",
      body: "The full product surface can be driven programmatically so checks run without a manual “send link” step:",
      bullets: [
        "Issue and track check links from your LMS, webinar tool, livestream bot, or custom app",
        "Trigger a check mid-stream or at chapter boundaries when the instructional moment happens",
        "Receive completion and gap-report payloads in near real time for live reteach decisions",
        "Automate multi-iteration runs across a unit or ongoing live series",
      ],
      note: "Use hosted links for a fast pilot; use the API when learning is livestreamed or must stay in sync with a live instructional timeline.",
    },
    experienceHeading: "Learner experience",
    experience: [
      "Receive a private link after class, video, project, master class, reading — or mid-livestream via automation.",
      "Open the check for the configured duration — no proctor, no multi-day homework packet.",
      "Work through prompts that surface real understanding: reason out loud, explain, apply, revise.",
      "Complete the session; the product captures process signal, not only a final answer upload.",
    ],
    experienceNote:
      "Designed so every learner can run in parallel after the same instructional moment — lecture hall, cohort Zoom, livestream, async video course, or book club / reading unit — and so hosts can trigger checks programmatically in real time.",
    deliverablesHeading: "What the tutor / host gets",
    deliverables: [
      {
        label: "Cohort gap report",
        value:
          "Where the group still struggles: shared misconceptions, thin spots, and topics that did not stick after the session.",
      },
      {
        label: "Per-learner insight pack",
        value:
          "Individual remaining knowledge gaps plus strengths, grounded in work traces from the check.",
      },
      {
        label: "Reteach / correction guidance",
        value:
          "Actionable guidance for the tutor or teacher on how to close those gaps in the next session, office hours, or follow-up materials.",
      },
      {
        label: "Evolution over iterations",
        value:
          "Run multiple checks over a unit or term and track whether gaps close — without treating a single test score as proof of learning.",
      },
    ],
    deliverablesNote:
      "Signal comes from genuine process and work traces inside the check, not from scores on tests or polished project uploads that AI can fabricate.",
    whenToUse: [
      "Immediately after a live class, workshop, or master class to see what landed",
      "During or right after a livestream / live cohort session — trigger checks programmatically in real time",
      "After a tutorial video or module in an online course — before the next unit unlocks",
      "After a group project milestone to separate team gloss from individual understanding",
      "After a reading or book session when you need real reading comprehension, not a skim-and-quiz pass",
      "Anytime you want multi-iteration tracking of learning evolution without cheatable test banks",
      "When learning ops need API automation (LMS, streaming stack, bots) rather than manual link blasts",
    ],
    comparisonTitle: "Why it beats “check your knowledge” quizzes",
    comparisonWithoutLabel: "Without this product",
    comparisonWithLabel: "With Learning Loop",
    comparison: [
      {
        without: "Multiple-choice or short quiz AI can complete in seconds",
        with: "Process-based check hard to fake with polished final answers",
      },
      {
        without: "Pass rates that hide what the cohort still does not understand",
        with: "Gap map + reteach guidance for the tutor",
      },
      {
        without: "One-shot scores with no learning trajectory",
        with: "Multiple iterations track evolution over time",
      },
      {
        without: "Project uploads or essays that look “done” but were ghostwritten",
        with: "In-session work traces tied to the instructional moment you just taught",
      },
      {
        without: "Customizable length only means shorter/longer tests of the same weak signal",
        with: "Customizable duration with the same process depth model",
      },
      {
        without: "Manual quiz blasts that cannot keep up with a livestream timeline",
        with: "Fully programmatic checks — issue, complete, and report in real time mid-stream",
      },
    ],
    valueModes: [
      {
        title: "A. Pulse after instruction",
        body: "After a class, video, or reading block, send a short customizable-length link while the material is fresh. Validate understanding before the next session and get immediate gap + reteach guidance.",
      },
      {
        title: "B. Multi-iteration unit tracking",
        body: "Repeat the product across a unit, course, or project arc. Compare gap reports over time so you teach to what is still broken — not to vanity completion or test scores AI can fake.",
      },
      {
        title: "C. Livestream / real-time API",
        body: "Drive the entire product from your stack: open checks for viewers mid-livestream or at live session breakpoints, collect process signal in parallel, and pull gap insights while the room (or stream) is still running — not only after the recording ends.",
      },
    ],
    valueModesHeading: "How this product creates value",
    funnelHeading: "Where it sits in the learning flow",
    funnel: `Instructional moment (class / livestream / video / project / master class / reading)
     → Learning Loop (link or API, customizable length)  ← this product
     → Tutor / host gap report + reteach guidance (near real time via API if needed)
     → Next segment, session, materials, or office hours
     → Optional next iteration of the check (track evolution)`,
    funnelNote:
      "Place it as close as practical to the instructional moment — including mid-livestream via API. Iterate weekly, per module, or per live segment when you need a learning trajectory, not a single grade.",
    pilot: [
      "Pick one class, livestream, video module, project milestone, or reading unit.",
      "Define learning goals and a first check length (pulse vs. deeper block).",
      "Send links manually or issue them via API at the live breakpoint.",
      "Review cohort gaps and reteach guidance with the instructor/host; adjust the next segment or session.",
      "Run a second iteration on the same topic or unit and compare gap movement.",
    ],
    successMetrics:
      "completion rate, time-to-gap-insight for the tutor/host (including mid-stream), share of gaps closed on iteration 2+, reduction in re-teaching blind spots, learner trajectory quality vs. prior quiz-only process, API-triggered check latency for live formats.",
    ask: [
      "Pick the instructional format and cohort for a pilot (class, livestream, video, project, or reading).",
      "Book a demo with a real syllabus snippet, stream outline, or session plan — and say if you need API automation.",
    ],
    footer:
      "Uncertain Systems — validate learning after the session or mid-stream; teach the gaps that remain.",
    demoUrl: DEMO_BOOKING_URL,
  },
  {
    slug: "pow-augmented-apps",
    path: "/sales/pow-augmented-apps",
    title: "PoW Augmented Apps",
    productLine: "augmentation",
    eyebrow: "Augmentation product",
    oneLine:
      "Stream proof-of-work data from your product in real time, then use our API to enrich the in-app experience with learning insights — gaps, strengths, achievements, and next-step suggestions that replace static UI tours.",
    whatItIs:
      "PoW Augmented Apps turns your product into a learning-aware surface. You send proof-of-work (tool events, screen/UI traces, agent actions, session activity) in real time as users or agents use your app. Our API returns learning insights you render natively: where understanding breaks (gaps), what is already working (strengths) for positive feedback loops and achievements, and concrete suggestions for what the user (or agent) should do next. Positioned as a living replacement for static, old-school UI tours and checklist onboarding — guidance that updates from real work, not a one-time walkthrough. Especially useful for agentic interfaces, where agents must learn your UI and workflows from live interaction rather than fixed scripted tours.",
    image: "/embeddings.png",
    imageAlt:
      "Knowledge embeddings projection — in-app learning state from real-time proof of work",
    imageCaption:
      "App enrichment · real-time PoW → gaps, strengths, achievements, and next-step suggestions",
    specs: [
      {
        label: "Format",
        value: "Real-time PoW stream into Uncertain Systems + insight API into your app",
      },
      {
        label: "Latency",
        value: "Designed for live session enrichment (stream events; pull or push insights)",
      },
      {
        label: "Mode",
        value: "Headless enrichment — your UX, our learning signal",
      },
      {
        label: "Core activity",
        value:
          "Ingest product/agent proof of work; return gaps, strengths, achievements, and next actions",
      },
      {
        label: "Who experiences it",
        value:
          "End users and agents inside your product; your app owns UI (badges, nudges, tours, coach marks)",
      },
      {
        label: "Integration",
        value: "API-first: emit PoW events and query enrichment payloads per user/session/agent",
      },
    ],
    inputsHeading: "Inputs",
    inputs: [
      {
        label: "Real-time PoW stream",
        value:
          "Required. Tool calls, UI/navigation events, agent steps, screen or session traces, and other observable work as it happens in your app.",
      },
      {
        label: "User / agent identity",
        value:
          "Required. Stable subject id (human user, guest, or agent run) so insights accumulate across a session and over time.",
      },
      {
        label: "Product / workflow context",
        value:
          "Recommended. Feature areas, goals, or “success looks like” for the surfaces you want to augment (onboarding, core workflows, agent tool space).",
      },
      {
        label: "Presentation preferences (optional)",
        value:
          "Optional. Whether you want gap-first coach marks, strength-based achievements, suggestion lists, or all three for a given surface.",
      },
    ],
    inputsNote:
      "You keep full control of UI. Uncertain Systems does not replace your app shell — it supplies learning state derived from the PoW you already produce (or can instrument).",
    integration: {
      title: "Integration (API) — real-time PoW → in-app insights",
      body: "Wire your product to stream PoW and pull enrichment continuously:",
      bullets: [
        "Emit proof-of-work events as users or agents act (tools, UI steps, session segments)",
        "Request learning insights for a subject/session: gaps, strengths, achievements, next-step suggestions",
        "Render those insights as coach marks, achievement toasts, progress, or agent guidance — instead of a static UI tour",
        "Refresh insights as new PoW arrives so the experience stays live during a session",
      ],
      note: "Hosted Uncertain Systems UIs are optional. PoW Augmented Apps is built for embedding learning intelligence into your own product and agent surfaces.",
    },
    experienceHeading: "In-app / agent flow",
    experience: [
      "User or agent works in your product; your client/server streams PoW events as work happens.",
      "Uncertain Systems updates learning state from those traces in near real time.",
      "Your app queries insights and surfaces gaps, strengths/achievements, and suggested next actions in your own UI.",
      "As behavior continues, insights refresh — no static tour to go stale after day one.",
    ],
    experienceNote:
      "Works for human onboarding, continuous in-product learning, and agentic interfaces where agents must learn tools and UI paths from live interaction.",
    deliverablesHeading: "What your product can surface",
    deliverables: [
      {
        label: "Gap signals",
        value:
          "Where understanding or successful use is failing — for targeted in-app help instead of a generic tour step.",
      },
      {
        label: "Strengths & achievements",
        value:
          "What the user or agent already does well — fuel for positive feedback loops, badges, and progress moments inside your product.",
      },
      {
        label: "Next-step suggestions",
        value:
          "Concrete “what else to try” guidance grounded in recent PoW, not a fixed checklist of every feature.",
      },
      {
        label: "Session-live enrichment payload",
        value:
          "API-shaped learning insights you can poll or subscribe to while the session is active.",
      },
    ],
    deliverablesNote:
      "Insights are derived from real work traces you send — designed to be harder to fake than “clicked Next on the tour.”",
    whenToUse: [
      "You want to retire static UI tours and checklist onboarding that users skip or forget",
      "Your product has complex workflows and you need adaptive in-app coaching from real usage",
      "You ship agentic interfaces or tool-using agents that must learn your UI and APIs from live runs",
      "You already (or can) emit product events / tool traces and want learning value on top",
      "You care about positive reinforcement (strengths, achievements) as much as gap remediation",
      "You need continuous enrichment mid-session, not a one-shot post-onboarding quiz",
    ],
    comparisonTitle: "Why it beats static UI tours",
    comparisonWithoutLabel: "Without this product",
    comparisonWithLabel: "With PoW Augmented Apps",
    comparison: [
      {
        without: "Static UI tour that is the same for every user and goes stale",
        with: "Live insights from real-time PoW that adapt as the session unfolds",
      },
      {
        without: "Onboarding only points at features, never measures understanding",
        with: "Gaps and strengths from actual tool/UI work traces",
      },
      {
        without: "No positive feedback when someone already knows a path",
        with: "Strength signals power achievements and reinforcing loops in-app",
      },
      {
        without: "Agents get scripted demos that do not match live tool behavior",
        with: "Agentic interfaces learn from streamed PoW and get next-step suggestions",
      },
      {
        without: "Help content disconnected from what the user just did",
        with: "Suggestions of what else to do, grounded in recent proof of work",
      },
    ],
    valueModes: [
      {
        title: "A. Human product onboarding & continuous help",
        body: "Replace or augment the classic tour with PoW-driven coach marks: celebrate strengths, close gaps, and suggest next actions as people actually use the product.",
      },
      {
        title: "B. Agentic interface learning",
        body: "As agents explore tools and UI, stream their actions as PoW. Return gaps (failed or shallow use), strengths (stable successful patterns), and suggested next tool/UI steps so agents improve mid-run—not only offline evals.",
      },
      {
        title: "C. In-app achievements & engagement loops",
        body: "Use strength surfaces for badges, streaks, and “you’re solid here” moments while still routing weak spots into targeted guidance—learning-positive product design, not guilt-only onboarding.",
      },
    ],
    valueModesHeading: "How this product creates value",
    funnelHeading: "Where it sits in the product loop",
    funnel: `User or agent acts in your app
     → Stream PoW events (real time)  ← this product
     → Insight API (gaps · strengths · achievements · suggestions)
     → Your UI / agent policy updates mid-session
     → More PoW → refreshed insights`,
    funnelNote:
      "No separate “training mode” required. Instrument the real product path; enrichment rides on the same traffic that creates proof of work.",
    pilot: [
      "Pick one high-friction onboarding or agent workflow surface.",
      "Instrument a minimal real-time PoW event set (tools, key UI steps, outcomes).",
      "Wire insight fetch into one in-app channel (coach mark, side panel, or agent prompt inject).",
      "Show gaps + at least one strength/achievement and one next-step suggestion.",
      "Compare completion, time-to-value, and agent success vs. static tour baseline.",
    ],
    successMetrics:
      "tour drop-off, time-to-first-success, insight refresh latency, share of sessions with strength achievements shown, gap-close rate after suggestions, agent task success on instrumented workflows vs. static tour/script baseline.",
    ask: [
      "Pick the host app surface (human onboarding, live product, or agent interface).",
      "Book a demo with a sample PoW event schema from your product or agent stack.",
    ],
    footer:
      "Uncertain Systems — stream proof of work; enrich your app with learning that stays alive.",
    demoUrl: DEMO_BOOKING_URL,
  },
];

export function getSalesProductCard(slug: string): SalesProductCard | undefined {
  return SALES_PRODUCT_CARDS.find((card) => card.slug === slug);
}

/** Resolved section titles for the shared sales product page (hiring defaults). */
export function resolveSalesProductSectionHeadings(card: SalesProductCard): {
  experience: string;
  deliverables: string;
  valueModes: string;
  funnel: string;
} {
  return {
    experience: card.experienceHeading?.trim() || "Candidate experience",
    deliverables: card.deliverablesHeading?.trim() || "What the client gets",
    valueModes: card.valueModesHeading?.trim() || "Two ways this product creates value",
    funnel: card.funnelHeading?.trim() || "Suggested placement in the funnel",
  };
}

export type SalesProductGroup = {
  id: SalesProductLine;
  /** Section heading on the sales index. */
  label: string;
  cards: SalesProductCard[];
};

/** Ordered groups for the sales index product list. */
export function groupSalesProductCards(
  cards: readonly SalesProductCard[] = SALES_PRODUCT_CARDS,
): SalesProductGroup[] {
  const verification = cards.filter((c) => c.productLine === "verification");
  const optimization = cards.filter((c) => c.productLine === "optimization");
  const augmentation = cards.filter((c) => c.productLine === "augmentation");
  const groups: SalesProductGroup[] = [
    {
      id: "verification",
      label: "Verification Products",
      cards: [...verification],
    },
    {
      id: "optimization",
      label: "Optimization Product",
      cards: [...optimization],
    },
    {
      id: "augmentation",
      label: "Augmentation Product",
      cards: [...augmentation],
    },
  ];
  return groups.filter((g) => g.cards.length > 0);
}
