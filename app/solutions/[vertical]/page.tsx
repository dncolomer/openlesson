import { notFound } from "next/navigation";
import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import {
  getScenariosForVertical,
  scenarioToRelatedLink,
} from "@/lib/seo/scenario-pages";
import {
  getSolutionPage,
  SOLUTION_SLUGS,
  solutionMetadata,
} from "@/lib/seo/solution-pages";

type PageProps = {
  params: Promise<{ vertical: string }>;
};

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((vertical) => ({ vertical }));
}

export async function generateMetadata({ params }: PageProps) {
  const { vertical } = await params;
  const page = getSolutionPage(vertical);
  if (!page) return {};
  return solutionMetadata(page);
}

export default async function SolutionVerticalPage({ params }: PageProps) {
  const { vertical } = await params;
  const page = getSolutionPage(vertical);
  if (!page) notFound();
  const relatedLinks = getScenariosForVertical(vertical).map(scenarioToRelatedLink);

  return (
    <SeoSolutionPage
      page={page}
      breadcrumbs={[
        { href: "/solutions", label: "Solutions" },
        { href: page.path, label: page.navLabel },
      ]}
      relatedLinks={relatedLinks}
    />
  );
}