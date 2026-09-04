/**
 * Official map-type library (global catalog).
 * Core types (the frozen eight in `initial-chapters`) are pre-selected on
 * new workspaces. Extra pedagogical types are browseable and opt-in.
 */

import {
  INITIAL_CHAPTERS_CATALOG,
  INITIAL_CHAPTERS_LEVELS,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";

export type MapTypeLibraryCategory =
  | "core"
  | "curriculum_depth"
  | "elaboration"
  | "strands"
  | "progressions"
  | "flexibility"
  | "orientation"
  | "discrimination"
  | "whole_task"
  | "community";

export type MapTypeLibraryStrength =
  | "deepening"
  | "orientation"
  | "prerequisites"
  | "transfer"
  | "discrimination"
  | "performance"
  | "working_memory"
  | "custom";

export type MapTypeLibraryCell = { row: number; col: number };

export type MapTypeLibraryEntry = {
  id: string;
  label: string;
  description: string;
  category: MapTypeLibraryCategory;
  categoryLabel: string;
  strength: MapTypeLibraryStrength;
  strengthLabel: string;
  playRule: string;
  literature: string;
  useWhen: string;
  layoutInstruction: string;
  occupied: MapTypeLibraryCell[];
  blocked: MapTypeLibraryCell[];
  /** Core types start selected; extras are opt-in. */
  defaultImported: boolean;
  authorUsername: string | null;
  titleKey?: string;
  descKey?: string;
  topologyMode?: "shaped" | "scatter";
  band?: { min: number; max: number; target: number; audience: string };
};

function ring(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
): MapTypeLibraryCell[] {
  const out: MapTypeLibraryCell[] = [];
  for (let c = c0; c <= c1; c += 1) {
    out.push({ row: r0, col: c }, { row: r1, col: c });
  }
  for (let r = r0 + 1; r < r1; r += 1) {
    out.push({ row: r, col: c0 }, { row: r, col: c1 });
  }
  return out;
}

function colBand(col: number, rows: number[]): MapTypeLibraryCell[] {
  return rows.map((row) => ({ row, col }));
}

function rowBand(row: number, cols: number[]): MapTypeLibraryCell[] {
  return cols.map((col) => ({ row, col }));
}

const ALL_ROWS = [0, 1, 2, 3, 4, 5, 6];
const ALL_COLS = [0, 1, 2, 3, 4, 5, 6];

const CORE_STRENGTH: Record<
  InitialChaptersLevel,
  { strength: MapTypeLibraryStrength; strengthLabel: string }
> = {
  islands: { strength: "working_memory", strengthLabel: "Working memory" },
  spiral: { strength: "deepening", strengthLabel: "Deepening" },
  ladder: { strength: "prerequisites", strengthLabel: "Prerequisites" },
  hub: { strength: "orientation", strengthLabel: "Orientation" },
  tracks: { strength: "discrimination", strengthLabel: "Discrimination" },
  ring: { strength: "deepening", strengthLabel: "Deepening" },
  random_sparse: { strength: "working_memory", strengthLabel: "Working memory" },
  random_dense: { strength: "working_memory", strengthLabel: "Working memory" },
};

/** Frozen eight — pre-selected on every new workspace. */
export const MAP_TYPE_LIBRARY_CORE: readonly MapTypeLibraryEntry[] =
  INITIAL_CHAPTERS_CATALOG.map((option) => {
    const meta = CORE_STRENGTH[option.id];
    return {
      id: option.id,
      label: option.label,
      description: option.description,
      category: "core" as const,
      categoryLabel: "Core",
      strength: meta.strength,
      strengthLabel: meta.strengthLabel,
      playRule: option.description,
      literature: "OpenLesson core map type.",
      useWhen: option.audience,
      layoutInstruction: option.layoutInstruction,
      occupied: option.occupied.map((c) => ({ row: c.row, col: c.col })),
      blocked: option.blocked.map((c) => ({ row: c.row, col: c.col })),
      defaultImported: true,
      authorUsername: null,
      titleKey: option.titleKey,
      descKey: option.descKey,
      topologyMode: option.kind === "random" ? "scatter" : "shaped",
      band: {
        min: option.band.min,
        max: option.band.max,
        target: option.band.target,
        audience: option.band.audience,
      },
    };
  });

/** Extra official types — in the global library, not default-imported. */
export const MAP_TYPE_LIBRARY_EXTRAS: readonly MapTypeLibraryEntry[] = [
  {
    id: "spiral_curriculum",
    label: "Spiral (Bruner)",
    description:
      "Revisit the same regions at rising sophistication. Each return adds a conceptual advance, not a repeat.",
    category: "curriculum_depth",
    categoryLabel: "Curriculum depth",
    strength: "deepening",
    strengthLabel: "Deepening",
    playRule:
      "Revisit the same regions at rising sophistication. Each return must add a conceptual advance, not a repeat. Outer ring = first encounter; inner rings = more formal / connected versions of the same ideas. Corridors between rings stay blocked until the current turn of the spiral is done.",
    literature:
      "Bruner's spiral curriculum (1960): cyclical return, increasing depth, use of prior knowledge.",
    useWhen:
      "A small set of core ideas must deepen across a whole course (math structures, physical principles, a programming model). Weak when topics are truly one-shot.",
    layoutInstruction:
      'LAYOUT PATTERN "Spiral curriculum": Place a first-encounter OUTER RING of related chapters, then a more formal INNER RING of the same ideas. Leave blocked corridors between rings. Do not treat inner-ring tiles as repeats — each return must raise sophistication. Foundation sits on the outer ring, not at a far-off origin.',
    occupied: [...ring(0, 0, 6, 6), ...ring(2, 2, 4, 4), { row: 3, col: 3 }],
    blocked: ring(1, 1, 5, 5),
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "epitome_zoom",
    label: "Epitome / Zoom",
    description:
      "Show the whole in simplified form first. Zoom into one region, then zoom back out and re-embed before the next.",
    category: "elaboration",
    categoryLabel: "Elaboration",
    strength: "orientation",
    strengthLabel: "Orientation",
    playRule:
      "Center tiles are the epitome (simplest complete version of the domain). Zoom into one region, then use dedicated zoom-out tiles to resynthesize back to the epitome before zooming into the next. Keep a crude map of the whole visible — do not hide the other regions.",
    literature:
      "Reigeluth's elaboration theory — the zoom-lens analogy: wide-angle first, zoom in one level, zoom out to resynthesize.",
    useWhen:
      "Learners need a stable skeleton before parts make sense (economics supply and demand before cases; a system architecture before modules). Weak for complete novices who cannot parse even a simplified whole.",
    layoutInstruction:
      'LAYOUT PATTERN "Epitome / Zoom": Place a compact CENTER EPITOME of the whole domain in simplified form. Place DETAIL clusters in the quadrants. Place ZOOM-OUT tiles on the mid-edge spokes that force synthesis back to the epitome before the next zoom. Do not hide other regions — the crude whole stays visible. Opposite of Islands.',
    occupied: [
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
      { row: 1, col: 3 },
      { row: 3, col: 1 },
      { row: 3, col: 5 },
      { row: 5, col: 3 },
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 6 },
      { row: 5, col: 0 },
      { row: 6, col: 0 },
      { row: 6, col: 1 },
      { row: 5, col: 6 },
      { row: 6, col: 5 },
      { row: 6, col: 6 },
    ],
    blocked: [
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
      { row: 0, col: 3 },
      { row: 3, col: 0 },
      { row: 3, col: 6 },
      { row: 6, col: 3 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "strands",
    label: "Strands",
    description:
      "Several ideas grow in parallel. Get a foothold on each strand before forcing cross-links.",
    category: "strands",
    categoryLabel: "Parallel themes",
    strength: "deepening",
    strengthLabel: "Deepening",
    playRule:
      "Vertical (or diagonal) bands, one per theme. Tiles thicken as the idea becomes more sophisticated. Occasional cross-strand corridors; most inter-strand cells start blocked.",
    literature:
      "AAAS Project 2061 Atlas of Science Literacy conceptual strand maps — K–12 ideas laid as developing strands with explicit cross-connections.",
    useWhen:
      "A long curriculum has a few durable themes that must co-evolve (energy + models + evidence in science; syntax + meaning + use in language). Weak for a short unit with one organizing idea.",
    layoutInstruction:
      'LAYOUT PATTERN "Strands": Place THREE parallel vertical strands of related chapters. Get a foothold on each strand before opening cross-links. Most cells between strands are blocked; leave only a few crossing cells. Do not collapse the strands into one island.',
    occupied: [
      ...colBand(1, ALL_ROWS),
      ...colBand(3, ALL_ROWS),
      ...colBand(5, ALL_ROWS),
      { row: 2, col: 2 },
      { row: 4, col: 2 },
      { row: 2, col: 4 },
      { row: 4, col: 4 },
    ],
    blocked: [
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 3, col: 2 },
      { row: 5, col: 2 },
      { row: 6, col: 2 },
      { row: 0, col: 4 },
      { row: 1, col: 4 },
      { row: 3, col: 4 },
      { row: 5, col: 4 },
      { row: 6, col: 4 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "trajectories",
    label: "Trajectories",
    description:
      "A chapter opens only on the outer fringe — every prerequisite is in place. Multiple paths to the same target are allowed.",
    category: "progressions",
    categoryLabel: "Progressions",
    strength: "prerequisites",
    strengthLabel: "Prerequisites",
    playRule:
      "Directed DAG on the plane. Adjacent unlockable tiles are the outer fringe. Branching and merging paths, not one highway. A chapter opens only when every prerequisite is in place.",
    literature:
      "Learning trajectories / progressions (Clements & Sarama; science learning-progressions). Knowledge spaces: the outer fringe is what you are ready to learn (Doignon & Falmagne; ALEKS). Dynamic Learning Maps neighborhoods are the clustered version.",
    useWhen:
      "Priors differ a lot, or the domain is genuinely prerequisite-heavy. Use lock-until / next chapter DAG edges along the painted paths.",
    layoutInstruction:
      'LAYOUT PATTERN "Trajectories": Place a BRANCHING AND MERGING DAG of chapters, not a single highway. Foundation at the first node of the DAG. Later chapters should lock_until earlier nodes on their path. Multiple paths may reach the same target. Leave unused cells blocked so only the fringe is open.',
    occupied: [
      { row: 0, col: 3 },
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 2, col: 1 },
      { row: 2, col: 3 },
      { row: 2, col: 5 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 4, col: 3 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
      { row: 6, col: 3 },
    ],
    blocked: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 1, col: 6 },
      { row: 2, col: 0 },
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 3 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 0 },
      { row: 5, col: 2 },
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 5, col: 6 },
      { row: 6, col: 0 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
      { row: 6, col: 4 },
      { row: 6, col: 5 },
      { row: 6, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "criss_cross",
    label: "Criss-cross landscape",
    description:
      "The same tiles are walked several times from different directions. Almost no permanent blocks.",
    category: "flexibility",
    categoryLabel: "Cognitive flexibility",
    strength: "transfer",
    strengthLabel: "Transfer",
    playRule:
      "One continuous terrain. Several overlapping paths recross the same cells under different headings. Blocked is temporary and path-specific, not a wall between islands. Islands-then-one-bridge is the wrong move here.",
    literature:
      "Spiro's Cognitive Flexibility Theory — Wittgenstein's landscape criss-crossed in many directions so knowledge stays flexible in ill-structured domains. Cousin: Scardamalia & Bereiter idea landscapes with rise-above cells.",
    useWhen:
      "Transfer, cases, and multiple valid organizations matter (design, diagnosis, ethics, law, messy product strategy).",
    layoutInstruction:
      'LAYOUT PATTERN "Criss-cross landscape": Fill a CONTINUOUS TERRAIN of chapters with overlapping recrossing paths. Almost no blocked cells. The same region may be visited under different headings. Do not isolate islands with a single bridge — that oversimplification is exactly what this pattern prevents.',
    occupied: [
      ...rowBand(1, ALL_COLS),
      ...rowBand(3, ALL_COLS),
      ...rowBand(5, ALL_COLS),
      ...colBand(1, [0, 2, 4, 6]),
      ...colBand(3, [0, 2, 4, 6]),
      ...colBand(5, [0, 2, 4, 6]),
    ],
    blocked: [],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "web_first",
    label: "Web-first",
    description:
      "Lay a thin connected skeleton of the whole domain, then densify local neighborhoods.",
    category: "orientation",
    categoryLabel: "Orientation",
    strength: "orientation",
    strengthLabel: "Orientation",
    playRule:
      "First pass: a sparse spanning tree/lattice so every region is already linked. Second pass: fill inside each neighborhood. Hatches are rare; isolation is the thing you are avoiding. Opposite sequencing of Islands. Pairs well with an Epitome at the hub.",
    literature:
      "Norman's web teaching (1973): coarse integrated web first, then refinements inside the web.",
    useWhen:
      "Orientation and “where does this sit?” matter more than protecting working memory from interactivity.",
    layoutInstruction:
      'LAYOUT PATTERN "Web-first": Place a SPARSE CONNECTED WEB (cross + corner links) covering the whole domain so every region is already linked. Do not isolate clusters. Leave most other cells empty (not blocked) so later work can densify neighborhoods. Hatches are rare.',
    occupied: [
      ...colBand(3, ALL_ROWS),
      ...rowBand(3, ALL_COLS),
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
    ],
    blocked: [
      { row: 0, col: 0 },
      { row: 0, col: 6 },
      { row: 6, col: 0 },
      { row: 6, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "interleaved_mosaic",
    label: "Interleaved mosaic",
    description:
      "After local fluency, adjacent steps come from different categories so the path never stays on one island.",
    category: "discrimination",
    categoryLabel: "Discrimination",
    strength: "discrimination",
    strengthLabel: "Discrimination",
    playRule:
      "Same clusters as Islands, but corridors open and the prescribed walk weaves A–B–C–A–B–C. Optionally later the cluster borders dissolve. This is the natural second half of Islands, not a rival to it.",
    literature:
      "Interleaving vs blocking; discriminative-contrast account (Rohrer and others; Bjork's desirable difficulties). Blocking helps immediate performance; interleaving helps later discrimination and transfer.",
    useWhen:
      "The concepts are easy to confuse (rock types, statistical tests, design patterns, verb aspects).",
    layoutInstruction:
      'LAYOUT PATTERN "Interleaved mosaic": Place THREE clusters like Islands, but OPEN the corridors with crossing tiles so the walk can weave A–B–C–A–B–C. Do not keep hatched walls between clusters. Adjacent steps should often come from different clusters after local fluency.',
    occupied: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 5 },
      { row: 1, col: 6 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
      { row: 6, col: 5 },
      { row: 6, col: 6 },
      { row: 0, col: 3 },
      { row: 1, col: 3 },
      { row: 2, col: 3 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
      { row: 5, col: 3 },
      { row: 6, col: 3 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
    ],
    blocked: [
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 4 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "whole_task_bands",
    label: "Whole-task bands",
    description:
      "Never isolate a constituent skill as its own island unless it needs to become automatic. The backbone is simple-to-complex versions of the same whole task.",
    category: "whole_task",
    categoryLabel: "Whole-task performance",
    strength: "performance",
    strengthLabel: "Performance",
    playRule:
      "Horizontal bands. Each band is one complexity class of a whole task (easy authentic case → realistic case). Supportive topics sit beside the band as optional side tiles, not as separate islands. Within a band, support fades from left to right.",
    literature:
      "van Merriënboer's 4C/ID: learning tasks, supportive information, just-in-time procedure, and only-when-needed part-task practice.",
    useWhen:
      "The goal is coordinated performance (clinical work, engineering design, running an analysis end-to-end). Islands will fragment the skill.",
    layoutInstruction:
      'LAYOUT PATTERN "Whole-task bands": Place THREE HORIZONTAL BANDS, each a simple-to-complex version of the SAME whole task. Supportive topics sit as side tiles beside a band, not as separate islands. Do not isolate constituent skills unless they must become automatic. Within a band, fade support from left to right.',
    occupied: [
      ...rowBand(1, ALL_COLS),
      ...rowBand(3, ALL_COLS),
      ...rowBand(5, ALL_COLS),
      { row: 0, col: 1 },
      { row: 0, col: 5 },
      { row: 2, col: 1 },
      { row: 2, col: 5 },
      { row: 4, col: 1 },
      { row: 4, col: 5 },
      { row: 6, col: 1 },
      { row: 6, col: 5 },
    ],
    blocked: [
      { row: 0, col: 3 },
      { row: 2, col: 3 },
      { row: 4, col: 3 },
      { row: 6, col: 3 },
      { row: 2, col: 0 },
      { row: 2, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "funnel",
    label: "Funnel",
    description:
      "Start broad, then taper. Many first-pass chapters collapse toward a single capstone.",
    category: "progressions",
    categoryLabel: "Progressions",
    strength: "prerequisites",
    strengthLabel: "Prerequisites",
    playRule:
      "The top of the map is a wide first encounter. Each lower band is narrower and more integrated. The bottom cell is the capstone — do not open it until the band above is in place. Blocked cells on the sides keep the taper readable.",
    literature:
      "Hierarchical task analysis and completion/fading sequences: start with a wide set of cases, then require more of the whole as support drops away.",
    useWhen:
      "A course should survey many examples first, then force synthesis into one performance (a proof, a design, a diagnosis). Weak when every topic is equally terminal.",
    layoutInstruction:
      'LAYOUT PATTERN "Funnel": Place a WIDE first band of related chapters across the top, then successively narrower bands below, ending in a single CAPSTONE cell. Leave the taper sides blocked. Foundation sits in the wide top band, not at a far-off origin. Later chapters lock until the band above is done.',
    occupied: [
      ...rowBand(0, ALL_COLS),
      ...rowBand(1, [1, 2, 3, 4, 5]),
      ...rowBand(2, [1, 2, 3, 4, 5]),
      ...rowBand(3, [2, 3, 4]),
      ...rowBand(4, [2, 3, 4]),
      { row: 5, col: 3 },
      { row: 6, col: 3 },
    ],
    blocked: [
      { row: 1, col: 0 },
      { row: 1, col: 6 },
      { row: 2, col: 0 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 0 },
      { row: 5, col: 1 },
      { row: 5, col: 2 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
      { row: 6, col: 0 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
      { row: 6, col: 4 },
      { row: 6, col: 5 },
      { row: 6, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "switchbacks",
    label: "Switchbacks",
    description:
      "A zigzag climb: each traverse covers a band, then a tight turn starts the next higher pass.",
    category: "curriculum_depth",
    categoryLabel: "Curriculum depth",
    strength: "deepening",
    strengthLabel: "Deepening",
    playRule:
      "Horizontal runs of chapters with a single connecting cell to the next run. Do not shortcut the zigzag — blocked cells between runs are the mountain. Each higher traverse should revisit the previous band with more demand, not a new unrelated topic.",
    literature:
      "Switchback / mountain-path curricula: progress by traversing a slope, turning, and traversing again at a higher grain — cousin to spiral return without closing a ring.",
    useWhen:
      "A skill has a few recurring moves that must be practiced at rising demand (proof techniques, lab methods, a design loop). Weak for a one-shot survey.",
    layoutInstruction:
      'LAYOUT PATTERN "Switchbacks": Place ALTERNATING HORIZONTAL RUNS of chapters, each joined to the next by a single turn cell. Leave the cells between runs blocked so the walk cannot skip a traverse. Foundation at the first cell of the lowest run. Later runs lock until the run below is done.',
    occupied: [
      ...rowBand(0, [0, 1, 2, 3]),
      { row: 1, col: 3 },
      ...rowBand(2, [3, 4, 5, 6]),
      { row: 3, col: 3 },
      ...rowBand(4, [0, 1, 2, 3]),
      { row: 5, col: 0 },
      ...rowBand(6, ALL_COLS),
    ],
    blocked: [
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
      { row: 1, col: 6 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
      { row: 4, col: 4 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 1 },
      { row: 5, col: 2 },
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "hourglass",
    label: "Hourglass",
    description:
      "Two chambers pinch through a neck. Gather, compress, then expand into a new organization.",
    category: "elaboration",
    categoryLabel: "Elaboration",
    strength: "transfer",
    strengthLabel: "Transfer",
    playRule:
      "Upper chamber = first organization of the domain. The neck is a mandatory synthesis tile. Lower chamber = a second organization of the same ideas (new cases, new representation). Do not bridge the chambers except through the neck.",
    literature:
      "Pinch-point / hourglass curricula: a mid-course synthesis that reorganizes what was surveyed, then a second expansion — related to Reigeluth's simplifying conditions and to dialectic gather–compress–re-expand.",
    useWhen:
      "Learners must hold two valid organizations of the same domain (theory then cases; cases then theory; two representations). Weak for a single linear skill.",
    layoutInstruction:
      'LAYOUT PATTERN "Hourglass": Place an UPPER CHAMBER of chapters, a single NECK cell, then a LOWER CHAMBER. Block everything that would bypass the neck. Foundation in the upper chamber. Lower-chamber chapters should lock until the neck is done.',
    occupied: [
      ...rowBand(0, [1, 2, 3, 4, 5]),
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 3, col: 3 },
      { row: 4, col: 2 },
      { row: 4, col: 4 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
      ...rowBand(6, [1, 2, 3, 4, 5]),
    ],
    blocked: [
      { row: 0, col: 0 },
      { row: 0, col: 6 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 1, col: 6 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 3 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 3 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 0 },
      { row: 5, col: 2 },
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 5, col: 6 },
      { row: 6, col: 0 },
      { row: 6, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "delta",
    label: "Delta",
    description:
      "Several tributaries run in parallel, then join a single river. Synthesis is earned, not assumed.",
    category: "progressions",
    categoryLabel: "Progressions",
    strength: "prerequisites",
    strengthLabel: "Prerequisites",
    playRule:
      "Upper tiles are independent tributaries (one idea each). Mid tiles are pairwise joins. The lower spine is the river — a synthesis that should lock until its tributaries are in. Do not start on the river.",
    literature:
      "Confluence / watershed maps: multiple source streams, explicit junctions, one downstream performance. Cousin to knowledge-space joining and to 'many examples → one model'.",
    useWhen:
      "Several semi-independent topics must later become one coordinated skill (sources into an argument; modules into a system). Weak when there is only one source idea.",
    layoutInstruction:
      'LAYOUT PATTERN "Delta": Place FOUR tributary columns at the top, then JOIN cells, then a single RIVER spine down the center. Leave gaps between tributaries blocked. Foundation on a tributary, not on the river. River chapters should lock until joins above them are done.',
    occupied: [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 0, col: 4 },
      { row: 0, col: 6 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 1, col: 4 },
      { row: 1, col: 6 },
      { row: 2, col: 1 },
      { row: 2, col: 3 },
      { row: 2, col: 5 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      { row: 4, col: 3 },
      { row: 5, col: 3 },
      { row: 6, col: 3 },
    ],
    blocked: [
      { row: 0, col: 1 },
      { row: 0, col: 3 },
      { row: 0, col: 5 },
      { row: 1, col: 1 },
      { row: 1, col: 3 },
      { row: 1, col: 5 },
      { row: 2, col: 0 },
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 4 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
      { row: 5, col: 0 },
      { row: 5, col: 1 },
      { row: 5, col: 2 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
      { row: 6, col: 0 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
      { row: 6, col: 4 },
      { row: 6, col: 5 },
      { row: 6, col: 6 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
  {
    id: "chambers",
    label: "Chambers",
    description:
      "Two rooms joined by a single doorway. Master one space, then pass through; do not live in the hall.",
    category: "discrimination",
    categoryLabel: "Discrimination",
    strength: "working_memory",
    strengthLabel: "Working memory",
    playRule:
      "Each chamber is a bounded problem space (a representation, a toolset, a family of cases). The doorway is a transfer tile. Blocked walls keep the rooms separate — this is Islands with an explicit gate instead of a later bridge.",
    literature:
      "Method-of-loci / chambered problem spaces: one room, one organization. Crossing the doorway is a deliberate shift of frame, not a blend.",
    useWhen:
      "Two (or more) regimes must stay distinct until the learner can choose which room a new case belongs in (syntax vs meaning; clinic vs lab; two competing models).",
    layoutInstruction:
      'LAYOUT PATTERN "Chambers": Place TWO HOLLOW ROOMS of chapters, joined by a single DOORWAY column. Keep interior and outer walls blocked so the rooms stay separate. Foundation inside the first room. Second-room chapters should lock until the doorway is done.',
    occupied: [
      ...rowBand(0, [0, 1, 2, 3]),
      { row: 1, col: 0 },
      { row: 1, col: 3 },
      ...rowBand(2, [0, 1, 2, 3]),
      { row: 3, col: 3 },
      ...rowBand(4, [3, 4, 5, 6]),
      { row: 5, col: 3 },
      { row: 5, col: 6 },
      ...rowBand(6, [3, 4, 5, 6]),
    ],
    blocked: [
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 0, col: 6 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 4 },
      { row: 1, col: 5 },
      { row: 1, col: 6 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 5, col: 0 },
      { row: 5, col: 1 },
      { row: 5, col: 2 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 6, col: 0 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
    ],
    defaultImported: false,
    authorUsername: null,
  },
];

export const MAP_TYPE_LIBRARY: readonly MapTypeLibraryEntry[] = [
  ...MAP_TYPE_LIBRARY_CORE,
  ...MAP_TYPE_LIBRARY_EXTRAS,
];

export const DEFAULT_SELECTED_LIBRARY_IDS: readonly string[] = [
  ...INITIAL_CHAPTERS_LEVELS,
];

export const MAP_TYPE_LIBRARY_BY_ID: Record<string, MapTypeLibraryEntry> =
  Object.fromEntries(MAP_TYPE_LIBRARY.map((e) => [e.id, e]));

export function isMapTypeLibraryId(value: unknown): boolean {
  return typeof value === "string" && value in MAP_TYPE_LIBRARY_BY_ID;
}

export function isDefaultSelectedLibraryId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (DEFAULT_SELECTED_LIBRARY_IDS as readonly string[]).includes(value)
  );
}

export const MAP_TYPE_LIBRARY_CATEGORIES: Array<{
  id: MapTypeLibraryCategory;
  label: string;
}> = [
  { id: "core", label: "Core" },
  { id: "curriculum_depth", label: "Curriculum depth" },
  { id: "elaboration", label: "Elaboration" },
  { id: "strands", label: "Parallel themes" },
  { id: "progressions", label: "Progressions" },
  { id: "flexibility", label: "Cognitive flexibility" },
  { id: "orientation", label: "Orientation" },
  { id: "discrimination", label: "Discrimination" },
  { id: "whole_task", label: "Whole-task" },
  { id: "community", label: "Community" },
];
