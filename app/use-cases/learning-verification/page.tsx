import { UseCaseLandingPage } from "@/components/UseCaseLandingPage";
import {
  LEARNING_VERIFICATION_PAGE,
  buildUseCasePageMetadata,
} from "@/lib/seo/use-case-page";

export const metadata = buildUseCasePageMetadata(LEARNING_VERIFICATION_PAGE);

export default function LearningVerificationUseCasePage() {
  return <UseCaseLandingPage page={LEARNING_VERIFICATION_PAGE} />;
}