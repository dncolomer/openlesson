import { SolutionLanding } from "@/components/SolutionLanding";

export default function SchoolsPage() {
  return <SolutionLanding eyebrow="FOR SCHOOLS" title="Give every student a moment where it finally clicks." intro="Open Lesson supports teachers with Socratic, one-on-one workspaces that help students reach understanding without waiting for the whole class to move together." backgroundImage="/school.jpg" challenges={["Classrooms move at one pace while students understand at many.", "Knowledge gaps stay hidden until quizzes, tests, or frustration expose them.", "Teachers cannot personally coach every student through every stuck moment."]} solutions={["Students think aloud and get guided questions instead of passive explanations.", "Open Lesson adapts lessons around the exact gap blocking progress.", "Teachers get a clearer view of what students understand and where they need help."]} />;
}
