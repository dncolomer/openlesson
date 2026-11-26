import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Drives shipped tutoring, auth-policy, map-selection, product-intent,
 * TAP Learning-mode, and error-envelope functions — no reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  allowCookieWorkspacePerformance,
  allowProductWorkspaceEvalAccess,
  assertWorkspacePolicy,
  ayclNonOwnerActor,
  ayclPrincipal,
  ayclSubjectId,
  cookieUserPrincipal,
  ileGuestPrincipal,
  persistableOwnerUserId,
  tokenPrincipalIsOwner,
} from "@/lib/workspace-access-policy";
import { resolveScoreParticipantIds } from "@/lib/pow-api/evaluation-subject";
import {
  applySoloThoughtMutation,
  buildTutoringIdleOutcome,
  buildTutoringSpeechOutcome,
  emptySoloThoughtLists,
  planTutoringSessionMutate,
  resolveTutoringContext,
} from "@/lib/tutoring-runtime";
import {
  nextWorkspaceMapSelection,
  emptyWorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import {
  decodePracticeLaunchIntent,
  launchPracticeHref,
  resolveProductIntent,
} from "@/lib/product-intent";
import {
  normalizeIleSessionMode,
  parseIleSessionModeWrite,
  resolveIleSessionModeFromBody,
  resolveIleSessionModeFromSession,
} from "@/lib/learn-mode";
import {
  classifyApiErrorEnvelope,
  jsonError,
} from "@/lib/api-error-envelope";
import { KNOWN_ERROR_CODES, toErrorCode } from "@/lib/api/error-codes";
import { readMapGridSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

describe("workspace access policy", () => {
  it("denies unaffiliated cookie performance and refuses owner-attribution for token principals", () => {
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "stranger",
        workspaceOwnerId: "owner",
      }),
    ).toBe(false);
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "owner",
        workspaceOwnerId: "owner",
      }),
    ).toBe(true);
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isSessionParticipant: true,
      }),
    ).toBe(true);

    const cookie = cookieUserPrincipal("stranger");
    const denied = assertWorkspacePolicy({
      principal: cookie,
      workspaceOwnerId: "owner",
      action: "score_performance",
    });
    expect(denied.ok).toBe(false);

    const aycl = ayclPrincipal({ purchaseId: "buy-1", ownerUserId: "owner" });
    expect(aycl.subjectId).toBe("aycl:buy-1");
    expect(tokenPrincipalIsOwner(aycl)).toBe(false);
    const ayclOk = assertWorkspacePolicy({
      principal: aycl,
      workspaceOwnerId: "owner",
      action: "eval",
    });
    expect(ayclOk.ok).toBe(true);
    if (ayclOk.ok) expect(ayclOk.attributeAsOwner).toBe(false);

    const ile = ileGuestPrincipal({
      guestUserId: "guest-1",
      ownerUserId: "owner",
    });
    expect("error" in ile).toBe(false);
    if (!("error" in ile)) {
      expect(ile.subjectId).toBe("guest-1");
      expect(tokenPrincipalIsOwner(ile)).toBe(false);
    }

    const requireAuth = read("lib/api/require-auth.ts");
    expect(requireAuth).not.toContain("actingUser");
    expect(requireAuth).not.toContain("ayclAccess");
    expect(requireAuth).not.toContain("ileSessionMode");
    expect(requireAuth).toContain("ayclPrincipal");
    expect(requireAuth).toContain("ileGuestPrincipal");
    expect(requireAuth).toContain("subjectId:");
    expect(requireAuth).toContain("persistUserId:");
    expect(requireAuth).toContain("persistIds");

    const productAuth = read("lib/product-workspace-auth.ts");
    expect(productAuth).not.toContain("actingUser");
    expect(productAuth).not.toMatch(/ayclAccess\?:/);
    expect(productAuth).not.toContain("user: User | { id");
    expect(productAuth).toContain("assertWorkspacePolicy");
    expect(productAuth).toContain("workspaceOwnerId");

    expect(existsSync(join(ROOT, "app/api/workspace-learn/performance/route.ts"))).toBe(false);
  });

});

describe("TAP Learning mode write vs read", () => {
  it("write accepts only learning|project; read still understands legacy aliases", () => {
    expect(parseIleSessionModeWrite("project")).toBe("project");
    expect(parseIleSessionModeWrite("learning")).toBe("learning");
    expect(parseIleSessionModeWrite(true)).toBeNull();
    expect(normalizeIleSessionMode("project", "learning", { write: true })).toBe("project");
    expect(resolveIleSessionModeFromBody({ session_mode: "project" }, { write: true })).toBe(
      "project",
    );
    expect(
      resolveIleSessionModeFromBody({ interaction_kind: "exercise" }, { write: true }),
    ).toBe("learning");
    expect(resolveIleSessionModeFromSession({ metadata: { session_mode: "project" } })).toBe(
      "project",
    );
  });
});

describe("one TAP Learning coaching constitution", () => {
  it("dashboard opening_probe is kernel surface plus overlay variables", () => {
    const prompts = read("lib/prompts.ts");
    expect(prompts).toContain("ILE_SURFACE");
    expect(prompts).toContain("ILE_TOOLS_BLOCK");
    expect(prompts).toContain("OVERLAY — opening move variables only");
  });
});

describe("closed error envelope", () => {
  it("jsonError writes nested envelope; unknown codes fall back; no string writers in app/api", async () => {
    expect(KNOWN_ERROR_CODES).toContain("forbidden");
    expect(KNOWN_ERROR_CODES).toContain("flow_embedding_not_found");
    expect(toErrorCode("not_a_real_code")).toBe("internal_error");
    expect(toErrorCode("guest_missing")).toBe("guest_missing");

    const res = jsonError(403, "Nope", "forbidden");
    const body = await res.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(body.error.code).toBe("forbidden");

    const routes = walkRoutes(join(ROOT, "app/api"));
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const withoutComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      if (file.includes("/app/api/oauth/")) continue;
      // Gather deny is a policy body `{ error, warning, allowed }`, not a string envelope.
      if (file.includes("/app/api/learn/gather-resources/")) continue;
      if (
        /NextResponse\.json\(\s*\{\s*error:\s*["'`]/.test(withoutComments) ||
        /NextResponse\.json\(\s*\{\s*error:\s*(?!\{)[a-zA-Z]/.test(withoutComments)
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    expect(offenders, `string error writers: ${offenders.join(", ")}`).toEqual([]);
  });
});
