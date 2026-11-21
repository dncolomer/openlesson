import type { NextRequest } from "next/server";

export async function readLtiFormBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(json)) {
      out[key] = String(value ?? "");
    }
    return out;
  }
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

export function loginInitiationFromRequest(
  req: NextRequest,
  body: Record<string, string>,
): URLSearchParams {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  for (const [key, value] of Object.entries(body)) {
    if (value) params.set(key, value);
  }
  return params;
}
