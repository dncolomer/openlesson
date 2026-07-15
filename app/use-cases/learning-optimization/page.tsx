import { UseCaseLandingPage } from "@/components/UseCaseLandingPage";
import {
  LEARNING_OPTIMIZATION_PAGE,
  useCasePageMetadata,
} from "@/lib/seo/use-case-page";

export const metadata = useCasePageMetadata(LEARNING_OPTIMIZATION_PAGE);

export default function LearningOptimizationUseCasePage() {
  return <UseCaseLandingPage page={LEARNING_OPTIMIZATION_PAGE} />;
}