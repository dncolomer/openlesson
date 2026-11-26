import { KnowledgeRegionPage } from "@/components/product-flow/knowledge-region-page";

export default async function KnowledgeRegionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KnowledgeRegionPage regionId={id} mode="edit" />;
}
