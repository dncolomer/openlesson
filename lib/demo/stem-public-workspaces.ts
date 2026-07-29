/**
 * Pure STEM public workspace catalog + first-layer subdiscipline knowledge regions.
 * No DB I/O — vectors use the shipped synthetic knowledge-region encoder path.
 */

import {
  createSyntheticKnowledgeRegionFromProfile,
  type CustomVerificationModelSpec,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";

/** Idempotency marker in workspace.notes (shared across all STEM catalog workspaces). */
export const STEM_PUBLIC_CATALOG_MARKER = "[STEM:public-catalog-v1]";

/** Per-field marker key embedded in notes for find/update. */
export function stemFieldNotesMarker(fieldKey: string): string {
  return `${STEM_PUBLIC_CATALOG_MARKER} STEM_FIELD:${fieldKey}`;
}

export type StemFieldKey =
  | "mathematics"
  | "physics"
  | "chemistry"
  | "biology"
  | "computer_science"
  | "engineering"
  | "earth_environmental"
  | "astronomy_space";

export interface StemSubdisciplineDefinition {
  /** Stable key within the field */
  key: string;
  /** Region display name (custom_verification_models.name) — also the block title */
  regionName: string;
  description: string;
  profile: SyntheticRegionProfile;
}

/** Workspace block aligned 1:1 with a subdiscipline knowledge region. */
export interface StemBlockDefinition {
  key: string;
  title: string;
  description: string;
  /** First subdiscipline is the start block on the graph. */
  is_start: boolean;
}

export interface StemFieldDefinition {
  key: StemFieldKey;
  /** Workspace title (public Map of Knowledge) */
  title: string;
  root_topic: string;
  description: string;
  workspace_goal: string;
  /**
   * @deprecated Prefer blocksForStemField() — one block per subdiscipline region.
   * Kept optional for backward-compatible catalog objects that still list an overview blurb.
   */
  start_block?: { title: string; description: string };
  subdisciplines: StemSubdisciplineDefinition[];
}

/**
 * One block per first-layer expert region (title = regionName).
 * Pure — used by seed + unit tests.
 */
export function blocksForStemField(field: StemFieldDefinition): StemBlockDefinition[] {
  return field.subdisciplines.map((sub, index) => ({
    key: sub.key,
    title: sub.regionName,
    description: sub.description,
    is_start: index === 0,
  }));
}

function profile(
  partial: SyntheticRegionProfile & { name: string },
): SyntheticRegionProfile {
  return {
    verification_score: partial.verification_score ?? 78,
    augmentation_score: partial.augmentation_score ?? 72,
    optimization_score: partial.optimization_score ?? 70,
    ghc_score: partial.ghc_score ?? 65,
    preferred_modalities: partial.preferred_modalities ?? ["speech", "tool", "screen"],
    pow_types: partial.pow_types ?? ["speech", "tool", "screen"],
    ...partial,
  };
}

/**
 * Major STEM fields + first-layer subdisciplines.
 * Order is stable for tests and seed logs.
 */
export const STEM_PUBLIC_FIELDS: readonly StemFieldDefinition[] = [
  {
    key: "mathematics",
    title: "Mathematics",
    root_topic: "Mathematics",
    description:
      "Public verification workspace for major mathematical disciplines — from foundations and analysis to algebra, geometry, probability, and applied math.",
    workspace_goal:
      "Map learner and cohort knowledge configurations against top-level mathematical subdisciplines.",
    start_block: {
      title: "Mathematical foundations overview",
      description:
        "Orient to proof culture, definitions, and how subdisciplines connect across pure and applied math.",
    },
    subdisciplines: [
      {
        key: "analysis",
        regionName: "Analysis",
        description: "Real and complex analysis, limits, measure, and functional analysis.",
        profile: profile({
          name: "Analysis",
          description: "Analysis and measure-theoretic thinking",
          strengths: ["limits", "continuity", "integration", "series", "functional-analysis"],
          friction_patterns: ["epsilon-delta-gaps", "interchange-of-limits"],
          tool_names: ["proof-outline", "counterexample", "epsilon-delta"],
        }),
      },
      {
        key: "algebra",
        regionName: "Algebra",
        description: "Abstract algebra, linear algebra, and algebraic structures.",
        profile: profile({
          name: "Algebra",
          description: "Groups, rings, fields, and linear structure",
          strengths: ["groups", "rings", "fields", "linear-maps", "modules"],
          friction_patterns: ["homomorphism-confusion", "basis-dependence"],
          tool_names: ["structure-map", "matrix-reduce", "coset-diagram"],
        }),
      },
      {
        key: "geometry_topology",
        regionName: "Geometry & Topology",
        description: "Euclidean, differential, and algebraic geometry; point-set and algebraic topology.",
        profile: profile({
          name: "Geometry & Topology",
          description: "Shapes, spaces, and continuous invariants",
          strengths: ["manifolds", "homology", "curvature", "invariants", "coverings"],
          friction_patterns: ["dimension-errors", "local-vs-global"],
          tool_names: ["sketch-manifold", "fundamental-group", "atlas-chart"],
        }),
      },
      {
        key: "probability_statistics",
        regionName: "Probability & Statistics",
        description: "Probability theory, stochastic processes, and statistical inference.",
        profile: profile({
          name: "Probability & Statistics",
          description: "Uncertainty, models, and inference",
          strengths: ["measure-probability", "estimation", "hypothesis-testing", "bayes", "stochastic-processes"],
          friction_patterns: ["conditioning-errors", "iid-assumptions"],
          tool_names: ["likelihood", "bootstrap", "markov-chain"],
        }),
      },
      {
        key: "number_theory_discrete",
        regionName: "Number Theory & Discrete Math",
        description: "Integers, modular arithmetic, combinatorics, and graph theory.",
        profile: profile({
          name: "Number Theory & Discrete Math",
          description: "Discrete structures and integers",
          strengths: ["modular-arithmetic", "combinatorics", "graphs", "generating-functions", "primes"],
          friction_patterns: ["off-by-one", "overcounting"],
          tool_names: ["bijection", "induction-proof", "graph-walk"],
        }),
      },
      {
        key: "applied_math",
        regionName: "Applied Mathematics",
        description: "PDEs, numerical methods, optimization, and mathematical modeling.",
        profile: profile({
          name: "Applied Mathematics",
          description: "Models, numerics, and optimization",
          strengths: ["pde-models", "numerics", "optimization", "dimensional-analysis", "stability"],
          friction_patterns: ["ill-conditioning", "model-misspecification"],
          tool_names: ["finite-difference", "solver", "objective-function"],
        }),
      },
    ],
  },
  {
    key: "physics",
    title: "Physics",
    root_topic: "Physics",
    description:
      "Public workspace spanning classical mechanics, electromagnetism, quantum, statistical physics, and relativity as first-layer competency regions.",
    workspace_goal:
      "Locate demonstrated physics knowledge relative to core subdiscipline regions.",
    start_block: {
      title: "Physical principles overview",
      description: "Conservation laws, scales, and how theory connects to experiment.",
    },
    subdisciplines: [
      {
        key: "classical_mechanics",
        regionName: "Classical Mechanics",
        description: "Newtonian, Lagrangian, and Hamiltonian mechanics.",
        profile: profile({
          name: "Classical Mechanics",
          strengths: ["newton-laws", "lagrangian", "hamiltonian", "rigid-body", "oscillations"],
          friction_patterns: ["constraint-forces", "non-inertial-frames"],
          tool_names: ["free-body", "phase-space", "energy-method"],
        }),
      },
      {
        key: "electromagnetism",
        regionName: "Electromagnetism",
        description: "Maxwell equations, waves, and electromagnetic materials.",
        profile: profile({
          name: "Electromagnetism",
          strengths: ["maxwell", "electrostatics", "magnetostatics", "waves", "circuits"],
          friction_patterns: ["boundary-conditions", "gauge-confusion"],
          tool_names: ["field-line", "faraday-loop", "poynting"],
        }),
      },
      {
        key: "quantum",
        regionName: "Quantum Mechanics",
        description: "Wavefunctions, operators, measurement, and simple quantum systems.",
        profile: profile({
          name: "Quantum Mechanics",
          strengths: ["schrodinger", "operators", "spin", "perturbation", "entanglement-basics"],
          friction_patterns: ["measurement-postulate", "basis-choice"],
          tool_names: ["hilbert-state", "commutator", "potential-well"],
        }),
      },
      {
        key: "thermo_statmech",
        regionName: "Thermodynamics & Statistical Mechanics",
        description: "Heat, entropy, ensembles, and fluctuation phenomena.",
        profile: profile({
          name: "Thermo & Stat Mech",
          strengths: ["entropy", "ensembles", "free-energy", "phase-transitions", "kinetic-theory"],
          friction_patterns: ["ensemble-mixups", "reversibility-myths"],
          tool_names: ["partition-function", "carnot", "boltzmann"],
        }),
      },
      {
        key: "relativity",
        regionName: "Relativity",
        description: "Special and introductory general relativity.",
        profile: profile({
          name: "Relativity",
          strengths: ["lorentz", "spacetime", "equivalence", "geodesics", "gravitational-redshift"],
          friction_patterns: ["simultaneity", "curvature-vs-force"],
          tool_names: ["minkowski", "light-cone", "metric"],
        }),
      },
      {
        key: "condensed_matter",
        regionName: "Condensed Matter",
        description: "Solids, electrons in matter, and collective phenomena.",
        profile: profile({
          name: "Condensed Matter",
          strengths: ["band-structure", "phonons", "superconductivity-basics", "magnetism", "transport"],
          friction_patterns: ["mean-field-overreach", "scattering-channels"],
          tool_names: ["brillouin", "dispersion", "crystal-lattice"],
        }),
      },
    ],
  },
  {
    key: "chemistry",
    title: "Chemistry",
    root_topic: "Chemistry",
    description:
      "Public chemistry workspace covering physical, organic, inorganic, analytical, and biochemistry top-level regions.",
    workspace_goal:
      "Verify chemical reasoning against major subdiscipline knowledge regions.",
    start_block: {
      title: "Chemical systems overview",
      description: "Structure, reactivity, energy, and measurement across chemical scales.",
    },
    subdisciplines: [
      {
        key: "physical_chemistry",
        regionName: "Physical Chemistry",
        description: "Thermo, kinetics, quantum chemistry, and spectroscopy.",
        profile: profile({
          name: "Physical Chemistry",
          strengths: ["chemical-thermo", "kinetics", "spectroscopy", "quantum-chem", "surfaces"],
          friction_patterns: ["rate-law-errors", "state-function-mixups"],
          tool_names: ["arrhenius", "reaction-coordinate", "spectrum"],
        }),
      },
      {
        key: "organic",
        regionName: "Organic Chemistry",
        description: "Structure, mechanisms, and synthesis of carbon compounds.",
        profile: profile({
          name: "Organic Chemistry",
          strengths: ["mechanisms", "stereochemistry", "functional-groups", "synthesis-planning", "nmr-basics"],
          friction_patterns: ["arrow-pushing-gaps", "regioselectivity"],
          tool_names: ["mechanism-map", "retrosynthesis", "newman"],
        }),
      },
      {
        key: "inorganic",
        regionName: "Inorganic Chemistry",
        description: "Main-group, transition-metal, and solid-state inorganic systems.",
        profile: profile({
          name: "Inorganic Chemistry",
          strengths: ["coordination", "crystal-field", "main-group", "catalysis-inorganic", "solid-state"],
          friction_patterns: ["oxidation-state-errors", "ligand-field-mixups"],
          tool_names: ["ligand-field", "pourbaix", "unit-cell"],
        }),
      },
      {
        key: "analytical",
        regionName: "Analytical Chemistry",
        description: "Quantitative methods, separation, and chemical measurement.",
        profile: profile({
          name: "Analytical Chemistry",
          strengths: ["titration", "chromatography", "mass-spec", "calibration", "error-analysis"],
          friction_patterns: ["matrix-effects", "detection-limit"],
          tool_names: ["calibration-curve", "hplc", "blank-control"],
        }),
      },
      {
        key: "biochemistry",
        regionName: "Biochemistry",
        description: "Biomolecules, metabolism, and molecular information flow.",
        profile: profile({
          name: "Biochemistry",
          strengths: ["proteins", "enzymes", "metabolism", "nucleic-acids", "membranes"],
          friction_patterns: ["pathway-direction", "allostery-miss"],
          tool_names: ["enzyme-kinetics", "pathway-map", "structure-motif"],
        }),
      },
    ],
  },
  {
    key: "biology",
    title: "Biology",
    root_topic: "Biology",
    description:
      "Public biology workspace for cell/molecular biology, genetics, ecology, evolution, physiology, and microbiology.",
    workspace_goal:
      "Place biological understanding in top-level life-science knowledge regions.",
    start_block: {
      title: "Living systems overview",
      description: "Levels of organization from molecules to ecosystems.",
    },
    subdisciplines: [
      {
        key: "cell_molecular",
        regionName: "Cell & Molecular Biology",
        description: "Cell structure, signaling, and molecular machines.",
        profile: profile({
          name: "Cell & Molecular Biology",
          strengths: ["organelles", "signaling", "cytoskeleton", "trafficking", "gene-expression"],
          friction_patterns: ["scale-confusion", "correlation-causation"],
          tool_names: ["pathway", "microscope-image", "western"],
        }),
      },
      {
        key: "genetics_genomics",
        regionName: "Genetics & Genomics",
        description: "Inheritance, variation, and genome-scale analysis.",
        profile: profile({
          name: "Genetics & Genomics",
          strengths: ["mendelian", "population-genetics", "sequencing", "crispr-basics", "epistasis"],
          friction_patterns: ["linkage-errors", "multiple-testing"],
          tool_names: ["punnett", "gwas", "alignment"],
        }),
      },
      {
        key: "ecology",
        regionName: "Ecology",
        description: "Populations, communities, ecosystems, and biogeochemical cycles.",
        profile: profile({
          name: "Ecology",
          strengths: ["population-dynamics", "food-webs", "niche", "succession", "nutrient-cycles"],
          friction_patterns: ["density-dependence", "scale-mismatch"],
          tool_names: ["lotka-volterra", "quadrat", "trophic-level"],
        }),
      },
      {
        key: "evolution",
        regionName: "Evolutionary Biology",
        description: "Natural selection, phylogeny, and macroevolution.",
        profile: profile({
          name: "Evolutionary Biology",
          strengths: ["selection", "drift", "phylogenetics", "speciation", "homology"],
          friction_patterns: ["teleology", "just-so-stories"],
          tool_names: ["tree-thinking", "fitness-landscape", "fossil-record"],
        }),
      },
      {
        key: "physiology",
        regionName: "Physiology",
        description: "Organ systems, homeostasis, and organismal function.",
        profile: profile({
          name: "Physiology",
          strengths: ["homeostasis", "cardiovascular", "neural", "endocrine", "respiration"],
          friction_patterns: ["feedback-loops", "set-point-myths"],
          tool_names: ["feedback-diagram", "action-potential", "gas-exchange"],
        }),
      },
      {
        key: "microbiology",
        regionName: "Microbiology",
        description: "Bacteria, viruses, microbial ecology, and host interactions.",
        profile: profile({
          name: "Microbiology",
          strengths: ["prokaryotes", "viruses", "microbiomes", "pathogenesis", "antimicrobials"],
          friction_patterns: ["sterility-assumptions", "resistance-mechanisms"],
          tool_names: ["culture", "gram-stain", "plaque-assay"],
        }),
      },
    ],
  },
  {
    key: "computer_science",
    title: "Computer Science",
    root_topic: "Computer Science",
    description:
      "Public CS workspace spanning algorithms, systems, AI/ML, HCI-theory-adjacent theory, security, and software engineering practice regions.",
    workspace_goal:
      "Map computational skill evidence to first-layer CS knowledge regions.",
    start_block: {
      title: "Computational thinking overview",
      description: "Abstraction, correctness, complexity, and system boundaries.",
    },
    subdisciplines: [
      {
        key: "algorithms",
        regionName: "Algorithms & Complexity",
        description: "Design, analysis, and computational complexity.",
        profile: profile({
          name: "Algorithms & Complexity",
          strengths: ["asymptotics", "graphs", "dp", "randomized-algs", "np-basics"],
          friction_patterns: ["off-by-one-complexity", "proof-of-correctness"],
          tool_names: ["recurrence", "reduction", "invariant"],
        }),
      },
      {
        key: "systems",
        regionName: "Computer Systems",
        description: "OS, networks, architecture, and distributed systems basics.",
        profile: profile({
          name: "Computer Systems",
          strengths: ["processes", "memory", "networking", "concurrency", "storage"],
          friction_patterns: ["race-conditions", "cap-tradeoffs"],
          tool_names: ["strace", "packet-trace", "cache-hierarchy"],
        }),
      },
      {
        key: "ai_ml",
        regionName: "AI & Machine Learning",
        description: "Learning systems, models, evaluation, and representation.",
        profile: profile({
          name: "AI & Machine Learning",
          strengths: ["supervised", "generalization", "neural-nets", "optimization-ml", "evaluation"],
          friction_patterns: ["data-leakage", "overfit-blindness"],
          tool_names: ["train-val-test", "loss-curve", "feature-map"],
        }),
      },
      {
        key: "theory",
        regionName: "Theory of Computation",
        description: "Automata, computability, and formal languages.",
        profile: profile({
          name: "Theory of Computation",
          strengths: ["automata", "grammars", "decidability", "reductions", "logic-basics"],
          friction_patterns: ["language-vs-machine", "halting-intuition"],
          tool_names: ["dfa-nfa", "pumping", "tm-sketch"],
        }),
      },
      {
        key: "security",
        regionName: "Security & Cryptography",
        description: "Threat models, crypto primitives, and secure systems thinking.",
        profile: profile({
          name: "Security & Cryptography",
          strengths: ["threat-model", "authn-authz", "public-key", "side-channels-basics", "secure-design"],
          friction_patterns: ["security-by-obscurity", "nonce-reuse"],
          tool_names: ["attack-tree", "tls-handshake", "hash-mac"],
        }),
      },
      {
        key: "software_engineering",
        regionName: "Software Engineering",
        description: "Design, testing, reliability, and collaborative delivery.",
        profile: profile({
          name: "Software Engineering",
          strengths: ["modularity", "testing", "ci-cd", "apis", "observability"],
          friction_patterns: ["premature-abstraction", "flaky-tests"],
          tool_names: ["design-review", "test-pyramid", "rollback-plan"],
        }),
      },
    ],
  },
  {
    key: "engineering",
    title: "Engineering",
    root_topic: "Engineering",
    description:
      "Public engineering workspace across mechanical, electrical, civil, chemical, and industrial/systems engineering top-level regions.",
    workspace_goal:
      "Verify engineering judgment against major disciplinary knowledge regions.",
    start_block: {
      title: "Engineering problem framing",
      description: "Requirements, constraints, safety factors, and tradeoffs.",
    },
    subdisciplines: [
      {
        key: "mechanical",
        regionName: "Mechanical Engineering",
        description: "Mechanics of materials, thermofluids, and machine design.",
        profile: profile({
          name: "Mechanical Engineering",
          strengths: ["statics", "strength-of-materials", "heat-transfer", "kinematics", "design-for-manufacture"],
          friction_patterns: ["factor-of-safety", "unit-errors"],
          tool_names: ["free-body", "beam-diagram", "cad-constraint"],
        }),
      },
      {
        key: "electrical",
        regionName: "Electrical Engineering",
        description: "Circuits, signals, electronics, and power systems basics.",
        profile: profile({
          name: "Electrical Engineering",
          strengths: ["circuits", "signals-systems", "semiconductors", "control-basics", "power"],
          friction_patterns: ["grounding", "impedance-mismatch"],
          tool_names: ["schematic", "bode", "spice"],
        }),
      },
      {
        key: "civil",
        regionName: "Civil Engineering",
        description: "Structures, geotech, transportation, and water resources.",
        profile: profile({
          name: "Civil Engineering",
          strengths: ["structures", "geotech", "hydrology", "transport", "codes"],
          friction_patterns: ["load-path", "soil-uncertainty"],
          tool_names: ["load-combo", "truss", "hydrograph"],
        }),
      },
      {
        key: "chemical_eng",
        regionName: "Chemical Engineering",
        description: "Transport, reaction engineering, and process systems.",
        profile: profile({
          name: "Chemical Engineering",
          strengths: ["mass-balance", "reactor-design", "separations", "transport", "process-control"],
          friction_patterns: ["units-basis", "equilibrium-vs-rate"],
          tool_names: ["pfd", "mole-balance", "mccabe-thiele"],
        }),
      },
      {
        key: "industrial_systems",
        regionName: "Industrial & Systems Engineering",
        description: "Operations, quality, optimization, and socio-technical systems.",
        profile: profile({
          name: "Industrial & Systems Engineering",
          strengths: ["operations-research", "quality", "lean", "simulation", "human-factors"],
          friction_patterns: ["local-optima", "metric-gaming"],
          tool_names: ["lp-model", "control-chart", "value-stream"],
        }),
      },
    ],
  },
  {
    key: "earth_environmental",
    title: "Earth & Environmental Science",
    root_topic: "Earth and Environmental Science",
    description:
      "Public earth-systems workspace for geology, climate/atmosphere, oceanography, ecology-of-earth-systems, and environmental science practice.",
    workspace_goal:
      "Map earth and environment knowledge to first-layer geosciences regions.",
    start_block: {
      title: "Earth system overview",
      description: "Spheres, cycles, timescales, and human–environment coupling.",
    },
    subdisciplines: [
      {
        key: "geology",
        regionName: "Geology",
        description: "Rocks, plate tectonics, and deep-time Earth processes.",
        profile: profile({
          name: "Geology",
          strengths: ["plate-tectonics", "petrology", "stratigraphy", "structural", "geochronology"],
          friction_patterns: ["deep-time-scale", "uniformitarianism-limits"],
          tool_names: ["geologic-map", "cross-section", "mineral-id"],
        }),
      },
      {
        key: "climate_atmosphere",
        regionName: "Climate & Atmosphere",
        description: "Weather, climate dynamics, and radiative forcing.",
        profile: profile({
          name: "Climate & Atmosphere",
          strengths: ["radiation", "circulation", "greenhouse", "paleoclimate", "feedbacks"],
          friction_patterns: ["weather-vs-climate", "forcing-vs-response"],
          tool_names: ["energy-budget", "gcm-concept", "proxy-record"],
        }),
      },
      {
        key: "oceanography",
        regionName: "Oceanography",
        description: "Physical, chemical, and biological ocean systems.",
        profile: profile({
          name: "Oceanography",
          strengths: ["currents", "thermohaline", "biogeochem-ocean", "waves", "coastal"],
          friction_patterns: ["mixed-layer", "upwelling-miss"],
          tool_names: ["ts-diagram", "ctd", "coriolis"],
        }),
      },
      {
        key: "hydrology_surface",
        regionName: "Hydrology & Surface Processes",
        description: "Water cycle, rivers, soils, and landscape evolution.",
        profile: profile({
          name: "Hydrology & Surface Processes",
          strengths: ["water-balance", "runoff", "erosion", "groundwater", "sediment"],
          friction_patterns: ["watershed-delineation", "storage-terms"],
          tool_names: ["hydrograph", "darcy", "mass-wasting"],
        }),
      },
      {
        key: "environmental_science",
        regionName: "Environmental Science",
        description: "Pollution, resources, risk, and sustainability assessment.",
        profile: profile({
          name: "Environmental Science",
          strengths: ["risk", "contaminants", "life-cycle", "policy-science", "monitoring"],
          friction_patterns: ["exposure-pathway", "uncertainty-comms"],
          tool_names: ["dose-response", "lca", "sampling-design"],
        }),
      },
    ],
  },
  {
    key: "astronomy_space",
    title: "Astronomy & Space Science",
    root_topic: "Astronomy and Space Science",
    description:
      "Public space-science workspace covering observational astronomy, astrophysics, planetary science, cosmology, and space systems.",
    workspace_goal:
      "Locate space-science knowledge against major astronomy subdiscipline regions.",
    start_block: {
      title: "Cosmic scales overview",
      description: "Distance ladder, forces, and observation vs theory.",
    },
    subdisciplines: [
      {
        key: "observational",
        regionName: "Observational Astronomy",
        description: "Telescopes, photometry, spectroscopy, and surveys.",
        profile: profile({
          name: "Observational Astronomy",
          strengths: ["telescopes", "photometry", "spectroscopy", "astrometry", "surveys"],
          friction_patterns: ["seeing-calibration", "selection-bias"],
          tool_names: ["hr-diagram", "spectrum-line", "light-curve"],
        }),
      },
      {
        key: "astrophysics",
        regionName: "Astrophysics",
        description: "Stars, compact objects, and high-energy processes.",
        profile: profile({
          name: "Astrophysics",
          strengths: ["stellar-structure", "nucleosynthesis", "accretion", "supernovae", "plasma-basics"],
          friction_patterns: ["order-of-magnitude", "opacity"],
          tool_names: ["mass-luminosity", "sedov", "eddington"],
        }),
      },
      {
        key: "planetary",
        regionName: "Planetary Science",
        description: "Planets, small bodies, atmospheres, and formation.",
        profile: profile({
          name: "Planetary Science",
          strengths: ["formation", "atmospheres", "surfaces", "magnetospheres", "exoplanets"],
          friction_patterns: ["habitable-zone-overclaim", "geologic-clock"],
          tool_names: ["transit", "radial-velocity", "crater-count"],
        }),
      },
      {
        key: "cosmology",
        regionName: "Cosmology",
        description: "Expanding universe, large-scale structure, and early universe.",
        profile: profile({
          name: "Cosmology",
          strengths: ["expansion", "cmb", "dark-matter-basics", "structure-formation", "distance-ladder"],
          friction_patterns: ["coordinate-confusion", "model-vs-data"],
          tool_names: ["hubble", "friedmann", "power-spectrum"],
        }),
      },
      {
        key: "space_systems",
        regionName: "Space Systems & Engineering",
        description: "Orbits, spacecraft subsystems, and mission design basics.",
        profile: profile({
          name: "Space Systems",
          strengths: ["orbital-mechanics", "link-budget", "power-thermal", "guidance", "mission-ops"],
          friction_patterns: ["delta-v-budget", "conops-gaps"],
          tool_names: ["hohmann", "link-budget", "conops"],
        }),
      },
    ],
  },
] as const;

/** Required major fields for acceptance (stable keys). */
export const STEM_REQUIRED_FIELD_KEYS: readonly StemFieldKey[] = STEM_PUBLIC_FIELDS.map(
  (f) => f.key,
);

export function getStemField(key: string): StemFieldDefinition | null {
  return STEM_PUBLIC_FIELDS.find((f) => f.key === key) ?? null;
}

export function stemWorkspaceNotes(field: StemFieldDefinition): string {
  return (
    `${stemFieldNotesMarker(field.key)} Public STEM catalog workspace for ` +
    `${field.title}. First-layer custom knowledge regions = top-level subdisciplines. ` +
    `Do not treat notes as learner content.`
  );
}

/**
 * Build a real knowledge-config region vector for one subdiscipline.
 */
export function buildStemSubdisciplineRegion(
  field: StemFieldDefinition,
  sub: StemSubdisciplineDefinition,
  workspaceId = `stem-${field.key}`,
): CustomVerificationModelSpec {
  const region = createSyntheticKnowledgeRegionFromProfile({
    name: sub.regionName,
    profile: sub.profile,
    description: sub.description,
    workspaceId,
  });
  return {
    ...region,
    subjects: [{ label: "synthetic:grok-4.5" }],
  };
}

export function buildAllStemRegionsForField(
  field: StemFieldDefinition,
  workspaceId = `stem-${field.key}`,
): CustomVerificationModelSpec[] {
  return field.subdisciplines.map((sub) =>
    buildStemSubdisciplineRegion(field, sub, workspaceId),
  );
}

/** Pure completeness checks used by unit tests + verify summary. */
export function assertStemCatalogComplete(): {
  fieldCount: number;
  minRegionsPerField: number;
  fields: Array<{
    key: StemFieldKey;
    regionCount: number;
    blockCount: number;
    regionNames: string[];
    blockTitles: string[];
  }>;
} {
  if (STEM_PUBLIC_FIELDS.length < 8) {
    throw new Error(`expected ≥8 major STEM fields, got ${STEM_PUBLIC_FIELDS.length}`);
  }
  const required = new Set<StemFieldKey>([
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "computer_science",
    "engineering",
    "earth_environmental",
    "astronomy_space",
  ]);
  for (const key of required) {
    if (!getStemField(key)) throw new Error(`missing required STEM field: ${key}`);
  }

  let minRegions = Infinity;
  const fields = STEM_PUBLIC_FIELDS.map((f) => {
    if (f.subdisciplines.length < 3) {
      throw new Error(`field ${f.key} needs ≥3 subdiscipline regions, got ${f.subdisciplines.length}`);
    }
    const names = f.subdisciplines.map((s) => s.regionName);
    const unique = new Set(names.map((n) => n.toLowerCase()));
    if (unique.size !== names.length) {
      throw new Error(`duplicate region names in field ${f.key}`);
    }
    const blocks = blocksForStemField(f);
    if (blocks.length !== f.subdisciplines.length) {
      throw new Error(
        `field ${f.key}: block count ${blocks.length} != region count ${f.subdisciplines.length}`,
      );
    }
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].title !== f.subdisciplines[i].regionName) {
        throw new Error(
          `field ${f.key}: block title "${blocks[i].title}" != region "${f.subdisciplines[i].regionName}"`,
        );
      }
      if (blocks[i].key !== f.subdisciplines[i].key) {
        throw new Error(`field ${f.key}: block key mismatch at index ${i}`);
      }
    }
    if (!blocks.some((b) => b.is_start)) {
      throw new Error(`field ${f.key}: expected one start block`);
    }
    minRegions = Math.min(minRegions, f.subdisciplines.length);
    return {
      key: f.key,
      regionCount: f.subdisciplines.length,
      blockCount: blocks.length,
      regionNames: names,
      blockTitles: blocks.map((b) => b.title),
    };
  });

  return {
    fieldCount: STEM_PUBLIC_FIELDS.length,
    minRegionsPerField: minRegions === Infinity ? 0 : minRegions,
    fields,
  };
}
