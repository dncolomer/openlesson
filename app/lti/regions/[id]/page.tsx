import { KnowledgeRegionPage } from "@/components/product-flow/knowledge-region-page";
import { parseProductFlowKind } from "@/lib/product-flow";

export default async function LtiKnowledgeRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const kind = parseProductFlowKind(query.kind) || "solve";
  return (
    <KnowledgeRegionPage
      kind={kind}
      regionId={id}
      detailsUrl={`/api/lti/knowledge-regions/${encodeURIComponent(id)}?kind=${kind}`}
    />
  );
}
