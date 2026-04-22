"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

interface TopicCategory {
  name: string;
  emoji: string;
  topics: string[];
}

const TOPIC_CATALOGUES: Record<string, TopicCategory[]> = {
  en: [
    {
      name: "Algebra & Number Theory",
      emoji: "🔢",
      topics: [
        "Why does multiplying two negative numbers give a positive?",
        "What are complex numbers and why do we need them?",
        "How does modular arithmetic work?",
        "Why can't you divide by zero?",
        "What makes a number irrational?",
        "How does the quadratic formula actually work?",
        "What is a group in abstract algebra?",
        "Why are prime numbers so important in cryptography?",
        "What is a field in mathematics?",
        "How do logarithms relate to exponentials?",
        "What is a ring in algebra and why does it matter?",
        "How does polynomial long division work?",
        "What is Fermat's Last Theorem about?",
        "Why is the Fundamental Theorem of Algebra true?",
        "What are eigenvalues and what do they represent?",
      ],
    },
    {
      name: "Calculus & Analysis",
      emoji: "📈",
      topics: [
        "What does a derivative actually measure?",
        "Why is the Fundamental Theorem of Calculus so important?",
        "What is the intuition behind integration?",
        "How do limits formalize the idea of infinity?",
        "What is a Taylor series and why does it work?",
        "Why does e^(iπ) + 1 = 0?",
        "What is the epsilon-delta definition of a limit?",
        "How does L'Hôpital's rule work and when can you use it?",
        "What are partial derivatives and when do you need them?",
        "How does the chain rule work intuitively?",
        "What is a Fourier transform and what is it used for?",
        "Why do some integrals have no closed form?",
        "What is the difference between convergence and divergence of a series?",
        "How do differential equations model real phenomena?",
        "What is the Laplace transform used for?",
      ],
    },
    {
      name: "Linear Algebra",
      emoji: "📐",
      topics: [
        "What does it mean for vectors to be linearly independent?",
        "Why are matrices useful for solving systems of equations?",
        "What is a vector space?",
        "How does matrix multiplication actually work intuitively?",
        "What is the determinant and what does it tell you?",
        "What is singular value decomposition (SVD)?",
        "How do linear transformations relate to matrices?",
        "What is the rank of a matrix?",
        "Why are orthogonal matrices important?",
        "What is the null space of a matrix?",
        "How does PCA (principal component analysis) use linear algebra?",
        "What are tensors and how do they generalize matrices?",
      ],
    },
    {
      name: "Probability & Statistics",
      emoji: "🎲",
      topics: [
        "What is Bayes' theorem and why does it matter?",
        "What is the Central Limit Theorem?",
        "How does a p-value actually work?",
        "What is the difference between correlation and causation?",
        "What is a confidence interval really saying?",
        "How does maximum likelihood estimation work?",
        "What is the law of large numbers?",
        "What is a Markov chain?",
        "How do hypothesis tests work?",
        "What is the difference between Bayesian and frequentist statistics?",
        "What is the Monte Carlo method?",
        "How does linear regression find the best fit line?",
        "What is the birthday paradox and why is it surprising?",
        "What is entropy in information theory?",
      ],
    },
    {
      name: "Geometry & Topology",
      emoji: "🔷",
      topics: [
        "What is non-Euclidean geometry?",
        "What is a manifold?",
        "How does the Pythagorean theorem generalize to higher dimensions?",
        "What is a fractal and what does self-similarity mean?",
        "What makes a Möbius strip special?",
        "What is the Euler characteristic?",
        "How does hyperbolic geometry differ from flat geometry?",
        "What is a topological space?",
        "What does it mean for two shapes to be homeomorphic?",
        "How do projective spaces work?",
      ],
    },
    {
      name: "Logic & Discrete Math",
      emoji: "🧩",
      topics: [
        "What is a proof by contradiction?",
        "How does mathematical induction work?",
        "What is Gödel's incompleteness theorem about?",
        "What is the difference between NP and P problems?",
        "How does graph theory model real-world networks?",
        "What is a bijection and why is it important?",
        "What is the halting problem?",
        "How does combinatorics count arrangements?",
        "What is a Boolean algebra?",
        "What is the pigeonhole principle?",
      ],
    },
    {
      name: "Classical Mechanics",
      emoji: "⚙️",
      topics: [
        "What is Newton's second law really saying?",
        "How does conservation of energy work?",
        "What is the difference between mass and weight?",
        "How does angular momentum work?",
        "What is the Lagrangian approach to mechanics?",
        "How does a gyroscope stay upright?",
        "What is the principle of least action?",
        "How do tidal forces work?",
        "What is Hamiltonian mechanics?",
        "Why does the Coriolis effect make storms spin?",
      ],
    },
    {
      name: "Electromagnetism",
      emoji: "⚡",
      topics: [
        "What are Maxwell's equations saying in plain English?",
        "How does an electric motor work?",
        "What is an electromagnetic wave?",
        "How does a capacitor store energy?",
        "What is the relationship between electricity and magnetism?",
        "How does electromagnetic induction work?",
        "What is impedance in an AC circuit?",
        "How does a transformer step up voltage?",
        "What is the Poynting vector?",
        "How does an antenna radiate electromagnetic waves?",
      ],
    },
    {
      name: "Quantum Mechanics",
      emoji: "⚛️",
      topics: [
        "What is wave-particle duality?",
        "How does the uncertainty principle work?",
        "What is quantum superposition?",
        "What does the Schrödinger equation describe?",
        "What is quantum entanglement?",
        "How does quantum tunneling work?",
        "What is the measurement problem in quantum mechanics?",
        "What are quantum spin and spinors?",
        "How does a quantum computer use qubits?",
        "What is the double-slit experiment showing us?",
        "What is a wave function collapse?",
        "How does Pauli's exclusion principle explain the periodic table?",
      ],
    },
    {
      name: "Thermodynamics",
      emoji: "🌡️",
      topics: [
        "What is entropy and why does it always increase?",
        "How does a heat engine work?",
        "What is the difference between heat and temperature?",
        "What are the laws of thermodynamics?",
        "What is a phase transition?",
        "How does a refrigerator move heat from cold to hot?",
        "What is the Boltzmann distribution?",
        "What is free energy and why does it matter?",
        "How does statistical mechanics connect to thermodynamics?",
        "What is a black body and how does it radiate?",
      ],
    },
    {
      name: "Relativity & Cosmology",
      emoji: "🌌",
      topics: [
        "Why can't anything travel faster than light?",
        "What does E=mc² actually mean?",
        "How does gravity bend spacetime?",
        "What is a black hole and how does it form?",
        "What is the twin paradox in special relativity?",
        "How does GPS depend on general relativity?",
        "What is dark matter and why do we think it exists?",
        "What is dark energy?",
        "What happened during the Big Bang?",
        "What are gravitational waves?",
      ],
    },
    {
      name: "Algorithms & Data Structures",
      emoji: "🌳",
      topics: [
        "How does a hash table work under the hood?",
        "What is Big-O notation really measuring?",
        "How does quicksort work and why is it fast?",
        "What is dynamic programming?",
        "How do balanced binary search trees stay balanced?",
        "What is a graph traversal (BFS vs DFS)?",
        "How does Dijkstra's algorithm find shortest paths?",
        "What is the difference between a stack and a queue?",
        "How do tries work for string matching?",
        "What is memoization and when should you use it?",
        "How does a bloom filter work?",
        "What is amortized time complexity?",
      ],
    },
    {
      name: "Machine Learning & AI",
      emoji: "🤖",
      topics: [
        "How does gradient descent optimize a neural network?",
        "What is backpropagation?",
        "How do transformers and attention mechanisms work?",
        "What is overfitting and how do you prevent it?",
        "How does a convolutional neural network recognize images?",
        "What is reinforcement learning?",
        "How does a GAN generate realistic images?",
        "What is the bias-variance tradeoff?",
        "How do decision trees and random forests work?",
        "What is transfer learning?",
        "How does a large language model generate text?",
        "What is the vanishing gradient problem?",
        "How does batch normalization help training?",
        "What is a loss function and how do you choose one?",
      ],
    },
    {
      name: "Systems & Architecture",
      emoji: "🖥️",
      topics: [
        "How does a CPU execute instructions?",
        "What is the difference between processes and threads?",
        "How does virtual memory work?",
        "What is a cache and why does cache locality matter?",
        "How does an operating system schedule processes?",
        "What is a deadlock and how do you prevent it?",
        "How does TCP ensure reliable data delivery?",
        "What is the CAP theorem?",
        "How does a database index speed up queries?",
        "What is a distributed consensus algorithm (Raft, Paxos)?",
        "How does garbage collection work?",
        "What is the difference between ACID and BASE?",
      ],
    },
    {
      name: "Cryptography & Security",
      emoji: "🔐",
      topics: [
        "How does public-key cryptography (RSA) work?",
        "What is a hash function and what makes it secure?",
        "How does TLS/HTTPS keep web traffic private?",
        "What is a zero-knowledge proof?",
        "How does a blockchain work?",
        "What is a digital signature?",
        "How does AES encryption work?",
        "What is a man-in-the-middle attack?",
        "How does Diffie-Hellman key exchange work?",
        "What are quantum-resistant cryptographic algorithms?",
      ],
    },
    {
      name: "Programming Languages & Theory",
      emoji: "💻",
      topics: [
        "What is a type system and why does it matter?",
        "How do compilers turn code into machine instructions?",
        "What is functional programming?",
        "What is the difference between compiled and interpreted languages?",
        "How does a garbage collector decide what to free?",
        "What is a closure and how does it capture variables?",
        "What is the lambda calculus?",
        "How does pattern matching work in functional languages?",
        "What is a monad and why do Haskell programmers care?",
        "How do async/await and event loops work?",
      ],
    },
    {
      name: "Molecular Biology & Genetics",
      emoji: "🧬",
      topics: [
        "How does DNA replication work?",
        "What is CRISPR and how does gene editing work?",
        "How does mRNA get translated into proteins?",
        "What is epigenetics?",
        "How do mutations drive evolution?",
        "What is a gene regulatory network?",
        "How does PCR amplify DNA?",
        "What determines whether a gene is dominant or recessive?",
        "How does RNA splicing work?",
        "What is the central dogma of molecular biology?",
      ],
    },
    {
      name: "Cell Biology & Biochemistry",
      emoji: "🔬",
      topics: [
        "How does cellular respiration produce ATP?",
        "What is the structure and function of a cell membrane?",
        "How does photosynthesis convert light to energy?",
        "What is apoptosis (programmed cell death)?",
        "How do enzymes catalyze reactions?",
        "What is the Krebs cycle doing?",
        "How does signal transduction work in cells?",
        "What is protein folding and why does it matter?",
        "How do antibodies recognize antigens?",
        "What are stem cells and how do they differentiate?",
      ],
    },
    {
      name: "Ecology & Evolution",
      emoji: "🌿",
      topics: [
        "How does natural selection drive evolution?",
        "What is speciation and how does it occur?",
        "How do ecosystems maintain balance?",
        "What is the theory of punctuated equilibrium?",
        "How does genetic drift differ from natural selection?",
        "What causes mass extinction events?",
        "How do food webs model energy flow in ecosystems?",
        "What is the Red Queen hypothesis?",
        "How does symbiosis evolve?",
        "What is kin selection and altruism in evolution?",
      ],
    },
    {
      name: "Neuroscience",
      emoji: "🧠",
      topics: [
        "How does a neuron fire an action potential?",
        "What is neuroplasticity?",
        "How does memory formation work?",
        "What are neurotransmitters and how do they work?",
        "How does the brain process visual information?",
        "What is the default mode network?",
        "How does long-term potentiation relate to learning?",
        "What happens in the brain during sleep?",
        "How does the brain represent language?",
        "What is the connectome?",
      ],
    },
    {
      name: "General & Physical Chemistry",
      emoji: "⚗️",
      topics: [
        "What is a chemical bond and why do atoms bond?",
        "How does the periodic table organize elements?",
        "What is electronegativity?",
        "How do chemical equilibria work?",
        "What is Le Chatelier's principle?",
        "How does an acid-base reaction work?",
        "What is a redox reaction?",
        "How does reaction kinetics determine speed of reactions?",
        "What are intermolecular forces?",
        "What is Gibbs free energy telling you about a reaction?",
      ],
    },
    {
      name: "Organic Chemistry",
      emoji: "🧪",
      topics: [
        "What is chirality and why does it matter in biology?",
        "How do organic reaction mechanisms work?",
        "What is aromaticity?",
        "How does a nucleophilic substitution (SN1 vs SN2) work?",
        "What is a carbonyl group and why is it so reactive?",
        "How do polymers form?",
        "What is stereochemistry?",
        "How do enzymes achieve such high specificity?",
        "What is a free radical and how does it react?",
        "How does retrosynthetic analysis plan a synthesis?",
      ],
    },
    {
      name: "Electrical Engineering",
      emoji: "🔌",
      topics: [
        "How does a transistor work as a switch?",
        "What is a feedback loop in control systems?",
        "How does a PID controller work?",
        "What is signal processing and filtering?",
        "How does an ADC (analog-to-digital converter) work?",
        "What is the Nyquist sampling theorem?",
        "How do op-amps work?",
        "What is a state machine in digital logic?",
        "How does a MOSFET differ from a BJT?",
        "What is impedance matching and why does it matter?",
      ],
    },
    {
      name: "Mechanical & Civil Engineering",
      emoji: "🏗️",
      topics: [
        "How does stress and strain analysis work?",
        "What is finite element analysis (FEA)?",
        "How does a heat exchanger work?",
        "What is fluid dynamics and the Navier-Stokes equation?",
        "How do bridges distribute forces?",
        "What is material fatigue?",
        "How does a turbine convert fluid energy to rotation?",
        "What is Bernoulli's principle?",
        "How does 3D printing / additive manufacturing work?",
        "What is the Reynolds number and what does it predict?",
      ],
    },
    {
      name: "Earth Science & Climate",
      emoji: "🌍",
      topics: [
        "How does plate tectonics drive continental drift?",
        "What causes earthquakes?",
        "How does the greenhouse effect work?",
        "What is the carbon cycle?",
        "How do ocean currents affect climate?",
        "What causes ice ages?",
        "How does radiocarbon dating work?",
        "What is the water cycle and why does it matter?",
        "How do volcanoes form and erupt?",
        "What is the Milankovitch cycle?",
      ],
    },
    {
      name: "Astronomy & Astrophysics",
      emoji: "🔭",
      topics: [
        "How do stars form and evolve?",
        "What is a neutron star?",
        "How do we detect exoplanets?",
        "What is the Hertzsprung-Russell diagram?",
        "How does nuclear fusion power the Sun?",
        "What is a supernova?",
        "How do we measure cosmic distances?",
        "What is the cosmic microwave background radiation?",
        "How do galaxies form and evolve?",
        "What is the Drake equation estimating?",
      ],
    },
  ],
  vi: [
    {
      name: "Đại số & Lý thuyết số",
      emoji: "🔢",
      topics: [
        "Tại sao nhân hai số âm lại cho kết quả dương?",
        "Số phức là gì và tại sao chúng ta cần chúng?",
        "Số học modulo hoạt động như thế nào?",
        "Tại sao không thể chia cho 0?",
        "Điều gì khiến một số là số vô tỉ?",
        "Công thức nghiệm của phương trình bậc hai hoạt động như thế nào?",
        "Nhóm trong đại số trừu tượng là gì?",
        "Tại sao số nguyên tố lại quan trọng trong mật mã học?",
        "Trường trong toán học là gì?",
        "Logarit liên quan đến hàm mũ như thế nào?",
        "Vành trong đại số là gì và tại sao nó quan trọng?",
        "Chia đa thức dài hoạt động như thế nào?",
        "Định lý Fermat lớn nói về điều gì?",
        "Tại sao Định lý cơ bản của Đại số lại đúng?",
        "Giá trị riêng là gì và chúng đại diện cho điều gì?",
      ],
    },
    {
      name: "Giải tích & Vi tích phân",
      emoji: "📈",
      topics: [
        "Đạo hàm thực sự đo lường điều gì?",
        "Tại sao Định lý cơ bản của Giải tích lại quan trọng như vậy?",
        "Trực giác đằng sau tích phân là gì?",
        "Giới hạn hình thức hóa ý tưởng vô cực như thế nào?",
        "Chuỗi Taylor là gì và tại sao nó hoạt động?",
        "Tại sao e^(iπ) + 1 = 0?",
        "Định nghĩa epsilon-delta của giới hạn là gì?",
        "Quy tắc L'Hôpital hoạt động và khi nào có thể sử dụng nó?",
        "Đạo hàm riêng là gì và khi nào bạn cần chúng?",
        "Quy tắc dây chuyền hoạt động như thế nào theo trực giác?",
        "Biến đổi Fourier là gì và dùng để làm gì?",
        "Tại sao một số tích phân không có dạng đóng?",
        "Sự hội tụ và phân kỳ của chuỗi khác nhau như thế nào?",
        "Phương trình vi phân mô hình hóa các hiện tượng thực như thế nào?",
        "Biến đổi Laplace dùng để làm gì?",
      ],
    },
    {
      name: "Đại số tuyến tính",
      emoji: "📐",
      topics: [
        "Độc lập tuyến tính của các vectơ có nghĩa là gì?",
        "Tại sao ma trận hữu ích cho việc giải hệ phương trình?",
        "Không gian vectơ là gì?",
        "Nhân ma trận thực sự hoạt động như thế nào theo trực giác?",
        "Định thức là gì và nó cho bạn biết điều gì?",
        "Phân rã giá trị singular (SVD) là gì?",
        "Biến đổi tuyến tính liên quan đến ma trận như thế nào?",
        "Hạng của ma trận là gì?",
        "Tại sao ma trận trực giao lại quan trọng?",
        "Không gian null của ma trận là gì?",
        "PCA (phân tích thành phần chính) sử dụng đại số tuyến tính như thế nào?",
        "Tensor là gì và chúng tổng quát hóa ma trận như thế nào?",
      ],
    },
    {
      name: "Xác suất & Thống kê",
      emoji: "🎲",
      topics: [
        "Định lý Bayes là gì và tại sao nó quan trọng?",
        "Định lý giới hạn trung tâm là gì?",
        "Giá trị p thực sự hoạt động như thế nào?",
        "Sự khác biệt giữa tương quan và nhân quả là gì?",
        "Khoảng tin cậy thực sự nói gì?",
        "Ước lượng hợp lý cực đại hoạt động như thế nào?",
        "Luật số lớn là gì?",
        "Chuỗi Markov là gì?",
        "Kiểm định giả thuyết hoạt động như thế nào?",
        "Sự khác biệt giữa thống kê Bayes và tần số là gì?",
        "Phương pháp Monte Carlo là gì?",
        "Hồi quy tuyến tính tìm đường phù hợp nhất như thế nào?",
        "Nghịch lý ngày sinh và tại sao nó đáng ngạc nhiên?",
        "Entropy trong lý thuyết thông tin là gì?",
      ],
    },
    {
      name: "Hình học & Tôpô",
      emoji: "🔷",
      topics: [
        "Hình học phi Euclid là gì?",
        "Đa tạp là gì?",
        "Định lý Pythagoras tổng quát hóa sang chiều cao hơn như thế nào?",
        "Fractal là gì và tự tương tự có nghĩa là gì?",
        "Điều gì làm cho dải Möbius trở nên đặc biệt?",
        "Đặc trưng Euler là gì?",
        "Hình học hyperbolic khác với hình học phẳng như thế nào?",
        "Không gian tôpô là gì?",
        "Hai hình dạng đồng phôi có nghĩa là gì?",
        "Không gian xạ ảnh hoạt động như thế nào?",
      ],
    },
    {
      name: "Logic & Toán rời rạc",
      emoji: "🧩",
      topics: [
        "Chứng minh bằng phản chứng là gì?",
        "Quy nạp toán học hoạt động như thế nào?",
        "Định lý bất toàn của Gödel nói về điều gì?",
        "Sự khác biệt giữa bài toán NP và P là gì?",
        "Lý thuyết đồ thị mô hình hóa các mạng lưới thực tế như thế nào?",
        "Song ánh là gì và tại sao nó quan trọng?",
        "Vấn đề dừng là gì?",
        "Tổ hợp đếm các sắp xếp như thế nào?",
        "Đại số Boolean là gì?",
        "Nguyên lý lỗ thỏ là gì?",
      ],
    },
    {
      name: "Cơ học cổ điển",
      emoji: "⚙️",
      topics: [
        "Định luật thứ hai của Newton thực sự nói gì?",
        "Bảo toàn năng lượng hoạt động như thế nào?",
        "Sự khác biệt giữa khối lượng và trọng lượng là gì?",
        "Mô men động lượng hoạt động như thế nào?",
        "Phương pháp Lagrange trong cơ học là gì?",
        "Con quay hoạt động như thế nào để đứng thẳng?",
        "Nguyên lý tác dụng tối thiểu là gì?",
        "Lực thủy triều hoạt động như thế nào?",
        "Cơ học Hamilton là gì?",
        "Tại hiệu ứng Coriolis khiến bão xoáy?",
      ],
    },
    {
      name: "Điện từ học",
      emoji: "⚡",
      topics: [
        "Các phương trình Maxwell đang nói gì bằng ngôn ngữ đơn giản?",
        "Động cơ điện hoạt động như thế nào?",
        "Sóng điện từ là gì?",
        "Tụ điện lưu trữ năng lượng như thế nào?",
        "Mối quan hệ giữa điện và từ là gì?",
        "Cảm ứng điện từ hoạt động như thế nào?",
        "Trở kháng trong mạch xoay chiều là gì?",
        "Máy biến áp tăng điện áp như thế nào?",
        "Vectơ Poynting là gì?",
        "Antenn phát sóng điện từ như thế nào?",
      ],
    },
    {
      name: "Cơ học lượng tử",
      emoji: "⚛️",
      topics: [
        "Lưỡng tính sóng-hạt là gì?",
        "Nguyên lý bất định hoạt động như thế nào?",
        "Chồng chất lượng tử là gì?",
        "Phương trình Schrödinger mô tả điều gì?",
        "Vướng víu lượng tử là gì?",
        "Hiệu ứng đường hầm lượng tử hoạt động như thế nào?",
        "Vấn đề đo lường trong cơ học lượng tử là gì?",
        "Spin lượng tử và spinor là gì?",
        "Máy tính lượng tử sử dụng qubit như thế nào?",
        "Thí nghiệm hai khe cho chúng ta thấy điều gì?",
        "Sụp đổ hàm sóng là gì?",
        "Nguyên lý loại trừ Pauli giải thích bảng tuần hoàn như thế nào?",
      ],
    },
    {
      name: "Nhiệt động lực học",
      emoji: "🌡️",
      topics: [
        "Entropy là gì và tại sao nó luôn tăng?",
        "Động cơ nhiệt hoạt động như thế nào?",
        "Sự khác biệt giữa nhiệt và nhiệt độ là gì?",
        "Các định luật của nhiệt động lực học là gì?",
        "Chuyển pha là gì?",
        "Tủ lạnh di chuyển nhiệt từ lạnh sang nóng như thế nào?",
        "Phân bố Boltzmann là gì?",
        "Năng lượng tự do là gì và tại sao nó quan trọng?",
        "Cơ học thống kê kết nối với nhiệt động lực học như thế nào?",
        "Vật đen là gì và nó bức xạ như thế nào?",
      ],
    },
    {
      name: "Tương đối & Vũ trụ học",
      emoji: "🌌",
      topics: [
        "Tại sao không có gì có thể di chuyển nhanh hơn ánh sáng?",
        "E=mc² thực sự có nghĩa là gì?",
        "Hấp dẫn bẻ cong không-thời gian như thế nào?",
        "Hố đen là gì và nó hình thành như thế nào?",
        "Nghịch lý sinh đôi trong tương đối đặc biệt là gì?",
        "GPS phụ thuộc vào tương đối tổng quát như thế nào?",
        "Vật chất tối là gì và tại sao chúng ta nghĩ nó tồn tại?",
        "Năng lượng tối là gì?",
        "Điều gì đã xảy ra trong Vụ nổ lớn?",
        "Sóng hấp dẫn là gì?",
      ],
    },
    {
      name: "Thuật toán & Cấu trúc dữ liệu",
      emoji: "🌳",
      topics: [
        "Bảng băm hoạt động như thế nào bên dưới?",
        "Ký hiệu Big-O thực sự đo lường điều gì?",
        "Quicksort hoạt động như thế nào và tại sao nó nhanh?",
        "Quy hoạch động là gì?",
        "Cây tìm kiếm nhị phân cân bằng giữ cân bằng như thế nào?",
        "Duyệt đồ thị (BFS vs DFS) là gì?",
        "Thuật toán Dijkstra tìm đường đi ngắn nhất như thế nào?",
        "Sự khác biệt giữa ngăn xếp và hàng đợi là gì?",
        "Trie hoạt động cho việc khớp chuỗi như thế nào?",
        "Ghi nhớ và khi nào nên sử dụng nó?",
        "Bộ lọc Bloom hoạt động như thế nào?",
        "Độ phức tạp amortized là gì?",
      ],
    },
    {
      name: "Học máy & Trí tuệ nhân tạo",
      emoji: "🤖",
      topics: [
        "Tối ưu hóa gradient descent trong mạng nơron hoạt động như thế nào?",
        "Lan truyền ngược (backpropagation) là gì?",
        "Transformer và cơ chế attention hoạt động như thế nào?",
        "Overfitting là gì và làm thế nào để ngăn chặn nó?",
        "Mạng nơron tích chập nhận dạng hình ảnh như thế nào?",
        "Học tăng cường là gì?",
        "GAN tạo hình ảnh thực tế như thế nào?",
        "Sự đánh đổi bias-phương sai là gì?",
        "Cây quyết định và rừng ngẫu nhiên hoạt động như thế nào?",
        "Học chuyển giao là gì?",
        "Mô hình ngôn ngữ lớn tạo văn bản như thế nào?",
        "Vấn đề gradient biến mất là gì?",
        "Chuẩn hóa batch giúp huấn luyện như thế nào?",
        "Hàm mất mát là gì và làm thế nào để chọn một hàm?",
      ],
    },
    {
      name: "Hệ thống & Kiến trúc",
      emoji: "🖥️",
      topics: [
        "CPU thực thi lệnh như thế nào?",
        "Sự khác biệt giữa tiến trình và luồng là gì?",
        "Bộ nhớ ảo hoạt động như thế nào?",
        "Cache là gì và tại sao vị trí cache lại quan trọng?",
        "Hệ điều hành lên lịch tiến trình như thế nào?",
        "Deadlock là gì và làm thế nào để ngăn chặn nó?",
        "TCP đảm bảo dữ liệu được giao tin cậy như thế nào?",
        "Định lý CAP là gì?",
        "Chỉ mục cơ sở dữ liệu tăng tốc truy vấn như thế nào?",
        "Thuật toán đồng thuận phân tán (Raft, Paxos) là gì?",
        "Thu gom rác hoạt động như thế nào?",
        "Sự khác biệt giữa ACID và BASE là gì?",
      ],
    },
    {
      name: "Mật mã & Bảo mật",
      emoji: "🔐",
      topics: [
        "Mật mã khóa công khai (RSA) hoạt động như thế nào?",
        "Hàm băm là gì và điều gì làm cho nó an toàn?",
        "TLS/HTTPS giữ lưu lượng web riêng tư như thế nào?",
        "Chứng minh không kiến thức là gì?",
        "Blockchain hoạt động như thế nào?",
        "Chữ ký số là gì?",
        "Mã hóa AES hoạt động như thế nào?",
        "Tấn công man-in-the-middle là gì?",
        "Trao đổi khóa Diffie-Hellman hoạt động như thế nào?",
        "Thuật toán mật mã kháng lượng tử là gì?",
      ],
    },
    {
      name: "Ngôn ngữ lập trình & Lý thuyết",
      emoji: "💻",
      topics: [
        "Hệ thống kiểu là gì và tại sao nó quan trọng?",
        "Trình biên dịch chuyển mã thành lệnh máy như thế nào?",
        "Lập trình hàm là gì?",
        "Sự khác biệt giữa ngôn ngữ biên dịch và thông dịch là gì?",
        "Bộ thu gom rác quyết định giải phóng cái gì?",
        "Closure là gì và nó capture biến như thế nào?",
        "Calculus lambda là gì?",
        "Pattern matching hoạt động trong ngôn ngữ hàm như thế nào?",
        "Monad là gì và tại sao lập trình Haskell quan tâm?",
        "async/await và vòng lặp sự kiện hoạt động như thế nào?",
      ],
    },
    {
      name: "Sinh học phân tử & Di truyền",
      emoji: "🧬",
      topics: [
        "Sao chép DNA hoạt động như thế nào?",
        "CRISPR là gì và chỉnh sửa gen hoạt động như thế nào?",
        "mRNA được dịch thành protein như thế nào?",
        "Epigenetics là gì?",
        "Đột biến thúc đẩy tiến hóa như thế nào?",
        "Mạng điều hòa gen là gì?",
        "PCR khuếch đại DNA như thế nào?",
        "Điều gì quyết định một gen là trội hay lặn?",
        "Cắt nối RNA hoạt động như thế nào?",
        "Dogma trung tâm của sinh học phân tử là gì?",
      ],
    },
    {
      name: "Sinh học tế bào & Hóa sinh",
      emoji: "🔬",
      topics: [
        "Hô hấp tế bào tạo ATP như thế nào?",
        "Cấu trúc và chức năng của màng tế bào là gì?",
        "Quang hợp chuyển đổi ánh sáng thành năng lượng như thế nào?",
        "Apoptosis (chết tế bào có lập trình) là gì?",
        "Enzyme xúc tác phản ứng như thế nào?",
        "Chu trình Krebs đang làm gì?",
        "Truyền tín hiệu trong tế bào hoạt động như thế nào?",
        "Gấp protein và tại sao nó quan trọng?",
        "Kháng thể nhận diện kháng nguyên như thế nào?",
        "Tế bào gốc là gì và chúng phân biệt như thế nào?",
      ],
    },
    {
      name: "Sinh thái học & Tiến hóa",
      emoji: "🌿",
      topics: [
        "Chọn lọc tự nhiên thúc đẩy tiến hóa như thế nào?",
        "Loài hình thành và nó xảy ra như thế nào?",
        "Hệ sinh thái duy trì cân bằng như thế nào?",
        "Lý thuyết cân bằng bị gián đoạn là gì?",
        "Drift di truyền khác với chọn lọc tự nhiên như thế nào?",
        "Điều gì gây ra các sự kiện tuyệt chủng hàng loạt?",
        "Lưới thức ăn mô hình hóa dòng năng lượng trong hệ sinh thái như thế nào?",
        "Giả thuyết Nữ hoàng Đỏ là gì?",
        "Cộng sinh tiến hóa như thế nào?",
        "Chọn lọc họ hàng và vị tha trong tiến hóa là gì?",
      ],
    },
    {
      name: "Khoa học thần kinh",
      emoji: "🧠",
      topics: [
        "Neuron bắn điện thế hoạt động như thế nào?",
        "Neuroplasticity là gì?",
        "Hình thành trí nhớ hoạt động như thế nào?",
        "Dẫn truyền thần kinh và chúng hoạt động như thế nào?",
        "Não xử lý thông tin thị giác như thế nào?",
        "Mạng chế độ mặc định là gì?",
        "Tăng cường dài hạn liên quan đến học tập như thế nào?",
        "Điều gì xảy ra trong não khi ngủ?",
        "Não biểu diễn ngôn ngữ như thế nào?",
        "Connectome là gì?",
      ],
    },
    {
      name: "Hóa học tổng & Vật lý",
      emoji: "⚗️",
      topics: [
        "Liên kết hóa học là gì và tại sao các nguyên tử liên kết?",
        "Bảng tuần hoàn sắp xếp các nguyên tố như thế nào?",
        "Độ âm điện là gì?",
        "Cân bằng hóa học hoạt động như thế nào?",
        "Nguyên lý Le Chatelier là gì?",
        "Phản ứng axit-bazơ hoạt động như thế nào?",
        "Phản ứng oxi hóa-khử là gì?",
        "Động học phản ứng xác định tốc độ phản ứng như thế nào?",
        "Lực liên phân tử là gì?",
        "Năng lượng Gibbs tự do cho bạn biết điều gì về một phản ứng?",
      ],
    },
    {
      name: "Hóa học hữu cơ",
      emoji: "🧪",
      topics: [
        "Tính bất đối xứng và tại sao nó quan trọng trong sinh học?",
        "Cơ chế phản ứng hữu cơ hoạt động như thế nào?",
        "Tính thơm là gì?",
        "Phản ứng thế nucleophilic (SN1 vs SN2) hoạt động như thế nào?",
        "Nhóm carbonyl là gì và tại sao nó phản ứng mạnh?",
        "Polyme hình thành như thế nào?",
        "Hóa học lập thể là gì?",
        "Enzyme đạt được độ đặc hiệu cao như thế nào?",
        "Gốc tự do là gì và nó phản ứng như thế nào?",
        "Phân tích retrosynthesis lập kế hoạch tổng hợp như thế nào?",
      ],
    },
    {
      name: "Kỹ thuật điện",
      emoji: "🔌",
      topics: [
        "Transistor hoạt động như một công tắc như thế nào?",
        "Vòng phản hồi trong hệ thống điều khiển là gì?",
        "Bộ điều khiển PID hoạt động như thế nào?",
        "Xử lý tín hiệu và lọc là gì?",
        "Bộ chuyển đổi tương tự-số (ADC) hoạt động như thế nào?",
        "Định lý lấy mẫu Nyquist là gì?",
        "Op-amp hoạt động như thế nào?",
        "Máy trạng thái trong logic số là gì?",
        "MOSFET khác với BJT như thế nào?",
        "Ghép trở kháng và tại sao nó quan trọng?",
      ],
    },
    {
      name: "Kỹ thuật Cơ khí & Xây dựng",
      emoji: "🏗️",
      topics: [
        "Phân tích ứng suất và biến dạng hoạt động như thế nào?",
        "Phương pháp phần tử hữu hạn (FEA) là gì?",
        "Trao đổi nhiệt hoạt động như thế nào?",
        "Động lực học chất lỏng và phương trình Navier-Stokes là gì?",
        "Cầu phân bổ lực như thế nào?",
        "Mỏi vật liệu là gì?",
        "Turbine chuyển năng lượng chất lỏng thành quay như thế nào?",
        "Nguyên lý Bernoulli là gì?",
        "In 3D / Sản xuất bồi đắp hoạt động như thế nào?",
        "Số Reynolds và nó dự đoán điều gì?",
      ],
    },
    {
      name: "Khoa học Trái đất & Khí hậu",
      emoji: "🌍",
      topics: [
        "Động lực mảng thúc đẩy trôi dạt lục địa như thế nào?",
        "Động đất gây ra như thế nào?",
        "Hiệu ứng nhà kính hoạt động như thế nào?",
        "Chu trình carbon là gì?",
        "Dòng hải lưu ảnh hưởng đến khí hậu như thế nào?",
        "Điều gì gây ra các kỷ băng hà?",
        "Định tuổi carbon phóng xạ hoạt động như thế nào?",
        "Chu trình nước và tại sao nó quan trọng?",
        "Núi lửa hình thành và phun trào như thế nào?",
        "Chu kỳ Milankovitch là gì?",
      ],
    },
    {
      name: "Thiên văn & Vật lý thiên văn",
      emoji: "🔭",
      topics: [
        "Sao hình thành và tiến hóa như thế nào?",
        "Sao neutron là gì?",
        "Chúng ta phát hiện ngoại hành tinh như thế nào?",
        "Sơ đồ Hertzsprung-Russell là gì?",
        "Tổng hợp hạt nhân cung cấp năng lượng cho Mặt Trời như thế nào?",
        "Siêu tân tinh là gì?",
        "Chúng ta đo khoảng cách vũ trụ như thế nào?",
        "Bức xạ nền vi sóng vũ trụ là gì?",
        "Thiên hà hình thành và tiến hóa như thế nào?",
        "Phương trình Drake ước tính gì?",
      ],
    },
  ],
};

