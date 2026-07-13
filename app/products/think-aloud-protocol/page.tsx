import { ProductLandingPage } from "@/components/ProductLandingPage";
import { TAP_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(TAP_PAGE);

export default function ThinkAloudProtocolProductPage() {
  return <ProductLandingPage page={TAP_PAGE} />;
}