import { SolutionLanding } from "@/components/SolutionLanding";

export default function CertifyPage() {
  return <SolutionLanding eyebrow="FOR CERTIFICATION" title="Pass by understanding, not by cramming dumps." intro="Open Lesson turns certification prep into active reasoning so you know why the right answer is right before the exam asks." backgroundImage="/career.jpg" challenges={["Brain dumps create fragile confidence and shallow recall.", "Long courses make it hard to know which gaps actually matter.", "Learners often study more without studying the right thing."]} solutions={["Socratic lessons test understanding instead of rewarding memorization.", "Open Lesson builds a focused plan around the domains blocking progress.", "Think-aloud practice makes weak reasoning visible before exam day."]} />;
}
