import { RegionSimulationSetup } from "@/components/product-flow/region-simulation-setup";

export default function LtiCreateKnowledgeRegionPage() {
  return (
    <RegionSimulationSetup
      apiPath="/api/lti/region-simulation"
      detailsBasePath="/lti/regions"
    />
  );
}
