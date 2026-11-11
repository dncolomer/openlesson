import { KnowledgeRegionPage } from "@/components/product-flow/knowledge-region-page";

export default async function SolveRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KnowledgeRegionPage kind="solve" regionId={id} />;
}
