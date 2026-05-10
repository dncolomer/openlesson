import { SolutionLanding } from "@/components/SolutionLanding";

export default function EvalPage() {
  return <SolutionLanding eyebrow="FOR HIRING" title="Evaluate how candidates think, not just what they recall." intro="Open Lesson helps teams see reasoning in motion: how someone explores, revises, explains, and gets unstuck." backgroundImage="/hr.jpg" challenges={["Traditional screens overfit to memorized answers and interview performance.", "Interviewers use inconsistent rubrics, making comparisons noisy.", "It is hard to tell whether a candidate can learn through ambiguity."]} solutions={["Candidates work through unfamiliar material with a think-aloud protocol.", "The Socratic flow reveals gaps, assumptions, and recovery patterns.", "Teams get structured evidence of reasoning instead of another vibe-based interview."]} />;
}
