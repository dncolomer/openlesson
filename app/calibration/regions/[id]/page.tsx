import { redirect } from "next/navigation";
import { productRegionPagePath } from "@/lib/product-flow";

export default async function CalibrationRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(productRegionPagePath("calibration", id));
}
