import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import { PLATFORM_PAGE, platformMetadata } from "@/lib/seo/platform-page";

export const metadata = platformMetadata(PLATFORM_PAGE);

export default function PlatformPage() {
  return <SeoSolutionPage page={PLATFORM_PAGE} />;
}