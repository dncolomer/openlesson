import { KnowledgeRegionPage } from "@/components/product-flow/knowledge-region-page";

export default async function LtiKnowledgeRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <KnowledgeRegionPage
      regionId={id}
      detailsUrl={`/api/lti/knowledge-regions/${encodeURIComponent(id)}`}
    />
  );
}
