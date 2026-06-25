import { notFound } from "next/navigation";
import { SeoSolutionPage } from "@/components/SeoSolutionPage";
import {
  getSolutionPage,
  SOLUTION_SLUGS,
  solutionMetadata,
} from "@/lib/seo/solution-pages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = getSolutionPage(slug);
  if (!page) return {};
  return solutionMetadata(page);
}

export default async function SolutionVerticalPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSolutionPage(slug);
  if (!page) notFound();
  return <SeoSolutionPage page={page} />;
}