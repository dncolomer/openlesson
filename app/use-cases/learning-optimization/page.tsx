import { UseCaseLandingPage } from "@/components/UseCaseLandingPage";
import {
  LEARNING_OPTIMIZATION_PAGE,
  buildUseCasePageMetadata,
} from "@/lib/seo/use-case-page";

export const metadata = buildUseCasePageMetadata(LEARNING_OPTIMIZATION_PAGE);

export default function LearningOptimizationUseCasePage() {
  return <UseCaseLandingPage page={LEARNING_OPTIMIZATION_PAGE} />;
}