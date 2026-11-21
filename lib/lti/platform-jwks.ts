import type { JSONWebKeySet } from "jose";

export async function fetchPlatformJwks(keysetUrl: string): Promise<JSONWebKeySet> {
  const url = String(keysetUrl || "").trim();
  if (!url) throw new Error("keyset_url is required");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load platform JWKS");
  const body = (await response.json()) as JSONWebKeySet;
  if (!body || !Array.isArray(body.keys)) throw new Error("Platform JWKS is invalid");
  return body;
}
