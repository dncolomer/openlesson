import { ProductLandingPage } from "@/components/ProductLandingPage";
import { ALE_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(ALE_PAGE);

export default function AgenticLearningEnvironmentProductPage() {
  return <ProductLandingPage page={ALE_PAGE} />;
}