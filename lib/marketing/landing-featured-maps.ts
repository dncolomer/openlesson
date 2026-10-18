/**
 * Hardcoded landing-page featured maps.
 * IDs are UUID v5 from slug (not a DB feature flag). Seed writes the same IDs
 * into staging and production so the carousel list is identical.
 */

import { createHash } from "node:crypto";

/** DNS namespace UUID; namespaced as openlesson.landing.featured.v1.<name> */
const LANDING_FEATURED_NS = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

export const LANDING_FEATURED_NOTES_MARKER = "[LP:featured-v1]";

export function landingFeaturedUuid(name: string): string {
  const hash = createHash("sha1");
  hash.update(LANDING_FEATURED_NS);
  hash.update(`openlesson.landing.featured.v1.${name}`);
  const bytes = Buffer.from(hash.digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export type LandingFeaturedCategory =
  | "Engineering"
  | "AI & ML"
  | "Science"
  | "Math"
  | "Health";

export type LandingFeaturedBlockDef = {
  key: string;
  title: string;
  description: string;
  isStart?: boolean;
  next: readonly string[];
  x: number;
  y: number;
};

export type LandingFeaturedMapDef = {
  slug: string;
  title: string;
  category: LandingFeaturedCategory;
  summary: string;
  description: string;
  goal: string;
  blocks: readonly LandingFeaturedBlockDef[];
};

function eightBlockGraph(
  start: { key: string; title: string; description: string },
  left: readonly [
    { key: string; title: string; description: string },
    { key: string; title: string; description: string },
    { key: string; title: string; description: string },
  ],
  right: readonly [
    { key: string; title: string; description: string },
    { key: string; title: string; description: string },
    { key: string; title: string; description: string },
  ],
  capstone: { key: string; title: string; description: string },
): LandingFeaturedBlockDef[] {
  const [l1, l2, l3] = left;
  const [r1, r2, r3] = right;
  return [
    { ...start, isStart: true, next: [l1.key, r1.key], x: 0, y: 0 },
    { ...l1, next: [l2.key], x: -2, y: 1 },
    { ...r1, next: [r2.key], x: 2, y: 1 },
    { ...l2, next: [l3.key], x: -2, y: 2 },
    { ...r2, next: [r3.key], x: 2, y: 2 },
    { ...l3, next: [capstone.key], x: -2, y: 3 },
    { ...r3, next: [capstone.key], x: 2, y: 3 },
    { ...capstone, next: [], x: 0, y: 4 },
  ];
}

const DEFS: readonly LandingFeaturedMapDef[] = [
  {
    slug: "surface-code-mwpm-neural-decoding",
    title: "Surface-code MWPM vs neural decoding",
    category: "Engineering",
    summary:
      "Compare minimum-weight perfect matching with learned decoders on rotated surface-code error chains.",
    description:
      "Work a superconducting-qubit surface-code patch: syndrome graphs, MWPM, and neural decoders under circuit-level noise.",
    goal: "Decide when a learned decoder beats MWPM on a distance-5 rotated surface code.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Rotated surface-code patch",
        description:
          "Place data and measure qubits on a distance-5 rotated lattice and write X/Z stabilizer checks.",
      },
      [
        {
          key: "syndrome",
          title: "Syndrome graph construction",
          description:
            "Turn detector events into a matching graph with spacetime edges from circuit-level depolarizing noise.",
        },
        {
          key: "mwpm",
          title: "Blossom MWPM decoder",
          description:
            "Run Edmonds matching on the syndrome graph and recover a Pauli frame for logical X/Z.",
        },
        {
          key: "thresholds",
          title: "Threshold vs distance",
          description:
            "Sweep physical p and plot logical error vs d=3,5,7 for MWPM under SI1000-like noise.",
        },
      ],
      [
        {
          key: "dataset",
          title: "Circuit-level training shots",
          description:
            "Sample Stim circuits and label residual logicals for a convolutional or transformer decoder.",
        },
        {
          key: "neural",
          title: "Neural syndrome decoder",
          description:
            "Train a 2D conv net on syndrome frames and compare shot latency with blossom matching.",
        },
        {
          key: "correlated",
          title: "Hook-error correlated noise",
          description:
            "Inject two-qubit hook errors and see which decoder absorbs correlated Y chains.",
        },
      ],
      {
        key: "capstone",
        title: "Decoder bake-off",
        description:
          "Pick MWPM or neural for a 17-qubit patch given p, latency budget, and hook-error rate.",
      },
    ),
  },
  {
    slug: "rydberg-cz-compilation",
    title: "Neutral-atom Rydberg CZ compilation",
    category: "Engineering",
    summary:
      "Compile CZ layers onto a tweezer array with blockade radius, AOD moves, and Rydberg pulse envelopes.",
    description:
      "Map a small QAOA instance onto an analog Rydberg processor: placement, transport, and blockade CZ.",
    goal: "Schedule a 6-qubit CZ layer that respects blockade and AOD path constraints.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Tweezer array geometry",
        description:
          "Place six rubidium atoms on a 3x2 lattice and set the Rydberg blockade radius in micrometers.",
      },
      [
        {
          key: "blockade",
          title: "Blockade CZ Hamiltonian",
          description:
            "Write the two-atom Rydberg Hamiltonian and the pulse that implements a CZ up to local phases.",
        },
        {
          key: "envelope",
          title: "Global pulse envelope",
          description:
            "Shape a global 480 nm Rydberg pulse to keep off-resonant scattering below a set infidelity.",
        },
        {
          key: "crosstalk",
          title: "Spectator blockade crosstalk",
          description:
            "Estimate unwanted phase on a third atom sitting inside 1.2 blockade radii.",
        },
      ],
      [
        {
          key: "aod",
          title: "AOD rearrangement paths",
          description:
            "Plan acousto-optic deflector moves that sort atoms without crossing occupied traps.",
        },
        {
          key: "qaoa",
          title: "QAOA edge mapping",
          description:
            "Assign MaxCut edges to CZ slots so each layer uses parallel blockade pairs.",
        },
        {
          key: "idle",
          title: "Idle dephasing during moves",
          description:
            "Budget T2* during transport and decide when to echo vs leave atoms parked.",
        },
      ],
      {
        key: "capstone",
        title: "Compile one QAOA layer",
        description:
          "Emit a move+pulse schedule for one QAOA mixer/cost layer on the six-atom array.",
      },
    ),
  },
  {
    slug: "gaussian-boson-vibronic",
    title: "Gaussian boson sampling for vibronic spectra",
    category: "Science",
    summary:
      "Use GBS to approximate Franck–Condon factors for a small molecule’s vibronic spectrum.",
    description:
      "Connect squeezed photonic modes to Duschinsky rotations and sampled Franck–Condon intensities.",
    goal: "Reproduce a three-mode vibronic band shape from a GBS circuit.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Franck–Condon and Duschinsky",
        description:
          "Write the Duschinsky rotation that mixes ground- and excited-state normal modes.",
      },
      [
        {
          key: "squeeze",
          title: "Squeezed vacuum encoding",
          description:
            "Map Huang–Rhys displacements onto single-mode squeezing parameters in a GBS circuit.",
        },
        {
          key: "interferometer",
          title: "Linear optical interferometer",
          description:
            "Compile the Duschinsky matrix into a Reck or Clements mesh of beamsplitters.",
        },
        {
          key: "hafnian",
          title: "Hafnian probabilities",
          description:
            "Relate photon-click patterns to hafnians of submatrices of the covariance matrix.",
        },
      ],
      [
        {
          key: "molecule",
          title: "Three-mode test molecule",
          description:
            "Take a toy SO2-like vibronic model with three frequencies and a known Duschinsky matrix.",
        },
        {
          key: "loss",
          title: "Photon loss and thresholding",
          description:
            "Fold uniform loss into the covariance matrix and compare threshold vs PNR detection.",
        },
        {
          key: "spectrum",
          title: "Band-shape reconstruction",
          description:
            "Histogram sampled click patterns into a vibronic intensity envelope vs wavenumber.",
        },
      ],
      {
        key: "capstone",
        title: "Match a reference spectrum",
        description:
          "Tune squeezing and loss until the sampled envelope matches a classical Franck–Condon sum.",
      },
    ),
  },
  {
    slug: "majorana-nanowire-braiding",
    title: "Majorana nanowire braiding protocols",
    category: "Science",
    summary:
      "Braid MZMs in a semiconductor-superconductor nanowire T-junction and track the parity qubit.",
    description:
      "Follow Kitaev-chain zero modes through a measurement-only or physical braid on a T-junction.",
    goal: "Write a braid sequence that implements a logical Clifford on two nanowire qubits.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Kitaev chain zero modes",
        description:
          "Solve a 1D p-wave wire and locate Majorana operators at the ends as a function of mu and Delta.",
      },
      [
        {
          key: "tjunction",
          title: "T-junction geometry",
          description:
            "Couple three nanowires and define the three pairwise tunnel couplings used for a braid.",
        },
        {
          key: "adiabatic",
          title: "Adiabatic exchange",
          description:
            "Ramp tunnel couplings so two MZMs exchange while remaining in the degenerate ground space.",
        },
        {
          key: "diabatic",
          title: "Diabatic leakage",
          description:
            "Estimate leakage out of the computational space when the ramp is faster than the gap.",
        },
      ],
      [
        {
          key: "parity",
          title: "Fermion parity readout",
          description:
            "Measure joint parity of two MZMs with a quantum-dot interferometer without collapsing the braid.",
        },
        {
          key: "measurement-only",
          title: "Measurement-only braid",
          description:
            "Replace physical transport with a sequence of parity measurements and feed-forward Paulis.",
        },
        {
          key: "clifford",
          title: "Braids as Cliffords",
          description:
            "Identify which braid word implements S vs CNOT on the encoded nanowire qubits.",
        },
      ],
      {
        key: "capstone",
        title: "Two-qubit braid program",
        description:
          "Write an explicit coupling schedule or measurement word for a logical CNOT.",
      },
    ),
  },
  {
    slug: "prime-editing-pegrna",
    title: "CRISPR prime-editing pegRNA design",
    category: "Health",
    summary:
      "Design pegRNAs for a pathogenic SNP: PBS, RTT, nicking sgRNA, and off-target screens.",
    description:
      "Walk a PE2/PE3 design for a single-base correction, including flap resolution and mismatch repair.",
    goal: "Ship a pegRNA pair predicted to install one therapeutic SNP with low bystander edits.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Pathogenic SNP context",
        description:
          "Pick a coding SNP, read local sequence, and decide PE2 vs PE3 based on nick placement.",
      },
      [
        {
          key: "pbs",
          title: "PBS length scan",
          description:
            "Sweep primer-binding site lengths 8–16 nt and score Tm against the nicked target strand.",
        },
        {
          key: "rtt",
          title: "RTT with the edit",
          description:
            "Encode the desired SNP in the reverse transcription template and check nearby synonymous options.",
        },
        {
          key: "flap",
          title: "3' flap equilibrium",
          description:
            "Model 5' vs 3' flap competition and how PBS/RTT length biases incorporation.",
        },
      ],
      [
        {
          key: "nick",
          title: "PE3 nicking sgRNA",
          description:
            "Place a nick 40–100 bp away on the opposite strand to bias MMR toward the edit.",
        },
        {
          key: "offtarget",
          title: "Cas9 off-target screen",
          description:
            "Run Cas-OFFinder / CIRCLE-seq style candidates for both pegRNA and nicking guides.",
        },
        {
          key: "bystander",
          title: "Bystander and indel risk",
          description:
            "Score nearby RTT mismatches that could install extra substitutions or frameshifts.",
        },
      ],
      {
        key: "capstone",
        title: "Locked pegRNA pair",
        description:
          "Choose PBS, RTT, and nicking sgRNA with predicted edit rate vs bystander tradeoff.",
      },
    ),
  },
  {
    slug: "lnp-endosomal-escape",
    title: "mRNA LNP endosomal escape",
    category: "Health",
    summary:
      "Tune ionizable lipid pKa, helper lipid, and PEG-lipid so mRNA cargo leaves the endosome.",
    description:
      "Follow an LNP from ApoE binding through endocytosis to pH-triggered membrane disruption.",
    goal: "Specify a lipid molar ratio that raises endosomal escape without wrecking circulation time.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Four-component LNP",
        description:
          "Name ionizable lipid, DSPC, cholesterol, and PEG-lipid and their typical molar percentages.",
      },
      [
        {
          key: "pka",
          title: "Ionizable lipid pKa",
          description:
            "Set apparent pKa near 6.2–6.5 so the particle is neutral in blood and cationic in endosomes.",
        },
        {
          key: "apoe",
          title: "ApoE opsonization",
          description:
            "Track apolipoprotein E binding and LDL-receptor uptake into hepatocytes.",
        },
        {
          key: "hexagonal",
          title: "Hexagonal HII transition",
          description:
            "Link endosomal acidification to inverted hexagonal phase and membrane rupture.",
        },
      ],
      [
        {
          key: "peg",
          title: "PEG-lipid desorption",
          description:
            "Choose PEG-lipid chain length so stealth coating sheds after injection but not too fast.",
        },
        {
          key: "size",
          title: "70–100 nm sizing",
          description:
            "Use microfluidic mixing parameters that land hydrodynamic diameter in the hepatocyte window.",
        },
        {
          key: "toxicity",
          title: "Innate sensing vs dose",
          description:
            "Balance ionizable lipid dose against TLR and complement activation in a first-in-human range.",
        },
      ],
      {
        key: "capstone",
        title: "Escape-optimized recipe",
        description:
          "Write a molar ratio and pKa target for a liver-tropic mRNA LNP with a stated circulation half-life.",
      },
    ),
  },
  {
    slug: "visium-hd-deconvolution",
    title: "Visium HD cell-type deconvolution",
    category: "Health",
    summary:
      "Deconvolve 2 µm Visium HD bins into cell types using a scRNA-seq reference and spatial smoothing.",
    description:
      "Build a reference, run RCTD/cell2location-style inference, and check bin-level doublets.",
    goal: "Produce a spatial cell-type map of a tissue section with calibrated mixing fractions.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Visium HD bin grid",
        description:
          "Read 2 µm bins, UMI counts, and how bins relate to single-cell diameter.",
      },
      [
        {
          key: "reference",
          title: "scRNA-seq reference atlas",
          description:
            "Select a matching tissue atlas and filter to marker genes that survive spatial capture.",
        },
        {
          key: "rctd",
          title: "RCTD mixing model",
          description:
            "Fit per-bin cell-type weights with a Poisson or negative-binomial observation model.",
        },
        {
          key: "doublet",
          title: "Bin doublet detection",
          description:
            "Flag bins whose residuals look like two cell types stacked through the section thickness.",
        },
      ],
      [
        {
          key: "smooth",
          title: "Spatial total-variation",
          description:
            "Add a neighbor penalty so mixing fractions do not speckle across epithelium.",
        },
        {
          key: "batch",
          title: "Platform gene dropout",
          description:
            "Correct for genes present in scRNA-seq but dropped on the spatial assay.",
        },
        {
          key: "validate",
          title: "IF marker overlay",
          description:
            "Compare deconvolved epithelium vs an immunofluorescence cytokeratin mask.",
        },
      ],
      {
        key: "capstone",
        title: "Tissue cell-type map",
        description:
          "Export a calibrated spatial map and a QC report of bins you refuse to call.",
      },
    ),
  },
  {
    slug: "alphafold3-ligand-pose",
    title: "AlphaFold 3 ligand pose ranking",
    category: "Science",
    summary:
      "Rank AF3 poses for a small-molecule ligand using ipTM, clash, and experimental density.",
    description:
      "Run AF3 on a protein–ligand complex and score poses against crystallographic or cryo-EM density.",
    goal: "Accept or reject the top AF3 pose for a kinase inhibitor with a stated confidence rule.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "AF3 complex input",
        description:
          "Assemble protein sequence, CCD ligand, and MSA settings for a kinase–inhibitor job.",
      },
      [
        {
          key: "iptm",
          title: "ipTM and pocket pLDDT",
          description:
            "Read interface pTM and residue pLDDT in the binding pocket as pose confidence.",
        },
        {
          key: "clash",
          title: "Steric clash and chirality",
          description:
            "Filter poses with ligand–protein clashes or inverted stereocenters.",
        },
        {
          key: "seed",
          title: "Seed diversity",
          description:
            "Compare five seeds and cluster poses by pocket RMSD before ranking.",
        },
      ],
      [
        {
          key: "density",
          title: "Real-space density fit",
          description:
            "If a map exists, compute RSCC of the ligand in the AF3 frame vs the experimental pocket.",
        },
        {
          key: "physics",
          title: "Short MD relaxation",
          description:
            "Relax the top pose 2 ns in explicit solvent and watch ligand RMSD drift.",
        },
        {
          key: "decoy",
          title: "Decoy pose controls",
          description:
            "Score a known wrong binder from a sibling kinase as a negative control.",
        },
      ],
      {
        key: "capstone",
        title: "Pose accept/reject",
        description:
          "Apply an ipTM + clash + RSCC rule and keep or discard the top AF3 pose.",
      },
    ),
  },
  {
    slug: "cryoem-topaz-picking",
    title: "Cryo-EM Topaz particle picking",
    category: "Science",
    summary:
      "Train Topaz on a few labeled micrographs and pick a membrane-protein particle set for Relion.",
    description:
      "Go from motion-corrected micrographs to a cleaned particle stack using Topaz and 2D class QC.",
    goal: "Deliver a particle stack whose 2D classes show secondary-structure features.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Motion-corrected micrographs",
        description:
          "Inspect dose-weighted averages, ice thickness, and CTF fits before picking.",
      },
      [
        {
          key: "labels",
          title: "Sparse manual labels",
          description:
            "Box 200 particles on 10 micrographs, including hard ice and carbon-edge views.",
        },
        {
          key: "train",
          title: "Topaz CNN train",
          description:
            "Train the residual CNN with a chosen downsample factor and expected particle diameter.",
        },
        {
          key: "extract",
          title: "Extract and denoise",
          description:
            "Extract boxes, run Topaz denoise, and export coordinates to Relion STAR.",
        },
      ],
      [
        {
          key: "threshold",
          title: "Score threshold sweep",
          description:
            "Sweep the Topaz log-likelihood cutoff against false positives on carbon film.",
        },
        {
          key: "2d",
          title: "2D class QC",
          description:
            "Run 2D classification and junk classes that are ice, carbon, or broken particles.",
        },
        {
          key: "orientation",
          title: "Preferred orientation",
          description:
            "Check Euler histograms for a missing cone before committing to 3D.",
        },
      ],
      {
        key: "capstone",
        title: "Clean particle stack",
        description:
          "Freeze a picking threshold and a 2D-cleaned stack ready for ab initio 3D.",
      },
    ),
  },
  {
    slug: "perovskite-tandem-ion-migration",
    title: "Perovskite tandem ion-migration control",
    category: "Engineering",
    summary:
      "Slow halide migration in a perovskite/silicon tandem with additives, contacts, and bias protocols.",
    description:
      "Connect vacancy-mediated ion drift to hysteresis, phase segregation, and field-driven degradation.",
    goal: "Specify a stack and preconditioning protocol that holds Voc after 100 h light soak.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Tandem stack cross-section",
        description:
          "Draw perovskite on textured silicon with C60, SnO2, and IZO recombination layers.",
      },
      [
        {
          key: "vacancies",
          title: "Iodide vacancy drift",
          description:
            "Write the Nernst–Planck flux for I− vacancies under 1-sun photovoltage.",
        },
        {
          key: "hysteresis",
          title: "J–V hysteresis",
          description:
            "Link scan-rate hysteresis to ion pile-up at the electron-transport interface.",
        },
        {
          key: "segregation",
          title: "Photoinduced halide segregation",
          description:
            "Track Br/I demixing under illumination in a mixed-halide wide-gap cell.",
        },
      ],
      [
        {
          key: "additive",
          title: "Potassium and PEA additives",
          description:
            "Place K+ and phenethylammonium at grain boundaries to pin vacancies.",
        },
        {
          key: "contact",
          title: "Self-assembled monolayer contact",
          description:
            "Use a Me-4PACz SAM on ITO/IZO to cut interfacial ion sinks.",
        },
        {
          key: "bias",
          title: "Light-soak bias protocol",
          description:
            "Choose MPP vs Voc hold during a 100 h ISOS-L-1 style soak.",
        },
      ],
      {
        key: "capstone",
        title: "Stable tandem recipe",
        description:
          "Lock additive, SAM, and soak protocol for a target Voc retention.",
      },
    ),
  },
  {
    slug: "lithium-metal-dendrites",
    title: "Lithium-metal dendrite suppression",
    category: "Engineering",
    summary:
      "Design a solid-electrolyte interface that blocks mossy lithium at 1 mA/cm² stripping/plating.",
    description:
      "Connect Sand’s time, SEI mechanics, and stack pressure to dendrite onset in anode-free cells.",
    goal: "Pick electrolyte, pressure, and current density that delay dendrites past 200 cycles.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Anode-free pouch cell",
        description:
          "Start from a copper collector and NMC cathode with no excess lithium inventory.",
      },
      [
        {
          key: "sand",
          title: "Sand’s time and depletion",
          description:
            "Compute the time to cation depletion at the interface for a given D and J.",
        },
        {
          key: "mossy",
          title: "Mossy vs needle growth",
          description:
            "Distinguish root-growing mossy lithium from tip-growing needles in cryo-SEM language.",
        },
        {
          key: "sei",
          title: "SEI modulus and thickness",
          description:
            "Estimate whether a 20 nm LiF-rich SEI can mechanically suppress protrusion.",
        },
      ],
      [
        {
          key: "electrolyte",
          title: "Localized high-concentration electrolyte",
          description:
            "Formulate an LHCE with a fluorinated diluent that yields LiF-rich SEI.",
        },
        {
          key: "pressure",
          title: "Stack pressure window",
          description:
            "Set 0.5–2 MPa uniaxial pressure without crushing the porous cathode.",
        },
        {
          key: "pulse",
          title: "Pulsed plating",
          description:
            "Use off-time to relax concentration gradients and compare with DC 1 mA/cm².",
        },
      ],
      {
        key: "capstone",
        title: "200-cycle protocol",
        description:
          "Write electrolyte, pressure, and current waveform for a 200-cycle dendrite budget.",
      },
    ),
  },
  {
    slug: "dac-amine-sorbent-cycling",
    title: "Direct-air-capture amine sorbent cycling",
    category: "Engineering",
    summary:
      "Cycle a solid amine sorbent for DAC: uptake at 400 ppm, steam desorption, and oxidative aging.",
    description:
      "Size a contactor around amine efficiency, humidity, and the steam energy to regenerate.",
    goal: "Quote kWh/tCO2 and cycle life for a packed-bed amine DAC module.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "400 ppm capture target",
        description:
          "Write the working capacity between 400 ppm adsorption and steam-regeneration partial pressure.",
      },
      [
        {
          key: "isotherm",
          title: "Toth isotherm fit",
          description:
            "Fit a Toth isotherm to 400 ppm vs 5% CO2 data at 25 °C and 80 °C.",
        },
        {
          key: "humidity",
          title: "Water co-adsorption",
          description:
            "Account for amine hydration that both helps carbamate formation and costs steam.",
        },
        {
          key: "steam",
          title: "Steam desorption duty",
          description:
            "Compute latent heat plus sensible heat to lift the bed from 25 °C to 110 °C.",
        },
      ],
      [
        {
          key: "oxidation",
          title: "Oxidative amine aging",
          description:
            "Model O2-driven urea and nitrosamine formation over 1000 cycles.",
        },
        {
          key: "contactor",
          title: "Packed-bed pressure drop",
          description:
            "Size pellet diameter so fan work stays below a set fraction of total energy.",
        },
        {
          key: "lca",
          title: "kWh per tonne CO2",
          description:
            "Roll steam, fans, and vacuum into a specific energy and compare to 1 t/day module.",
        },
      ],
      {
        key: "capstone",
        title: "Module spec sheet",
        description:
          "Publish working capacity, kWh/t, and replacement interval for the amine bed.",
      },
    ),
  },
  {
    slug: "tokamak-ece-disruption",
    title: "Tokamak disruption prediction from ECE",
    category: "Science",
    summary:
      "Use electron-cyclotron emission channels to warn on locked modes before a disruption.",
    description:
      "Turn ECE radiometer time series into a disruption alarm with physics-informed features.",
    goal: "Set a locked-mode alarm that fires ≥50 ms before current quench on a training shot.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "ECE radiometer channels",
        description:
          "Map frequency channels to major-radius locations on a tokamak midplane.",
      },
      [
        {
          key: "te",
          title: "Te profile collapse",
          description:
            "Detect a flattening Te profile that signals an island overlapping the q=2 surface.",
        },
        {
          key: "locked",
          title: "Locked-mode precursor",
          description:
            "Track n=1 radial field and ECE modulation as the mode locks to the wall.",
        },
        {
          key: "alarm",
          title: "50 ms warning budget",
          description:
            "Place the alarm relative to current-quench start using a labeled shot database.",
        },
      ],
      [
        {
          key: "features",
          title: "Physics feature set",
          description:
            "Build features: Te peaking, ECE variance, Mirnov n=1 amplitude, and loop voltage.",
        },
        {
          key: "model",
          title: "Sequence classifier",
          description:
            "Train a temporal CNN or HMM on those features without leaking post-quench samples.",
        },
        {
          key: "false",
          title: "False-alarm vs missed quench",
          description:
            "Sweep threshold on a hold-out campaign and report both error types.",
        },
      ],
      {
        key: "capstone",
        title: "Shot-ready alarm",
        description:
          "Freeze features, model, and threshold for a ≥50 ms locked-mode warning.",
      },
    ),
  },
  {
    slug: "silicon-photonic-thermo-optic",
    title: "Silicon photonic thermo-optic shifters",
    category: "Engineering",
    summary:
      "Design TiN heaters on a silicon MZI so a π phase shift lands under a thermal crosstalk budget.",
    description:
      "Size heater geometry, undercut, and drive electronics for a foundry silicon photonic MZI.",
    goal: "Specify heater power for π shift with nearest-neighbor crosstalk below 0.05π.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "MZI phase shifter",
        description:
          "Place a TiN heater over one arm of a silicon strip waveguide MZI.",
      },
      [
        {
          key: "dn_dt",
          title: "Thermo-optic coefficient",
          description:
            "Use silicon dn/dT to convert a waveguide temperature rise into optical phase.",
        },
        {
          key: "undercut",
          title: "Deep undercut isolation",
          description:
            "Etch oxide under the heater to cut substrate heat sinking and power.",
        },
        {
          key: "pi",
          title: "Pπ measurement",
          description:
            "Sweep heater current until the MZI fringe shifts by π and record Pπ.",
        },
      ],
      [
        {
          key: "crosstalk",
          title: "Neighbor thermal crosstalk",
          description:
            "Simulate a 50 µm pitch and the phase induced in the next MZI arm.",
        },
        {
          key: "time",
          title: "Thermal time constant",
          description:
            "Measure 10–90% rise time; undercut slows the shifter into the kHz range.",
        },
        {
          key: "driver",
          title: "PWM heater driver",
          description:
            "Drive the TiN with PWM so DAC resolution maps onto phase without DC drift.",
        },
      ],
      {
        key: "capstone",
        title: "Shifter spec",
        description:
          "Lock Pπ, crosstalk, and bandwidth for a foundry-compatible thermo-optic element.",
      },
    ),
  },
  {
    slug: "riscv-vector-gemm",
    title: "RISC-V vector kernels for GEMM",
    category: "Engineering",
    summary:
      "Write an RVV kernel for mixed-precision GEMM with LMUL, SEW, and register blocking.",
    description:
      "Map a matrix multiply onto RISC-V Vector 1.0 with tail-agnostic loops and cache tiling.",
    goal: "Beat scalar GEMM on a 256-bit VLEN core for 128×128 fp16×fp32 accumulate.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "RVV 1.0 programming model",
        description:
          "Set SEW, LMUL, and vl for a strip-mined inner product that is tail-agnostic.",
      },
      [
        {
          key: "lmul",
          title: "LMUL register groups",
          description:
            "Group vector registers so a 4×LMUL tile holds a panel of A without reload.",
        },
        {
          key: "fma",
          title: "Widening FMA",
          description:
            "Use widening multiply-add from fp16 to fp32 accumulators where the extension allows.",
        },
        {
          key: "tail",
          title: "Tail-agnostic remainder",
          description:
            "Handle n not divisible by vl without a scalar cleanup that kills the pipeline.",
        },
      ],
      [
        {
          key: "tile",
          title: "L1/L2 tiling",
          description:
            "Choose mc, nc, kc so A, B panels stay in L1 on a 32 KiB data cache.",
        },
        {
          key: "pred",
          title: "Masked stores",
          description:
            "Use vtype and mask registers for edge tiles instead of overrunning C.",
        },
        {
          key: "bench",
          title: "Roofline check",
          description:
            "Compare achieved FLOP/s to arithmetic intensity vs DRAM bandwidth on the board.",
        },
      ],
      {
        key: "capstone",
        title: "128×128 kernel",
        description:
          "Ship an RVV GEMM that beats scalar on 128×128 fp16 with a measured speedup.",
      },
    ),
  },
  {
    slug: "ckks-bootstrapping",
    title: "CKKS homomorphic bootstrapping",
    category: "Math",
    summary:
      "Refresh CKKS ciphertext noise with homomorphic sine evaluation and coefficient-to-slot maps.",
    description:
      "Walk one CKKS bootstrap: modulus, CoeffToSlot, approximate sine, SlotToCoeff, and rescale.",
    goal: "State a parameter set that bootstraps a ciphertext with remaining levels for one matmul.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "CKKS encoding and noise",
        description:
          "Encode a real vector as a polynomial and track the noise budget after multiplies.",
      },
      [
        {
          key: "cts",
          title: "CoeffToSlot transform",
          description:
            "Apply the homomorphic DFT that moves coefficients into SIMD slots.",
        },
        {
          key: "sine",
          title: "Approximate modular sine",
          description:
            "Evaluate a scaled sine polynomial that folds the message back into (−1,1).",
        },
        {
          key: "stc",
          title: "SlotToCoeff transform",
          description:
            "Invert the DFT so the refreshed message sits in coefficients again.",
        },
      ],
      [
        {
          key: "modulus",
          title: "Modulus chain",
          description:
            "Pick a tower of primes so bootstrap consumes levels but leaves one multiply.",
        },
        {
          key: "precision",
          title: "Bootstrapping precision",
          description:
            "Measure bits of remaining precision after sine approximation and rescaling.",
        },
        {
          key: "n",
          title: "Ring dimension vs slots",
          description:
            "Choose N so slot count fits the vector and bootstrap still finishes in seconds.",
        },
      ],
      {
        key: "capstone",
        title: "Matmul-ready parameters",
        description:
          "Publish N, modulus chain, and scale for bootstrap-then-one-matmul.",
      },
    ),
  },
  {
    slug: "stark-fri-proximity",
    title: "STARK FRI proximity proofs",
    category: "Math",
    summary:
      "Build a FRI low-degree test for a STARK: Reed–Solomon code, folding, and query soundness.",
    description:
      "From an execution trace to a FRI proof that a committed polynomial is close to degree d.",
    goal: "Set blowup, folding factor, and queries for 100-bit soundness on a small AIR.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "AIR execution trace",
        description:
          "Write a tiny algebraic intermediate representation and interpolate the trace polynomial.",
      },
      [
        {
          key: "rs",
          title: "Reed–Solomon blowup",
          description:
            "Evaluate on a domain 2×–16× larger than degree and commit with a Merkle tree.",
        },
        {
          key: "fold",
          title: "FRI folding round",
          description:
            "Fold even/odd coefficients with a verifier challenge to halve degree each round.",
        },
        {
          key: "query",
          title: "Query phase",
          description:
            "Open Merkle paths at folded positions and check consistency with the next layer.",
        },
      ],
      [
        {
          key: "soundness",
          title: "Proximity soundness",
          description:
            "Bound the probability a far polynomial still passes FRI given blowup and queries.",
        },
        {
          key: "pow",
          title: "Proof-of-work grinding",
          description:
            "Add a grinding parameter so the prover cannot cheaply resample challenges.",
        },
        {
          key: "hash",
          title: "Hash and field choice",
          description:
            "Pick a small Goldilocks-style field and a STARK-friendly hash for the Merkle tree.",
        },
      ],
      {
        key: "capstone",
        title: "100-bit FRI parameters",
        description:
          "Lock blowup, folding, queries, and grinding for 100-bit soundness on the toy AIR.",
      },
    ),
  },
  {
    slug: "loihi-stdp-credit",
    title: "Loihi STDP credit assignment",
    category: "AI & ML",
    summary:
      "Assign credit with spike-timing-dependent plasticity on an Intel Loihi 2 neuromorphic mesh.",
    description:
      "Map a small SNN onto Loihi cores: compartments, traces, and on-chip STDP updates.",
    goal: "Train a two-layer SNN on-chip to separate two Poisson-rate classes.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Loihi 2 compartment",
        description:
          "Configure a current-based LIF compartment with synaptic and voltage traces.",
      },
      [
        {
          key: "stdp",
          title: "Pair-based STDP rule",
          description:
            "Implement a pre/post trace STDP window with A+ and A− on the neuromorphic core.",
        },
        {
          key: "mesh",
          title: "Core mesh mapping",
          description:
            "Place two layers across neurocores without saturating axon fan-in.",
        },
        {
          key: "rates",
          title: "Poisson rate codes",
          description:
            "Encode two classes as 20 Hz vs 80 Hz spike trains over 200 ms.",
        },
      ],
      [
        {
          key: "homeo",
          title: "Firing-rate homeostasis",
          description:
            "Add a slow bias adaptation so weights do not explode under STDP.",
        },
        {
          key: "offchip",
          title: "Off-chip vs on-chip learning",
          description:
            "Compare Loihi on-chip STDP with a GPU surrogate-gradient baseline.",
        },
        {
          key: "energy",
          title: "pJ per synaptic event",
          description:
            "Read Loihi energy counters and quote pJ/SOP for the trained net.",
        },
      ],
      {
        key: "capstone",
        title: "Two-class on-chip net",
        description:
          "Report accuracy and energy for the STDP-trained two-layer SNN.",
      },
    ),
  },
  {
    slug: "riemannian-score-diffusion",
    title: "Riemannian score-based diffusion",
    category: "AI & ML",
    summary:
      "Train a score model on a manifold (SO(3) or a sphere) with the correct Riemannian SDE.",
    description:
      "Replace Euclidean DDPM with a manifold SDE, heat kernel, and projected score network.",
    goal: "Sample rotations from a learned SO(3) score model that match a wrapped-normal target.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Manifold forward SDE",
        description:
          "Write Brownian motion on SO(3) or S² and the corresponding Fokker–Planck operator.",
      },
      [
        {
          key: "kernel",
          title: "Heat kernel on SO(3)",
          description:
            "Use the closed-form heat kernel (or a truncation) as the perturbation kernel.",
        },
        {
          key: "score",
          title: "Riemannian score",
          description:
            "Define ∇log p_t in the tangent space and a network that outputs Lie-algebra vectors.",
        },
        {
          key: "proj",
          title: "Exponential-map steps",
          description:
            "Integrate the reverse SDE with Exp maps so samples stay on the manifold.",
        },
      ],
      [
        {
          key: "target",
          title: "Wrapped-normal target",
          description:
            "Build a mixture of wrapped normals on SO(3) as the data distribution.",
        },
        {
          key: "loss",
          title: "Denoising score matching",
          description:
            "Train with denoising score matching using the manifold heat kernel.",
        },
        {
          key: "eval",
          title: "Geodesic MMD",
          description:
            "Evaluate samples with an MMD that uses geodesic distance, not chordal Euclidean.",
        },
      ],
      {
        key: "capstone",
        title: "SO(3) sampler",
        description:
          "Show samples from the reverse SDE matching the wrapped-normal mixture.",
      },
    ),
  },
  {
    slug: "sae-circuit-discovery",
    title: "Sparse autoencoder circuit discovery",
    category: "AI & ML",
    summary:
      "Train an SAE on residual-stream activations and stitch features into a circuit for a behavior.",
    description:
      "From activations to dictionary features to a causal circuit on a small transformer.",
    goal: "Name a sparse feature circuit that is necessary for a chosen IOI-style behavior.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Residual-stream dump",
        description:
          "Cache residual activations at a chosen layer on a prompt set that isolates the behavior.",
      },
      [
        {
          key: "sae",
          title: "Top-k sparse autoencoder",
          description:
            "Train a Top-k SAE with a reconstruction + sparsity objective on those activations.",
        },
        {
          key: "features",
          title: "Feature interpretation",
          description:
            "Read max-activating examples and name features that look like names, positions, or copies.",
        },
        {
          key: "causal",
          title: "Activation patching",
          description:
            "Patch SAE latents between clean and corrupted prompts to test necessity.",
        },
      ],
      [
        {
          key: "graph",
          title: "Feature-to-feature graph",
          description:
            "Estimate directed influence between latents across two layers.",
        },
        {
          key: "ioi",
          title: "Indirect object identification",
          description:
            "Reproduce a miniature IOI circuit in SAE feature space rather than attention heads.",
        },
        {
          key: "dead",
          title: "Dead latents",
          description:
            "Resample unused dictionary atoms so the circuit is not carried by dead features.",
        },
      ],
      {
        key: "capstone",
        title: "Named circuit",
        description:
          "Publish the latents, patch scores, and a diagram for the IOI-style behavior.",
      },
    ),
  },
  {
    slug: "sentinel1-insar-glacier",
    title: "Sentinel-1 InSAR glacier velocity",
    category: "Science",
    summary:
      "Form Sentinel-1 interferograms over a glacier and invert line-of-sight phase to ice velocity.",
    description:
      "From SLC pairs through coherence, unwrapping, and a velocity time series on a mountain glacier.",
    goal: "Produce a 12-day ice-velocity map with a stated coherence mask.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Sentinel-1 SLC pair",
        description:
          "Select an IW pair with a 12-day baseline over a temperate glacier.",
      },
      [
        {
          key: "coreg",
          title: "Coregistration and ESD",
          description:
            "Coregister bursts with enhanced spectral diversity so azimuth error stays sub-pixel.",
        },
        {
          key: "ifg",
          title: "Interferogram and multilook",
          description:
            "Form the interferogram, multilook, and inspect fringes on moving ice.",
        },
        {
          key: "coh",
          title: "Coherence mask",
          description:
            "Mask pixels below a coherence threshold where unwrapping would be fiction.",
        },
      ],
      [
        {
          key: "unwrap",
          title: "SNAPHU unwrapping",
          description:
            "Unwrap LOS phase with SNAPHU and check for 2π jumps at shear margins.",
        },
        {
          key: "geo",
          title: "Geocode to velocity",
          description:
            "Convert LOS displacement over 12 days into a ground-range velocity field.",
        },
        {
          key: "atm",
          title: "Tropospheric delay",
          description:
            "Use a GACOS or ERA5 screen so wet delay is not mistaken for surge.",
        },
      ],
      {
        key: "capstone",
        title: "12-day velocity map",
        description:
          "Export a geocoded velocity GeoTIFF with coherence and troposphere notes.",
      },
    ),
  },
  {
    slug: "toggle-switch-inference",
    title: "Genetic toggle-switch parameter inference",
    category: "Health",
    summary:
      "Infer repressilator/toggle parameters from flow-cytometry snapshots with an SDE or CME model.",
    description:
      "Fit a mutually repressing two-gene switch to bimodal flow data, including noise and growth.",
    goal: "Recover repression strengths that reproduce the observed ON/OFF well depths.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Gardner toggle topology",
        description:
          "Write two mutually repressing genes with Hill repression and basal leak.",
      },
      [
        {
          key: "sde",
          title: "Chemical Langevin",
          description:
            "Turn the ODE into an SDE whose noise scales with copy number.",
        },
        {
          key: "bimodal",
          title: "Bimodal flow snapshots",
          description:
            "Read two-color flow histograms that show ON and OFF wells after IPTG washout.",
        },
        {
          key: "abc",
          title: "ABC or MCMC fit",
          description:
            "Infer Hill coefficients and leak rates against histogram summaries.",
        },
      ],
      [
        {
          key: "growth",
          title: "Dilution by growth",
          description:
            "Include protein dilution at the measured doubling time so wells are not fictitious.",
        },
        {
          key: "switching",
          title: "Mean first-passage time",
          description:
            "Compute switching time between wells and compare to time-lapse movies.",
        },
        {
          key: "ident",
          title: "Parameter identifiability",
          description:
            "Show which Hill parameters collapse and which are pinned by the data.",
        },
      ],
      {
        key: "capstone",
        title: "Inferred switch",
        description:
          "Report posterior repression parameters and predicted switching times.",
      },
    ),
  },
  {
    slug: "cuprate-d-wave-pairing",
    title: "High-Tc cuprate d-wave pairing",
    category: "Science",
    summary:
      "Connect ARPES, phase-sensitive junctions, and a t–J model to d_{x²−y²} pairing in cuprates.",
    description:
      "Build the case for d-wave order from gap nodes, corner SQUIDs, and a doped Mott insulator.",
    goal: "Write a d-wave gap function consistent with ARPES nodes and a π phase shift.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "CuO2 plane and doping",
        description:
          "Start from a doped Mott insulator on the copper–oxygen plane.",
      },
      [
        {
          key: "arpes",
          title: "ARPES gap nodes",
          description:
            "Read the d-wave nodes along the zone diagonal in Bi-2212 ARPES.",
        },
        {
          key: "junction",
          title: "Corner-junction π shift",
          description:
            "Explain the half-flux quantum in a YBCO corner SQUID as a d-wave phase test.",
        },
        {
          key: "tj",
          title: "t–J pairing glue",
          description:
            "Sketch how antiferromagnetic exchange in the t–J model favors d-wave singlets.",
        },
      ],
      [
        {
          key: "pseudogap",
          title: "Pseudogap vs superconducting gap",
          description:
            "Separate the antinodal pseudogap from the nodal superconducting gap.",
        },
        {
          key: "isotope",
          title: "Weak isotope effect",
          description:
            "Contrast cuprate isotope exponents with phonon-driven s-wave BCS.",
        },
        {
          key: "gapfn",
          title: "Δ(k) = Δ0 (cos kx − cos ky)",
          description:
            "Write the lattice d-wave gap and its nodes on the Fermi surface.",
        },
      ],
      {
        key: "capstone",
        title: "d-wave case file",
        description:
          "Combine ARPES, SQUID, and t–J into one d-wave pairing statement.",
      },
    ),
  },
  {
    slug: "ligo-matched-filter-cbc",
    title: "LIGO matched-filter CBC search",
    category: "Science",
    summary:
      "Run a compact-binary matched filter: IMRPhenom templates, PSD, and a ranking statistic.",
    description:
      "From strain to a GW150914-style candidate using a template bank and chi-squared vetoes.",
    goal: "Recover an injected 30+30 M⊙ binary above a stated false-alarm threshold.",
    blocks: eightBlockGraph(
      {
        key: "start",
        title: "Strain and PSD",
        description:
          "Whiten Hanford/Livingston strain with a measured one-sided PSD.",
      },
      [
        {
          key: "bank",
          title: "IMRPhenom template bank",
          description:
            "Place a bank in chirp-mass and mass-ratio with a minimal match of 0.97.",
        },
        {
          key: "filter",
          title: "Complex matched filter",
          description:
            "Correlate whitened strain with each template and record SNR time series.",
        },
        {
          key: "chi2",
          title: "Chi-squared veto",
          description:
            "Split the template into frequency bins and reject glitches that fail χ².",
        },
      ],
      [
        {
          key: "coinc",
          title: "Hanford–Livingston coincidence",
          description:
            "Require a time and phase consistent with light travel between sites.",
        },
        {
          key: "far",
          title: "False-alarm rate",
          description:
            "Estimate FAR from time slides and set a threshold for a candidate.",
        },
        {
          key: "inject",
          title: "Hardware-style injection",
          description:
            "Inject a 30+30 M⊙ IMR waveform and recover it through the same pipeline.",
        },
      ],
      {
        key: "capstone",
        title: "Recovered candidate",
        description:
          "Report SNR, χ², coincidence, and FAR for the recovered injection.",
      },
    ),
  },
];

