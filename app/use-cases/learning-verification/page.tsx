import { UseCaseLandingPage } from "@/components/UseCaseLandingPage";
import {
  LEARNING_VERIFICATION_PAGE,
  useCasePageMetadata,
} from "@/lib/seo/use-case-page";

export const metadata = useCasePageMetadata(LEARNING_VERIFICATION_PAGE);

export default function LearningVerificationUseCasePage() {
  return <UseCaseLandingPage page={LEARNING_VERIFICATION_PAGE} />;
}