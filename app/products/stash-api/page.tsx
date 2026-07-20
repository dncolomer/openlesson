import { ProductLandingPage } from "@/components/ProductLandingPage";
import { STASH_API_PAGE, productPageMetadata } from "@/lib/seo/product-page";

export const metadata = productPageMetadata(STASH_API_PAGE);

export default function StashApiProductPage() {
  return <ProductLandingPage page={STASH_API_PAGE} />;
}
