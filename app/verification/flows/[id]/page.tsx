import { ProductFlowPage } from "@/components/product-flow/product-flow-page";

export default async function VerificationFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductFlowPage kind="verification" flowId={id} />;
}
