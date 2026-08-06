import {
  composeStandardOgImage,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og/compose";
import { standardShareAlt } from "@/lib/og/standard";

export const alt = standardShareAlt();
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Entity routes still serve a dedicated OG path; card is always the unsys standard. */
export default async function Image() {
  return composeStandardOgImage();
}
