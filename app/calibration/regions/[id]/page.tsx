import { KnowledgeRegionPage } from "@/components/product-flow/knowledge-region-page";

export default async function CalibrationRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KnowledgeRegionPage kind="calibration" regionId={id} />;
}
