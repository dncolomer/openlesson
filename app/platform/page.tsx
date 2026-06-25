import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import { PLATFORM_PAGE, solutionMetadata } from "@/lib/seo/solution-pages";

export const metadata = solutionMetadata(PLATFORM_PAGE);

export default function PlatformPage() {
  return <SeoSolutionPage page={PLATFORM_PAGE} />;
}