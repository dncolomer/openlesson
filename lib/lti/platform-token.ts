import { agsTokenRequestBody, signAgsClientAssertion } from "@/lib/lti/ags";
import { importLtiPrivateKey } from "@/lib/lti/keys";
import { getLtiPlatformById, getOrCreateToolKeys } from "@/lib/lti/store";

export async function requestLtiPlatformToken(input: {
  platformId: string;
  scopes: string[];
}): Promise<string> {
  const platform = await getLtiPlatformById(input.platformId);
  if (!platform?.authTokenUrl) return "";
  const keys = await getOrCreateToolKeys();
  const key = keys[0];
  if (!key) return "";
  const assertion = await signAgsClientAssertion({
    tokenUrl: platform.authTokenUrl,
    clientId: platform.clientId,
    privateKey: await importLtiPrivateKey(key.privateJwk),
    kid: key.kid,
  });
  const response = await fetch(platform.authTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: agsTokenRequestBody(assertion, input.scopes).toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string };
  if (!response.ok) {
    throw new Error(`LTI token ${response.status}`);
  }
  return String(payload.access_token || "").trim();
}
