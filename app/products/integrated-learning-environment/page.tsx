import { ProductLandingPage } from "@/components/ProductLandingPage";
import { ILE_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(ILE_PAGE);

export default function IntegratedLearningEnvironmentProductPage() {
  return <ProductLandingPage page={ILE_PAGE} />;
}