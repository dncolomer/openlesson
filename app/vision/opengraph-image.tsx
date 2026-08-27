import {
  createStaticOgImageHandler,
  OG_CONTENT_TYPE,
  OG_SIZE,
  staticOgAlt,
} from "@/lib/og/create-static-og";

export const runtime = "nodejs";
export const alt = staticOgAlt("vision");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default createStaticOgImageHandler("vision");
