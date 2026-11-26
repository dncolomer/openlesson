/**
 * Retired public product. Canonical copy is Embeddable Knowledge Verification Protocols.
 */
import { MAPPING_THESIS_LINKS } from "@/lib/science/hub";
import {
  VERIFICATION_APPROACH_COPY,
  VERIFICATION_PLATFORM_COPY,
  VERIFICATION_PRODUCT_COPY,
} from "@/lib/marketing/verification-product";

export const MAPPING_PRODUCT_COPY = {
  ...VERIFICATION_PRODUCT_COPY,
  thesisLinks: MAPPING_THESIS_LINKS,
  directoryEyebrow: VERIFICATION_APPROACH_COPY.directoryEyebrow,
  directoryTitle: VERIFICATION_APPROACH_COPY.directoryTitle,
} as const;

export const MAPPING_PLATFORM_COPY = {
  ...VERIFICATION_PLATFORM_COPY,
  relatedLinks: VERIFICATION_APPROACH_COPY.relatedLinks,
} as const;
