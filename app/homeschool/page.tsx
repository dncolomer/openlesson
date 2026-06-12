import { SolutionLanding } from "@/components/SolutionLanding";

export default function HomeschoolPage() {
  return <SolutionLanding eyebrow="FOR FAMILIES" title="Homeschooling without the prerequisite maze." intro="Open Lesson helps families explore any topic through calm Socratic guidance, so learning feels less like checking boxes and more like discovery." backgroundImage="/homeschool.jpg" challenges={["Curricula often force a rigid sequence that does not match a child's curiosity.", "Parents can see confusion but not always the exact concept causing it.", "Tutoring and enrichment can become expensive and fragmented."]} solutions={["Children can start with the question they actually care about.", "Open Lesson breaks the stuck point into guided, think-aloud steps.", "Families get workspaces that preserve curiosity while building real understanding."]} />;
}
