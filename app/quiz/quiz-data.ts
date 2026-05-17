export interface QuizQuestion {
  id: number;
  chapter: string;
  topic: string;
  question: string;
  options: [string, string, string];
  answerIndex: number;
  explanation: string;
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    chapter: "Chapter 1",
    topic: "Entropy",
    question: "If a room gets messier over time, which idea is it hinting at?",
    options: ["Entropy tends to increase", "Gravity turns off", "Energy disappears"],
    answerIndex: 0,
    explanation: "Entropy is a way to describe how many messy, spread-out arrangements are available.",
  },
  {
    id: 2,
    chapter: "Chapter 2",
    topic: "Blockchain",
    question: "What does a blockchain transaction signature prove?",
    options: ["The receiver is online", "The sender approved it", "The coin has weight"],
    answerIndex: 1,
    explanation: "A valid signature proves the transaction was authorized by the holder of the private key.",
  },
  {
    id: 3,
    chapter: "Chapter 3",
    topic: "AI",
    question: "What is the main job of training an AI model?",
    options: ["Memorize every website", "Turn code into electricity", "Adjust patterns from examples"],
    answerIndex: 2,
    explanation: "Training updates model parameters so it captures useful patterns in examples.",
  },
  {
    id: 4,
    chapter: "Chapter 4",
    topic: "Physics",
    question: "When you push a wall and it pushes back, which law are you seeing?",
    options: ["Pythagoras' theorem", "Newton's third law", "Moore's law"],
    answerIndex: 1,
    explanation: "Newton's third law says forces come in equal and opposite pairs.",
  },
  {
    id: 5,
    chapter: "Chapter 5",
    topic: "Proofs",
    question: "What makes a mathematical proof convincing?",
    options: ["Each step follows logically", "It uses big words", "It is written in red ink"],
    answerIndex: 0,
    explanation: "A proof works when every step follows from accepted assumptions or previous steps.",
  },
  {
    id: 6,
    chapter: "Chapter 6",
    topic: "Memory",
    question: "Which habit usually helps memory most?",
    options: ["Rereading once quickly", "Changing font color", "Testing yourself later"],
    answerIndex: 2,
    explanation: "Retrieval practice strengthens memory because you reconstruct the idea yourself.",
  },
  {
    id: 7,
    chapter: "Chapter 7",
    topic: "Markets",
    question: "If demand rises while supply stays the same, price usually does what?",
    options: ["Goes up", "Always goes to zero", "Becomes illegal"],
    answerIndex: 0,
    explanation: "More buyers competing for the same supply usually pushes price upward.",
  },
  {
    id: 8,
    chapter: "Chapter 8",
    topic: "Code",
    question: "What does a loop help a program do?",
    options: ["Repeat steps", "Hide the keyboard", "Make pixels heavier"],
    answerIndex: 0,
    explanation: "A loop repeats instructions until a condition stops it or the sequence ends.",
  },
  {
    id: 9,
    chapter: "Chapter 9",
    topic: "Probability",
    question: "A fair coin lands heads five times. What is the next flip most likely to be?",
    options: ["Definitely tails", "Still 50/50", "Definitely heads"],
    answerIndex: 1,
    explanation: "Past flips do not change the next flip of a fair coin; it remains 50/50.",
  },
  {
    id: 10,
    chapter: "Chapter 10",
    topic: "Learning",
    question: "What is an aha moment usually a sign of?",
    options: ["A mental model clicked", "You are done forever", "The question was fake"],
    answerIndex: 0,
    explanation: "An aha moment means pieces reorganized into a model you can carry forward.",
  },
];

export function getQuizQuestion(id: number) {
  return quizQuestions.find((question) => question.id === id);
}
