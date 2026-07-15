import { ProductLandingPage } from "@/components/ProductLandingPage";
import { TIM_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(TIM_PAGE);

export default function TraceInterruptionModelPage() {
  return <ProductLandingPage page={TIM_PAGE} />;
}