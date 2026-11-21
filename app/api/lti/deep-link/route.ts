import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { jsonError } from "@/lib/api-error-envelope";
import { deepLinkContentItem, deepLinkReturnForm, signDeepLinkingResponse } from "@/lib/lti/deep-link";
import { importLtiPrivateKey } from "@/lib/lti/keys";
import { readLtiFormBody } from "@/lib/lti/form-body";
import { readLtiLaunchSession } from "@/lib/lti/request-session";
import { getOrCreateToolKeys } from "@/lib/lti/store";
import type { LtiDeepLinkCatalogItem } from "@/lib/lti/deep-link";
import type { ProductFlowKind } from "@/lib/product-flow";

export const runtime = "nodejs";

function catalogItemFromBody(body: Record<string, string>): LtiDeepLinkCatalogItem | null {
  const type = String(body.type || "").trim();
  if (type === "create_region") return { type: "create_region" };
  if (type === "region") {
    const id = String(body.id || "").trim();
    if (!id) return null;
    return {
      type: "region",
      id,
      name: String(body.name || "Knowledge region"),
      kind: (String(body.kind || "solve") as ProductFlowKind) || "solve",
    };
  }
  if (type === "flow") {
    const publicToken = String(body.publicToken || body.flow_token || "").trim();
    if (!publicToken) return null;
    return {
      type: "flow",
      id: String(body.id || publicToken),
      name: String(body.name || "Flow"),
      kind: (String(body.kind || "solve") as ProductFlowKind) || "solve",
      publicToken,
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await readLtiLaunchSession();
    if (!session?.instructor) return jsonError(403, "Instructor launch required");
    if (!session.deepLinking?.deep_link_return_url) {
      return jsonError(400, "Deep Linking return URL is missing");
    }
    const body = await readLtiFormBody(req);
    const item = catalogItemFromBody(body);
    if (!item) return jsonError(400, "Select a flow or knowledge region");
    const keys = await getOrCreateToolKeys();
    const key = keys[0];
    if (!key) return jsonError(500, "Tool key is missing");
    const jwt = await signDeepLinkingResponse({
      issuer: getAppOrigin(req),
      clientId: session.clientId,
      deploymentId: session.deploymentId,
      settings: session.deepLinking,
      contentItems: [deepLinkContentItem(getAppOrigin(req), item)],
      privateKey: await importLtiPrivateKey(key.privateJwk),
      kid: key.kid,
    });
    return new NextResponse(deepLinkReturnForm(session.deepLinking.deep_link_return_url, jwt), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deep Linking failed";
    return jsonError(500, message);
  }
}
