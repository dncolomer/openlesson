import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";

export { createPrivateToken, hashPrivateToken };

export function buildIleSessionUrl(baseUrl: string, privateToken: string) {
  return `${baseUrl.replace(/\/$/, "")}/ile/session/${privateToken}`;
}
