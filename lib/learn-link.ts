import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { buildGuestLinkUrl } from "@/lib/guest-link-access";

export { createPrivateToken, hashPrivateToken };

export function buildIleSessionUrl(baseUrl: string, privateToken: string) {
  return buildGuestLinkUrl(baseUrl, "ile", privateToken);
}
