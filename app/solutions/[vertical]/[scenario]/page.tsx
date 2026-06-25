import { notFound } from "next/navigation";
import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import {
  getScenarioPage,
  scenarioMetadata,
  SCENARIO_ROUTE_PARAMS,
} from "@/lib/seo/scenario-pages";
import { getSolutionPage } from "@/lib/seo/solution-pages";

type PageProps = {
  params: Promise<{ vertical: string; scenario: string }>;
};

export function generateStaticParams() {
  return SCENARIO_ROUTE_PARAMS;
}

export async function generateMetadata({ params }: PageProps) {
  const { vertical, scenario } = await params;
  const page = getScenarioPage(vertical, scenario);
  if (!page) return {};
  return scenarioMetadata(page);
}

export default async function SolutionScenarioPage({ params }: PageProps) {
  const { vertical, scenario } = await params;
  const page = getScenarioPage(vertical, scenario);
  if (!page) notFound();

  const parentVertical = getSolutionPage(vertical);

  return (
    <SeoSolutionPage
      page={page}
      breadcrumbs={[
        { href: "/solutions", label: "Solutions" },
        { href: `/solutions/${vertical}`, label: parentVertical?.navLabel ?? vertical },
        { href: page.path, label: page.navLabel },
      ]}
    />
  );
}