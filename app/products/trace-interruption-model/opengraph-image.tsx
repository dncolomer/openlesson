import {
  createStaticOgImageHandler,
  OG_CONTENT_TYPE,
  OG_SIZE,
  staticOgAlt,
} from "@/lib/og/create-static-og";

export const alt = staticOgAlt("product:trace-interruption-model");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default createStaticOgImageHandler("product:trace-interruption-model");
