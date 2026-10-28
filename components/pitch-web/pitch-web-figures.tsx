import {
  PitchWebCornerTicks,
  PitchWebHudBox,
} from "@/components/pitch-web/pitch-web-chrome";

const CYAN = "#6ec8e8";
const MUTED = "#9eb8c4";

function HudFrame({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border border-white/55 bg-[#071820]">
      <PitchWebCornerTicks color={CYAN} />
      {title ? (
        <p className="relative z-[1] shrink-0 pt-4 text-center font-mono text-[15px] font-medium uppercase tracking-[2.2px] text-[#6ec8e8]">
          {title}
        </p>
      ) : null}
      <svg
        viewBox="0 0 720 430"
        className="relative z-[1] min-h-0 w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {children}
      </svg>
    </div>
  );
}

export function PitchWebDepthChart() {
  return (
    <HudFrame title="FIELD DEPTH VS PEOPLE WHO CAN TEACH IT">
      <text x="46" y="78" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.6">
        DEPTH
      </text>
      <path d="M 70 90 L 70 340 L 640 340" fill="none" stroke={CYAN} strokeWidth="1.4" />
      <path d="M 70 90 L 64 102 M 70 90 L 76 102" fill="none" stroke={CYAN} strokeWidth="1.4" />
      <path d="M 640 340 L 628 334 M 640 340 L 628 346" fill="none" stroke={CYAN} strokeWidth="1.4" />
      <text x="648" y="358" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.8">
        TIME
      </text>

      <text x="92" y="108" fill={MUTED} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.4">
        FIELD KNOWLEDGE (ILLUSTRATIVE)
      </text>
      <path d="M 92 124 L 124 124" stroke={CYAN} strokeWidth="2" />
      <text x="134" y="128" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        THERMODYNAMIC COMPUTING
      </text>
      <path d="M 92 146 L 124 146" stroke={CYAN} strokeWidth="1.8" strokeDasharray="7 5" />
      <text x="134" y="150" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        QUANTUM COMPUTING
      </text>
      <path d="M 92 168 L 124 168" stroke={CYAN} strokeWidth="1.8" strokeDasharray="2 4" />
      <text x="134" y="172" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        MATHEMATICS
      </text>

      <path
        d="M 78 318 C 220 314 380 250 620 72"
        fill="none"
        stroke={CYAN}
        strokeWidth="2.2"
      />
      <path
        d="M 78 312 C 240 304 400 230 620 118"
        fill="none"
        stroke={CYAN}
        strokeWidth="1.8"
        strokeDasharray="8 6"
      />
      <path
        d="M 78 308 C 250 300 430 250 620 188"
        fill="none"
        stroke={CYAN}
        strokeWidth="1.8"
        strokeDasharray="2 5"
      />
      <path
        d="M 78 292 C 280 286 480 278 620 268"
        fill="none"
        stroke={CYAN}
        strokeWidth="1.6"
        strokeDasharray="9 6"
      />

      <path d="M 628 78 L 646 78 L 646 268 L 628 268" fill="none" stroke={CYAN} strokeWidth="1.3" />
      <text x="656" y="180" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.8">
        GAP
      </text>
      <text
        x="430"
        y="286"
        fill={CYAN}
        fontSize="13"
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing="1.2"
      >
        EXPERTS WHO CAN TEACH
      </text>
      <text
        x="360"
        y="392"
        textAnchor="middle"
        fill={CYAN}
        fontSize="14"
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing="1.8"
      >
        THE GAP GROWS EVERY YEAR.
      </text>
    </HudFrame>
  );
}

function PointList({
  items,
}: {
  items: Array<{ n: string; text: string }>;
}) {
  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <li key={item.n} className="flex gap-3 text-[17px] leading-snug text-zinc-200">
          <span className="w-6 shrink-0 font-mono text-[15px] text-[#6ec8e8]">{item.n}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function PitchWebGpsVsAutopilot() {
  return (
    <PitchWebHudBox title="GPS VS AUTOPILOT">
      <div className="grid h-full grid-cols-2">
        <div className="flex flex-col justify-center pr-10">
          <div className="flex items-start gap-4">
            <svg viewBox="0 0 72 72" className="mt-1 h-16 w-16 shrink-0" aria-hidden>
              <circle cx="18" cy="54" r="10" fill="none" stroke={CYAN} strokeWidth="2.2" />
              <path d="M18 44 V18 H58" fill="none" stroke={CYAN} strokeWidth="2.2" />
              <path d="M50 12 L60 18 L50 24" fill="none" stroke={CYAN} strokeWidth="2.2" />
            </svg>
            <div>
              <p className="font-mono text-[15px] uppercase tracking-[1.6px] text-[#6ec8e8]">
                GPS // AI tutors
              </p>
              <div className="mt-3">
                <PointList
                  items={[
                    { n: "01", text: "Tailored routes to where you want to go" },
                    { n: "02", text: "Guidance throughout the journey" },
                    { n: "03", text: "You still do the driving" },
                  ]}
                />
              </div>
            </div>
          </div>
          <p className="mt-8 text-[15px] leading-snug text-zinc-400">
            <span className="font-mono uppercase tracking-[1.2px] text-[#6ec8e8]">Example // </span>
            LLM chat tutors that explain, quiz and answer on demand: helpful, but not ideal.
          </p>
        </div>
        <div className="flex flex-col justify-center border-l border-[#6ec8e8]/60 pl-10">
          <p className="font-mono text-[15px] uppercase tracking-[1.6px] text-[#6ec8e8]">
            Autopilot // what we build
          </p>
          <div className="mt-3">
            <PointList
              items={[
                { n: "01", text: "Make learning markers like attention, more energy efficient" },
                { n: "02", text: "Neuroscience: think-aloud and brain-priming protocols" },
                { n: "03", text: "Plasticity + knowledge induction" },
              ]}
            />
          </div>
          <p className="mt-8 text-[15px] leading-snug text-zinc-400">
            <span className="font-mono uppercase tracking-[1.2px] text-[#6ec8e8]">
              The difference //{" "}
            </span>
            Not more answers: protocols and mechanisms that change how you learn.
          </p>
        </div>
      </div>
    </PitchWebHudBox>
  );
}

function StateDot({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#071820" stroke={CYAN} strokeWidth="1.8" />;
}

export function PitchWebHiddenStateMap() {
  const root = { x: 360, y: 214 };
  const accumulation = { x: 360, y: 132 };
  const signed = { x: 286, y: 86 };
  const net = { x: 412, y: 86 };
  const anti = { x: 488, y: 64 };
  const indefinite = { x: 214, y: 258 };
  const definite = { x: 268, y: 292 };
  const differential = { x: 148, y: 292 };
  const limits = { x: 248, y: 348 };
  const riemann = { x: 456, y: 268 };
  const substitution = { x: 560, y: 246 };
  const parts = { x: 568, y: 292 };
  const fractions = { x: 548, y: 336 };

  return (
    <HudFrame title="HIDDEN-STATE MAP // EXAMPLE: INTEGRALS">
      <line x1={root.x} y1={root.y} x2={accumulation.x} y2={accumulation.y} stroke={CYAN} strokeWidth="2.4" />
      <line x1={accumulation.x} y1={accumulation.y} x2={signed.x} y2={signed.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={accumulation.x} y1={accumulation.y} x2={net.x} y2={net.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={net.x} y1={net.y} x2={anti.x} y2={anti.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={root.x} y1={root.y} x2={indefinite.x} y2={indefinite.y} stroke={CYAN} strokeWidth="1.6" />
      <line x1={indefinite.x} y1={indefinite.y} x2={definite.x} y2={definite.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={indefinite.x} y1={indefinite.y} x2={differential.x} y2={differential.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={definite.x} y1={definite.y} x2={limits.x} y2={limits.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={root.x} y1={root.y} x2={riemann.x} y2={riemann.y} stroke={CYAN} strokeWidth="1.6" />
      <line x1={riemann.x} y1={riemann.y} x2={substitution.x} y2={substitution.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={riemann.x} y1={riemann.y} x2={parts.x} y2={parts.y} stroke={CYAN} strokeWidth="1.5" />
      <line x1={riemann.x} y1={riemann.y} x2={fractions.x} y2={fractions.y} stroke={CYAN} strokeWidth="1.5" />

      <StateDot {...anti} />
      <StateDot {...signed} />
      <StateDot {...net} />
      <StateDot {...accumulation} />
      <circle cx={root.x} cy={root.y} r="16" fill="none" stroke={CYAN} strokeWidth="1.6" />
      <circle cx={root.x} cy={root.y} r="9" fill="none" stroke={CYAN} strokeWidth="1.6" />
      <StateDot {...indefinite} />
      <StateDot {...definite} />
      <StateDot {...differential} />
      <StateDot {...limits} />
      <StateDot {...riemann} />
      <StateDot {...substitution} />
      <StateDot {...parts} />
      <StateDot {...fractions} />

      <text x="286" y="64" fill={MUTED} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.6">
        // MEANING
      </text>
      <text x="88" y="232" fill={MUTED} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.6">
        // SETUP
      </text>
      <text x="590" y="214" fill={MUTED} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.6">
        // TECHNIQUE
      </text>

      <text x="504" y="68" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        ANTIDERIVATIVE
      </text>
      <text x="178" y="90" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        SIGNED AREA
      </text>
      <text x="424" y="90" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        NET CHANGE
      </text>
      <text x="378" y="128" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        ACCUMULATION
      </text>
      <text x="318" y="168" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace">
        0.3 POLICY
      </text>
      <text x="292" y="198" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace">
        1.3
      </text>
      <text x="392" y="218" fill="#dce7ee" fontSize="14" fontFamily="ui-monospace, Menlo, monospace">
        INTEGRALS
      </text>
      <text x="400" y="250" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace">
        0.8
      </text>
      <text x="148" y="246" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        INDEFINITE
      </text>
      <text x="284" y="288" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        DEFINITE
      </text>
      <text x="58" y="296" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        DIFFERENTIAL
      </text>
      <text x="262" y="368" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        LIMITS
      </text>
      <text x="392" y="292" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        RIEMANN SUM
      </text>
      <text x="580" y="250" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        SUBSTITUTION
      </text>
      <text x="586" y="296" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        BY PARTS
      </text>
      <text x="568" y="352" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        FRACTIONS
      </text>
      <text
        x="360"
        y="404"
        textAnchor="middle"
        fill={CYAN}
        fontSize="13"
        fontFamily="ui-monospace, Menlo, monospace"
        letterSpacing="1.4"
      >
        CHEAPEST EDGE = THE POLICY. LEARN SHOWS COSTS, VERIFY HIDES THEM.
      </text>
    </HudFrame>
  );
}

function EngineArrow() {
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-10 shrink-0 text-[#6ec8e8]" aria-hidden>
      <path d="M0 8 H38" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M30 2 L40 8 L30 14" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function PitchWebEngineFlow() {
  const nodes = [
    { shape: "circle" as const, lines: ["Field", "experts"], cap: "01 Proof-of-work traces" },
    { shape: "circle" as const, lines: ["Knowledge", "embedding", "space"], cap: "02 Hashed, privacy-native" },
    { shape: "circle" as const, lines: ["Software", "+ hardware"], cap: "03 Uses the space" },
    { shape: "rect" as const, lines: ["Learning on autopilot", "Minimal energy", "expenditure"], cap: "04 The Neo Chair" },
  ];
  return (
    <PitchWebHudBox>
      <div className="flex h-full items-center justify-between gap-3 px-4">
        {nodes.map((node, i) => (
          <div key={node.cap} className="flex flex-1 items-center justify-center gap-3">
            {i > 0 ? <EngineArrow /> : null}
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div
                className={
                  node.shape === "rect"
                    ? "flex h-36 w-44 flex-col items-center justify-center border border-[#6ec8e8] px-3 text-center"
                    : "flex h-36 w-36 flex-col items-center justify-center rounded-full border border-[#6ec8e8] px-3 text-center"
                }
              >
                {node.lines.map((line) => (
                  <p key={line} className="font-mono text-[13px] uppercase leading-tight tracking-[1.2px] text-zinc-100">
                    {line}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-center font-mono text-[12px] uppercase tracking-[1.2px] text-[#6ec8e8]">
                {node.cap}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PitchWebHudBox>
  );
}

export function PitchWebRegionMap() {
  return (
    <HudFrame title="KNOWLEDGE REGION // 2D PROJECTION (ILLUSTRATIVE)">
      <path
        d="M 210 210 C 190 150 250 118 330 128 C 400 136 430 168 428 214 C 426 262 380 300 310 302 C 240 304 226 258 210 210 Z"
        fill="rgba(110,200,232,0.16)"
        stroke={CYAN}
        strokeWidth="1.8"
      />
      {[
        [250, 188],
        [278, 160],
        [312, 152],
        [348, 168],
        [366, 198],
        [350, 236],
        [312, 254],
        [272, 240],
        [258, 214],
        [300, 200],
        [328, 214],
        [290, 180],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={CYAN} />
      ))}
      <circle cx="318" cy="208" r="8" fill="none" stroke={CYAN} strokeWidth="2" />
      <circle cx="318" cy="208" r="2.4" fill={CYAN} />
      <text x="148" y="168" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.3">
        YOUR KNOWLEDGE REGION
      </text>

      <circle cx="548" cy="118" r="8" fill="none" stroke={CYAN} strokeWidth="1.7" />
      <text x="564" y="122" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        CANDIDATE C
      </text>
      <path d="M 324 204 L 542 118" stroke={CYAN} strokeWidth="1.3" strokeDasharray="4 5" />
      <text x="430" y="142" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        d = 0.83
      </text>

      <circle cx="548" cy="208" r="11" fill="none" stroke={CYAN} strokeWidth="2.2" />
      <circle cx="548" cy="208" r="5" fill={CYAN} />
      <text x="568" y="212" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        CANDIDATE A
      </text>
      <path d="M 328 208 L 536 208" stroke={CYAN} strokeWidth="1.3" strokeDasharray="6 5" />
      <text x="430" y="198" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        d = 0.21
      </text>

      <circle cx="548" cy="292" r="8" fill="none" stroke={CYAN} strokeWidth="1.7" />
      <text x="564" y="296" fill="#dce7ee" fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        CANDIDATE B
      </text>
      <path d="M 326 214 L 542 292" stroke={CYAN} strokeWidth="1.3" strokeDasharray="4 5" />
      <text x="430" y="268" fill={CYAN} fontSize="13" fontFamily="ui-monospace, Menlo, monospace">
        d = 0.48
      </text>

      <circle cx="90" cy="396" r="5" fill={CYAN} />
      <text x="102" y="400" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.1">
        VALIDATED EXPERT KNOWLEDGE
      </text>
      <circle cx="340" cy="396" r="6" fill="none" stroke={CYAN} strokeWidth="1.5" />
      <text x="352" y="400" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.1">
        CANDIDATES
      </text>
      <circle cx="500" cy="396" r="7" fill="none" stroke={CYAN} strokeWidth="1.7" />
      <text x="514" y="400" fill={CYAN} fontSize="12" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1.1">
        REGION CENTRE
      </text>
    </HudFrame>
  );
}

export function PitchWebGtmTimeline() {
  const stages = [
    {
      when: "Now // Stage 1",
      title: "Data & software",
      body: "Thermodynamic computing first, then quantum + others -> knowledge-embeddings model. Scales fast via our verification tools in hiring + education.",
      mark: "now",
    },
    {
      when: "2027 // Stage 1",
      title: "Neuroscientific protocols",
      body: "Alongside the software, e.g. think-aloud and brain-priming protocols.",
      mark: "now",
    },
    {
      when: "Later // Stage 2",
      title: "Beyond software",
      body: "2028+: non-invasive BCI + drug tech move fast. First in Europe: a home kit for brain plasticity.",
      mark: "later",
    },
  ] as const;
  return (
    <PitchWebHudBox title="Data & software -> neuro protocols ... -> beyond software  //  value delivered at every stage">
      <div className="relative mt-6 grid grid-cols-3 gap-6">
        <div className="pointer-events-none absolute left-[10%] right-[10%] top-[42px] flex">
          <span className="h-px flex-[1.7] bg-[#6ec8e8]" />
          <span className="h-px flex-1 border-t border-dashed border-[#6ec8e8]" />
        </div>
        {stages.map((stage) => (
          <div key={stage.title} className="relative flex flex-col items-center px-3 text-center">
            <p className="font-mono text-[13px] uppercase tracking-[1.4px] text-[#6ec8e8]">{stage.when}</p>
            <span
              className={
                stage.mark === "later"
                  ? "mt-3 h-8 w-8 rounded-full border border-dashed border-[#6ec8e8] bg-[#071820]"
                  : "mt-3 h-8 w-8 rounded-full border-2 border-[#6ec8e8] bg-[#071820]"
              }
            />
            <p className="mt-4 font-mono text-[15px] uppercase tracking-[1.3px] text-zinc-100">{stage.title}</p>
            <p className="mt-2 text-[15px] leading-snug text-zinc-400">{stage.body}</p>
          </div>
        ))}
      </div>
    </PitchWebHudBox>
  );
}

