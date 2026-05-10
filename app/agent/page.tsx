import { SolutionLanding } from "@/components/SolutionLanding";

export default function AgentPage() {
  return <SolutionLanding eyebrow="FOR AGENTS" title="Give your agent a teaching brain." intro="Open Lesson gives autonomous systems a structured learning environment: plans, sessions, Socratic probes, and proof that learning happened." backgroundImage="/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg" challenges={["LLMs can answer questions but rarely know how to teach over time.", "Building curriculum, gap analysis, and session memory from scratch is expensive.", "Most agents cannot prove what a learner actually practiced or understood."]} solutions={["Generate adaptive learning plans from arbitrary topics and sources.", "Use Socratic probes and think-aloud analysis to guide real learning loops.", "Attach transcripts, analytics, and proof-of-learning to every session."]} />;
}