function getTopics(locale: string): TopicCategory[] {
  return TOPIC_CATALOGUES[locale] || TOPIC_CATALOGUES.en;
}

interface TopicBrowserProps {
  onSelectTopic: (topic: string) => void;
  fullWidth?: boolean;
  /**
   * Compact rendering: fewer topics per view (3 in "All", 6 in a
   * single-category filter) and a tighter 1-column grid. Used in the
   * right-hand split pane on the landing page.
   */
  compact?: boolean;
}

const ALL_LABEL = "All";
const SCROLL_AMOUNT = 200;

export function TopicBrowser({ onSelectTopic, fullWidth = false, compact = false }: TopicBrowserProps) {
  const { t, locale } = useI18n();
  const topicCatalogue = useMemo(() => {
    return getTopics(locale);
  }, [locale]);
  const [activeFilter, setActiveFilter] = useState(ALL_LABEL);
  const [visibleTopics, setVisibleTopics] = useState<
    { topic: string; category: string; emoji: string }[]
  >([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, visibleTopics]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  };

  const buildTopics = useCallback((filter: string) => {
    const pool: { topic: string; category: string; emoji: string }[] = [];
    for (const cat of topicCatalogue) {
      if (filter !== ALL_LABEL && cat.name !== filter) continue;
      for (const topicItem of cat.topics) {
        pool.push({ topic: topicItem, category: cat.name, emoji: cat.emoji });
      }
    }
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Compact mode shows fewer (3/6) so the picker stays small enough
    // to sit comfortably inside the right pane of the split hero.
    const allLimit = compact ? 3 : 12;
    const catLimit = compact ? 6 : 20;
    return pool.slice(0, filter === ALL_LABEL ? allLimit : catLimit);
  }, [compact]);

  useEffect(() => {
    setVisibleTopics(buildTopics(activeFilter));
  }, [activeFilter, buildTopics]);

  const handleReshuffle = () => {
    setVisibleTopics(buildTopics(activeFilter));
  };

  const handleFilterClick = (name: string) => {
    setActiveFilter(name);
    // Scroll filter into view
    scrollRef.current?.querySelector(`[data-filter="${name}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className={`w-full ${fullWidth ? "" : "max-w-5xl"} mx-auto`}>
      {/* Section header */}
      <div className={`flex items-center justify-between ${compact ? "mb-3" : "mb-5"}`}>
        <p className={`text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>
          {t('home.topicBrowserPrompt')}
        </p>
        <button
          onClick={handleReshuffle}
          className="text-xs text-slate-600 hover:text-white transition-colors inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-slate-800"
        >
          <ShuffleIcon />
          {t('home.topicBrowserShuffle')}
        </button>
      </div>

      {/* Category filter strip */}
      <div className={`flex items-center gap-2 ${compact ? "mb-3" : "mb-5"}`}>
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
            canScrollLeft
              ? "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white hover:bg-slate-800"
              : "border-slate-800 text-slate-700 cursor-default"
          }`}
          aria-label={t('home.topicBrowserScrollLeft')}
        >
          <ChevronLeftIcon />
        </button>
        <div
          ref={scrollRef}
          className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth min-w-0"
        >
          <button
            data-filter={ALL_LABEL}
            onClick={() => handleFilterClick(ALL_LABEL)}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeFilter === ALL_LABEL
                ? "bg-slate-200 text-slate-900 border-slate-200"
                : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white"
            }`}
          >
            {t('home.topicBrowserAll')}
          </button>
          {topicCatalogue.map((cat) => (
            <button
              key={cat.name}
              data-filter={cat.name}
              onClick={() => handleFilterClick(cat.name)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                activeFilter === cat.name
                  ? "bg-slate-200 text-slate-900 border-slate-200"
                  : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
            canScrollRight
              ? "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white hover:bg-slate-800"
              : "border-slate-800 text-slate-700 cursor-default"
          }`}
          aria-label={t('home.topicBrowserScrollRight')}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Topic cards grid — compact mode uses a 1-column list with
          smaller padding so ~3 topics fit the right pane comfortably. */}
      <div
        className={
          compact
            ? "grid grid-cols-1 gap-2"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        }
      >
        {visibleTopics.map(({ topic, category, emoji }) => (
          <button
            key={topic}
            onClick={() => onSelectTopic(topic)}
            className={`group text-left rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200 ${
              compact ? "p-3" : "p-4"
            }`}
          >
            <p
              className={`text-slate-300 group-hover:text-white leading-snug ${
                compact ? "text-[12.5px] mb-1.5" : "text-[13px] mb-2.5"
              }`}
            >
              {topic}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{emoji}</span>
              <span className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors">
                {category}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
