import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import {
  PUBLIC_FIELD_DEFAULT_STILL,
  PublicConsoleWash,
  PublicPageField,
} from "@/components/ui/console-frame";
import {
  RETIRED_PRODUCT_BODY,
  RETIRED_PRODUCT_EMAIL,
  RETIRED_PRODUCT_HEADING,
  RETIRED_PRODUCT_MAILTO,
} from "@/lib/retired-product";

export function RetiredProductPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col bg-[#0e1c2c] text-white"
      data-retired-product-page
    >
      <PublicPageField image={PUBLIC_FIELD_DEFAULT_STILL} />
      <PublicConsoleWash />
      <div className="relative z-10 flex min-h-screen flex-col">
        <LandingNav />
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="mx-auto max-w-2xl text-center" data-retired-product-message>
            <h1 className="text-3xl font-medium tracking-[-0.6px] text-white sm:text-4xl">
              {RETIRED_PRODUCT_HEADING}
            </h1>
            <p className="mt-6 text-base leading-relaxed text-neutral-200 sm:text-lg">
              If you are coming from a course, or looking for a learning map or a workspace that
              is no longer here, please contact{" "}
              <a
                href={RETIRED_PRODUCT_MAILTO}
                className="text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                {RETIRED_PRODUCT_EMAIL}
              </a>
              .
            </p>
            <p className="sr-only">{RETIRED_PRODUCT_BODY}</p>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