export type LandingFeaturedMap = LandingFeaturedMapDef & {
  id: string;
  notesMarker: string;
  blocks: readonly (LandingFeaturedBlockDef & { id: string })[];
};

export function landingFeaturedNotesMarker(slug: string): string {
  return `${LANDING_FEATURED_NOTES_MARKER} SLUG:${slug}`;
}

export const LANDING_FEATURED_MAPS: readonly LandingFeaturedMap[] = DEFS.map((def) => ({
  ...def,
  id: landingFeaturedUuid(`workspace:${def.slug}`),
  notesMarker: landingFeaturedNotesMarker(def.slug),
  blocks: def.blocks.map((block) => ({
    ...block,
    id: landingFeaturedUuid(`block:${def.slug}:${block.key}`),
  })),
}));

export const LANDING_FEATURED_MAP_IDS: readonly string[] = LANDING_FEATURED_MAPS.map(
  (map) => map.id,
);

export function landingFeaturedMapById(id: string): LandingFeaturedMap | undefined {
  return LANDING_FEATURED_MAPS.find((map) => map.id === id);
}

export function orderLandingFeaturedMaps<T extends { id: string }>(
  items: readonly T[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of LANDING_FEATURED_MAP_IDS) {
    const item = byId.get(id);
    if (item) ordered.push(item);
  }
  return ordered;
}

