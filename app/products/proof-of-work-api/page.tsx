import { ProductLandingPage } from "@/components/ProductLandingPage";
import { POW_API_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(POW_API_PAGE);

export default function ProofOfWorkApiProductPage() {
  return <ProductLandingPage page={POW_API_PAGE} />;
}