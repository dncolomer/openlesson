import { UseCaseLandingPage } from "@/components/UseCaseLandingPage";
import {
  LEARNING_AUGMENTATION_PAGE,
  buildUseCasePageMetadata,
} from "@/lib/seo/use-case-page";

export const metadata = buildUseCasePageMetadata(LEARNING_AUGMENTATION_PAGE);

export default function LearningAugmentationUseCasePage() {
  return <UseCaseLandingPage page={LEARNING_AUGMENTATION_PAGE} />;
}