export function assertLandingFeaturedCatalog(): {
  mapCount: number;
  blockCount: number;
} {
  if (LANDING_FEATURED_MAPS.length < 20) {
    throw new Error(`Need at least 20 featured maps, got ${LANDING_FEATURED_MAPS.length}`);
  }
  const slugs = new Set<string>();
  const ids = new Set<string>();
  let blockCount = 0;
  for (const map of LANDING_FEATURED_MAPS) {
    if (slugs.has(map.slug)) throw new Error(`Duplicate featured slug ${map.slug}`);
    if (ids.has(map.id)) throw new Error(`Duplicate featured id ${map.id}`);
    slugs.add(map.slug);
    ids.add(map.id);
    const starts = map.blocks.filter((block) => block.isStart);
    if (starts.length !== 1) {
      throw new Error(`${map.slug} must have exactly one start block`);
    }
    const keys = new Set(map.blocks.map((block) => block.key));
    for (const block of map.blocks) {
      if (ids.has(block.id)) throw new Error(`Duplicate block id ${block.id}`);
      ids.add(block.id);
      for (const next of block.next) {
        if (!keys.has(next)) throw new Error(`${map.slug} next ${next} missing`);
      }
    }
    blockCount += map.blocks.length;
  }
  return { mapCount: LANDING_FEATURED_MAPS.length, blockCount };
}
