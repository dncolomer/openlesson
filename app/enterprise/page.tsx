import { SolutionLanding } from "@/components/SolutionLanding";

export default function EnterprisePage() {
  return <SolutionLanding eyebrow="FOR TEAMS" title="Sales training that actually changes behavior." intro="Open Lesson gives every rep a Socratic practice environment where they think aloud, expose gaps, and build usable judgment." backgroundImage="/sales.jpg" challenges={["Sales training is usually watched, clicked through, and forgotten.", "Managers see completion, not whether someone can reason through a real conversation.", "Generic enablement misses the specific objections and product nuance your team faces."]} solutions={["Reps practice by explaining decisions out loud instead of memorizing scripts.", "Open Lesson turns weak spots into targeted lessons and measurable learning plans.", "Managers get a clearer picture of where confidence is real and where it is performative."]} />;
}
