import { exportJWK, generateKeyPair, importJWK, type JWK } from "jose";

export type LtiSigningKey = Awaited<ReturnType<typeof importJWK>>;

export type LtiToolKeyPair = {
  kid: string;
  publicJwk: JWK;
  privateJwk: JWK;
};

export async function generateLtiToolKey(kid = `lti-${Date.now().toString(36)}`): Promise<LtiToolKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  privateJwk.kid = kid;
  privateJwk.alg = "RS256";
  return { kid, publicJwk, privateJwk };
}

export function publicJwksFromKeys(keys: readonly LtiToolKeyPair[]): { keys: JWK[] } {
  return { keys: keys.map((key) => key.publicJwk) };
}

export async function importLtiPrivateKey(jwk: JWK): Promise<LtiSigningKey> {
  return importJWK(jwk, "RS256");
}
