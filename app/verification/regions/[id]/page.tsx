import { redirect } from "next/navigation";
import { productRegionPagePath } from "@/lib/product-flow";

export default async function VerificationRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(productRegionPagePath("verification", id));
}
