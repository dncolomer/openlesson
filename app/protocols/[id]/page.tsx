import { ProductFlowPage } from "@/components/product-flow/product-flow-page";

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductFlowPage flowId={id} />;
}
