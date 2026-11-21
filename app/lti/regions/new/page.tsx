import { RegionSimulationSetup } from "@/components/product-flow/region-simulation-setup";
import { parseProductFlowKind } from "@/lib/product-flow";

export default async function LtiCreateKnowledgeRegionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const query = await searchParams;
  const kind = parseProductFlowKind(query.kind) || "solve";
  return (
    <RegionSimulationSetup
      kind={kind}
      apiPath="/api/lti/region-simulation"
      detailsBasePath="/lti/regions"
    />
  );
}
