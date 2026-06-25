import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import { PLATFORM_PAGE, solutionMetadata } from "@/lib/seo/solution-pages";

export const metadata = solutionMetadata(PLATFORM_PAGE);

export default function PlatformPage() {
  return (
    <SeoSolutionPage
      page={PLATFORM_PAGE}
      leadCapture={{
        audience: "enterprise",
        title: "See openLesson for your team",
        subtitle:
          "Request a walkthrough of Performance Workspaces, evaluation environments, and LMS integration via the Agentic API.",
      }}
    />
  );
}