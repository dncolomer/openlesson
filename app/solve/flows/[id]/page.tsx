import { ProductFlowPage } from "@/components/product-flow/product-flow-page";

export default async function SolveFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductFlowPage kind="solve" flowId={id} />;
}
