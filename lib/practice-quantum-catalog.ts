/**
 * Seeded Practice library: Quantum mechanics and quantum computing.
 * Upserted by slug. No dashboard authoring UI.
 */

export type PracticeProblemSeed = {
  slug: string;
  category: string;
  subcategory: string;
  title: string;
  prompt: string;
  sortOrder: number;
  durationMinutes: number;
};

export const PRACTICE_QUANTUM_CATALOG_MARKER = "[PRACTICE:quantum-v1]";

const QM = "Quantum mechanics";
const QC = "Quantum computing";

export const PRACTICE_QUANTUM_PROBLEMS: readonly PracticeProblemSeed[] = [
  {
    slug: "qm-normalize-gaussian",
    category: QM,
    subcategory: "Wave functions",
    title: "Normalize a Gaussian packet",
    prompt:
      "A free particle on the line has wave function ψ(x) = A exp(−a x² / 2 + i k x) with a > 0. Find A so that ψ is normalized. Then compute ⟨x⟩, ⟨p⟩, and Δx. Interpret what a and k control.",
    sortOrder: 10,
    durationMinutes: 15,
  },
  {
    slug: "qm-infinite-well-superposition",
    category: QM,
    subcategory: "Wave functions",
    title: "Infinite well superposition",
    prompt:
      "A particle is in an infinite square well of width L. At t = 0 it is in the equal superposition of the ground state and first excited state. Write ψ(x,0), normalize if needed, find ψ(x,t), and compute the probability of finding the particle in the left half of the well as a function of time.",
    sortOrder: 20,
    durationMinutes: 15,
  },
  {
    slug: "qm-probability-current",
    category: QM,
    subcategory: "Wave functions",
    title: "Probability current of a traveling packet",
    prompt:
      "For a one-dimensional wave function, derive the probability current j(x,t) from the Schrödinger equation so that ∂|ψ|²/∂t + ∂j/∂x = 0. Evaluate j for a plane wave and for a real stationary bound state. What does a vanishing current mean physically?",
    sortOrder: 30,
    durationMinutes: 15,
  },
  {
    slug: "qm-hermitian-momentum",
    category: QM,
    subcategory: "Operators and measurement",
    title: "Show that p is Hermitian",
    prompt:
      "On the real line with wave functions that vanish at infinity, show that the momentum operator p = −iħ d/dx is Hermitian. Then compute the commutator [x, p] and use it to write the Heisenberg uncertainty relation for Δx Δp.",
    sortOrder: 40,
    durationMinutes: 15,
  },
  {
    slug: "qm-compatible-observables",
    category: QM,
    subcategory: "Operators and measurement",
    title: "Compatible observables",
    prompt:
      "Two observables A and B are compatible when [A, B] = 0. Explain why they then share a common eigenbasis. Give a concrete pair on a spin-1/2 particle that is compatible and a pair that is not. What does a joint measurement of incompatible observables fail to yield?",
    sortOrder: 50,
    durationMinutes: 15,
  },
  {
    slug: "qm-projective-measurement",
    category: QM,
    subcategory: "Operators and measurement",
    title: "Projective measurement on a qubit",
    prompt:
      "A spin-1/2 is in |ψ⟩ = (√3/2)|↑⟩ + (1/2)|↓⟩ along z. You measure S_z. List the possible outcomes, their probabilities, and the post-measurement states. Then compute ⟨S_z⟩ two ways: from the Born rule and as ⟨ψ|S_z|ψ⟩.",
    sortOrder: 60,
    durationMinutes: 15,
  },
  {
    slug: "qm-time-evolution-energy-basis",
    category: QM,
    subcategory: "Time evolution",
    title: "Time evolution in the energy basis",
    prompt:
      "A Hamiltonian has discrete nondegenerate energies E_n with eigenstates |n⟩. Expand an arbitrary initial state in that basis and write |ψ(t)⟩. Show that the probability of energy E_n is constant, while off-diagonal observables generally oscillate. Apply this to a two-level system with splitting ħω.",
    sortOrder: 70,
    durationMinutes: 15,
  },
  {
    slug: "qm-harmonic-oscillator-coherent",
    category: QM,
    subcategory: "Time evolution",
    title: "Coherent state of the oscillator",
    prompt:
      "For the harmonic oscillator, a coherent state |α⟩ is an eigenstate of the lowering operator a. Write |α⟩ in the number basis. Compute ⟨n⟩ and Δn. Explain why the wave packet follows the classical oscillation without spreading (in the usual sense) as time evolves.",
    sortOrder: 80,
    durationMinutes: 15,
  },
  {
    slug: "qm-ehrenfest-theorem",
    category: QM,
    subcategory: "Time evolution",
    title: "Ehrenfest theorem",
    prompt:
      "Derive d⟨x⟩/dt and d⟨p⟩/dt from the Schrödinger equation (Ehrenfest). For a potential V(x), when do the expectation values obey Newton’s law exactly? Give one potential where they do and one where they do not, and say why.",
    sortOrder: 90,
    durationMinutes: 15,
  },
  {
    slug: "qm-spin-half-pauli",
    category: QM,
    subcategory: "Spin",
    title: "Pauli matrices and S_n",
    prompt:
      "Write the Pauli matrices σ_x, σ_y, σ_z. For a unit vector n = (sin θ cos φ, sin θ sin φ, cos θ), construct S · n and find its eigenvectors in the S_z basis. Interpret θ and φ on the Bloch sphere.",
    sortOrder: 100,
    durationMinutes: 15,
  },
  {
    slug: "qm-stern-gerlach-sequence",
    category: QM,
    subcategory: "Spin",
    title: "Sequential Stern–Gerlach",
    prompt:
      "An unpolarized beam of spin-1/2 particles passes through an S_z Stern–Gerlach, then only the +ħ/2 beam through an S_x magnet, then an S_z magnet again. What fractions emerge in the final +z and −z ports? Explain why the last measurement is not determined by the first.",
    sortOrder: 110,
    durationMinutes: 15,
  },
  {
    slug: "qm-addition-of-spin",
    category: QM,
    subcategory: "Spin",
    title: "Two spin-1/2 addition",
    prompt:
      "Add two spin-1/2 angular momenta. Write the triplet and singlet states in the uncoupled |m1 m2⟩ basis. Compute S² and S_z on each. Why is the singlet antisymmetric, and what does that imply for two identical fermions in the same orbital?",
    sortOrder: 120,
    durationMinutes: 15,
  },
  {
    slug: "qc-bloch-sphere-state",
    category: QC,
    subcategory: "Qubits",
    title: "Place a qubit on the Bloch sphere",
    prompt:
      "A qubit is |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩. Show that this is the general pure state up to global phase. Locate |0⟩, |1⟩, |+⟩, |−⟩, |+i⟩, and |−i⟩ on the Bloch sphere. Compute the Bloch vector r = ⟨σ⟩ for |ψ⟩.",
    sortOrder: 130,
    durationMinutes: 15,
  },
  {
    slug: "qc-born-rule-computational",
    category: QC,
    subcategory: "Qubits",
    title: "Born rule in the computational basis",
    prompt:
      "You are given |ψ⟩ = α|0⟩ + β|1⟩ with |α|² + |β|² = 1. You measure in the computational basis. State the outcomes, probabilities, and collapsed states. Then rewrite the same measurement as a projective measurement with operators |0⟩⟨0| and |1⟩⟨1|, and as a POVM with those two elements.",
    sortOrder: 140,
    durationMinutes: 15,
  },
  {
    slug: "qc-density-matrix-mixed",
    category: QC,
    subcategory: "Qubits",
    title: "Pure versus mixed qubit",
    prompt:
      "Write the density matrix of a pure qubit |ψ⟩ and of the maximally mixed state I/2. Compute Tr(ρ²) in both cases. Give a Bloch-vector picture of mixed states inside the ball. Construct one mixed state that is an equal mixture of |0⟩ and |1⟩ and one that is an equal mixture of |+⟩ and |−⟩, and compare them.",
    sortOrder: 150,
    durationMinutes: 15,
  },
  {
    slug: "qc-pauli-and-hadamard",
    category: QC,
    subcategory: "Gates",
    title: "Pauli, Hadamard, and phase gates",
    prompt:
      "Write the matrices of X, Y, Z, H, S, and T in the computational basis. Compute HZH and HXH. Show that H|0⟩ = |+⟩ and H|+⟩ = |0⟩. Draw a one-qubit circuit that maps |0⟩ to (|0⟩ + i|1⟩)/√2 using only H and S.",
    sortOrder: 160,
    durationMinutes: 15,
  },
  {
    slug: "qc-cnot-basis",
    category: QC,
    subcategory: "Gates",
    title: "CNOT in two bases",
    prompt:
      "Write the CNOT matrix with the first qubit as control. Compute CNOT|10⟩ and CNOT|+0⟩. Show that CNOT in the Hadamard basis (both qubits) becomes a CNOT with control and target swapped, up to local Hadamards. Why does this matter for reversing a CNOT?",
    sortOrder: 170,
    durationMinutes: 15,
  },
  {
    slug: "qc-universal-gates",
    category: QC,
    subcategory: "Gates",
    title: "A universal gate set",
    prompt:
      "Explain what it means for a gate set to be universal for quantum computation. Argue that {H, T, CNOT} is universal (you may cite the Solovay–Kitaev idea at a high level). Give one two-qubit gate that is not entangling, and one that is, with a short calculation.",
    sortOrder: 180,
    durationMinutes: 15,
  },
  {
    slug: "qc-bell-states",
    category: QC,
    subcategory: "Entanglement",
    title: "Prepare and distinguish Bell states",
    prompt:
      "Write the four Bell states. Give a circuit from |00⟩ that prepares |Φ⁺⟩. Show how to turn |Φ⁺⟩ into each of the other three Bell states with local Pauli gates. Describe a measurement (the Bell basis) that distinguishes all four.",
    sortOrder: 190,
    durationMinutes: 15,
  },
  {
    slug: "qc-chsh-inequality",
    category: QC,
    subcategory: "Entanglement",
    title: "CHSH correlator",
    prompt:
      "For the singlet |Ψ⁻⟩, compute the correlator ⟨A ⊗ B⟩ where A = n · σ and B = m · σ. State the CHSH combination S and its quantum maximum 2√2 (Tsirelson). Pick two pairs of axes that saturate CHSH and compute S. What would a local hidden-variable model be forced to obey?",
    sortOrder: 200,
    durationMinutes: 15,
  },
  {
    slug: "qc-no-cloning",
    category: QC,
    subcategory: "Entanglement",
    title: "No-cloning and teleportation",
    prompt:
      "Prove that no unitary on H ⊗ H can map |ψ⟩|0⟩ to |ψ⟩|ψ⟩ for all |ψ⟩. Then outline quantum teleportation of one qubit using one ebit and two classical bits: write the circuit, the four Bell-measurement branches, and the Pauli corrections. How does teleportation avoid cloning?",
    sortOrder: 210,
    durationMinutes: 15,
  },
  {
    slug: "qc-deutsch-jozsa",
    category: QC,
    subcategory: "Algorithms",
    title: "Deutsch’s algorithm",
    prompt:
      "A function f:{0,1}→{0,1} is constant or balanced (here: the two one-bit cases). Draw Deutsch’s circuit, compute the amplitude of |1⟩ on the query qubit after the oracle, and show that one query distinguishes constant from balanced. Contrast with the classical worst-case query count.",
    sortOrder: 220,
    durationMinutes: 15,
  },
  {
    slug: "qc-grover-one-item",
    category: QC,
    subcategory: "Algorithms",
    title: "Grover iterate for one marked item",
    prompt:
      "For a search space of N = 2^n items with one marked basis state |w⟩, write Grover’s iterate G = (2|s⟩⟨s| − I) O, where |s⟩ is the uniform superposition and O is the phase oracle. Compute the angle of rotation toward |w⟩. How many iterations are needed, and what is the success probability after that many?",
    sortOrder: 230,
    durationMinutes: 15,
  },
  {
    slug: "qc-phase-kickback",
    category: QC,
    subcategory: "Algorithms",
    title: "Phase kickback",
    prompt:
      "An oracle U_f |x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩ acts on a target qubit prepared in |−⟩. Show that this kicks the phase (−1)^{f(x)} onto the data register. Use that fact to explain the oracle in Deutsch and in Grover. What fails if the target is left in |0⟩?",
    sortOrder: 240,
    durationMinutes: 15,
  },
];
