/**
 * P1–P10 shipped helpers — drive real policy functions, not remounted shells.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyWorkspaceGridOpsUpdatedNodes,
  buildWorkspaceGridOpsBody,
  postWorkspaceGridOp,
  WORKSPACE_GRID_OPS_PATH,
  withAyclToken,
} from "@/lib/workspace-grid-ops-client";
import {
  buildLearnerLaunchBody,
  buildLearnerPromptSaveBody,
  WORKSPACE_LEARNER_LAUNCH_PATH,
} from "@/lib/workspace-learner-writes";
import {
  resolveIleActingParticipantId,
  resolveGuestLinkAttribution,
} from "@/lib/session-participant-identity";
import { authContextFromTapAccess } from "@/lib/tap-score-session-auth";
import {
  buildTapOpeningQuestionFallback,
  buildTapPracticeOpeningQuestionFallback,
  buildTapStartingTopicsFallback,
  resolveTapOpeningQuestionFromLlm,
  resolveTapStartingTopicsFromLlm,
} from "@/lib/tap-score";
import {
  tapTracePayload,
  shouldIncludePracticeOnTapTrace,
  TAP_SESSION_RUNTIME_PATHS,
} from "@/lib/tap-session-runtime";
import {
  buildIleSessionChatBody,
  ILE_SESSION_CHAT_PATH,
  postIleSessionChat,
} from "@/lib/session-chat-client";
import {
  decideIleKeyboardAction,
} from "@/lib/ile-keyboard-mode";
import {
  decideProductWorkspaceAccess,
  PRODUCT_AUTH_OWNER_OR_ORG_ADMIN,
  PRODUCT_AUTH_EVAL_MEMBER_AYCL_OWNER,
} from "@/lib/product-workspace-auth";
import type { Block, Workspace } from "@/lib/domain/types";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-38697a5157ad/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("P1–P10 shipped helpers", () => {
  it("grid-ops client, learner writes, attribution, PoW/TAP/ILE/auth", async () => {
    const body = buildWorkspaceGridOpsBody({
      workspaceId: "ws-1",
      op: "merge",
      blockIds: ["a", "b"],
      ayclToken: "tok",
    });
    expect(body.workspaceId).toBe("ws-1");
    expect(body.op).toBe("merge");
    expect(body.ayclToken).toBe("tok");
    expect(withAyclToken({ workspaceId: "ws-1" }, null).ayclToken).toBeUndefined();
    const merged = applyWorkspaceGridOpsUpdatedNodes(
      [{ id: "a", title: "old" }],
      [{ id: "a", title: "new" }, { id: "b", title: "added" }],
    );
    expect(merged.find((n) => n.id === "a")?.title).toBe("new");
    expect(merged.some((n) => n.id === "b")).toBe(true);

    const posted: { url: string; method?: string; raw: string }[] = [];
    const result = await postWorkspaceGridOp(
      { workspaceId: "ws-1", op: "split", ayclToken: "t" },
      async (url, init) => {
        posted.push({ url: String(url), method: init?.method, raw: String(init?.body || "") });
        return new Response(JSON.stringify({ updatedNodes: [] }), { status: 200 });
      },
    );
    expect(posted[0]?.url).toBe(WORKSPACE_GRID_OPS_PATH);
    expect(posted[0]?.method).toBe("POST");
    expect(posted[0]?.raw).toContain("split");
    expect(result.ok).toBe(true);

    const launch = buildLearnerLaunchBody({
      workspaceId: "ws-1",
      blockId: "b1",
      sessionMode: "project",
      ayclToken: "ay",
    });
    expect(launch.sessionMode).toBe("project");
    expect(launch.ayclToken).toBe("ay");
    const prompt = buildLearnerPromptSaveBody({
      workspaceId: "ws-1",
      blockId: "b1",
      planningPrompt: "hi",
    });
    expect(prompt.planningPrompt).toBe("hi");

    const guest = resolveIleActingParticipantId({
      ownerUserId: "owner",
      guestUserId: "guest-1",
    });
    expect(guest).toBe("guest-1");
    const assigned = resolveIleActingParticipantId({
      ownerUserId: "owner",
      assignedUserId: "member-1",
      guestUserId: "guest-1",
    });
    expect(assigned).toBe("member-1");
    const ownerOnly = resolveIleActingParticipantId({ ownerUserId: "owner" });
    expect(ownerOnly).toBe("owner");
    expect(resolveGuestLinkAttribution({ guestUserId: "g" }).guestUserId).toBe("g");

    const tapAuth = authContextFromTapAccess(
      { userId: "u1", guestUserId: null, organizationId: "org-1" },
      "tap-chat",
    );
    expect(tapAuth.user_id).toBe("u1");
    expect(tapAuth.organization_id).toBe("org-1");
    expect(tapAuth.key_id).toBe("tap-chat");

    const brief = {
      plan: { title: "Algebra", description: "" },
      nodes: [{ id: "n1", title: "Linear", description: "" }],
      files: [],
    };
    expect(buildTapOpeningQuestionFallback(brief as never).length).toBeGreaterThan(0);
    expect(buildTapPracticeOpeningQuestionFallback(brief as never).length).toBeGreaterThan(0);
    expect(buildTapStartingTopicsFallback(brief as never).length).toBeGreaterThan(0);
    expect(resolveTapOpeningQuestionFromLlm("  live  ", brief as never, false)).toBe("live");
    expect(resolveTapOpeningQuestionFromLlm("", brief as never, false)).toBe(
      buildTapOpeningQuestionFallback(brief as never),
    );
    expect(resolveTapOpeningQuestionFromLlm(null, brief as never, true)).toBe(
      buildTapPracticeOpeningQuestionFallback(brief as never),
    );
    expect(resolveTapStartingTopicsFromLlm(null, brief as never)).toEqual(
      buildTapStartingTopicsFallback(brief as never),
    );
    expect(TAP_SESSION_RUNTIME_PATHS.start).toContain("start");
    expect(TAP_SESSION_RUNTIME_PATHS.complete).toContain("complete");

    expect(shouldIncludePracticeOnTapTrace({ practice: true })).toBe(true);
    expect(shouldIncludePracticeOnTapTrace({ practice: false })).toBe(false);
    expect(tapTracePayload({ type: "system1", practice: true }).practice).toBe(true);
    expect(tapTracePayload({ type: "system1", practice: false }).practice).toBeUndefined();

    const chatBody = buildIleSessionChatBody({
      problem: "p",
      messages: [{ role: "user", content: "hi" }],
      sessionId: "s1",
      ileToken: "ile",
    });
    expect(chatBody.problem).toBe("p");
    expect(chatBody.ileToken).toBe("ile");
    const chat = await postIleSessionChat(
      { problem: "p", messages: [{ role: "user", content: "hi" }] },
      async (url, init) => {
        expect(String(url)).toBe(ILE_SESSION_CHAT_PATH);
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
      },
    );
    expect(chat.ok).toBe(true);
    expect(chat.data.message).toBe("ok");

    expect(decideIleKeyboardAction({ mode: "project", key: "Delete" })).toBe("project_stash");
    expect(decideIleKeyboardAction({ mode: "helios", key: "Enter" })).toBe("helios_send");

    expect(
      decideProductWorkspaceAccess({
        isOwner: false,
        isOrgAdmin: true,
        evalAllowed: false,
        ayclAccess: false,
        flags: PRODUCT_AUTH_OWNER_OR_ORG_ADMIN,
      }).allowed,
    ).toBe(true);
    expect(
      decideProductWorkspaceAccess({
        isOwner: false,
        isOrgAdmin: false,
        evalAllowed: true,
        ayclAccess: false,
        flags: PRODUCT_AUTH_EVAL_MEMBER_AYCL_OWNER,
      }).allowed,
    ).toBe(true);
    expect(
      decideProductWorkspaceAccess({
        isOwner: false,
        isOrgAdmin: false,
        evalAllowed: false,
        ayclAccess: false,
        flags: PRODUCT_AUTH_OWNER_OR_ORG_ADMIN,
      }).allowed,
    ).toBe(false);

    const sampleBlock: Block = {
      id: "b",
      title: "t",
      description: "",
      is_start: false,
      next_block_ids: [],
      status: "not_started",
      span_w: 2,
    };
    const sampleWs: Workspace = {
      id: "w",
      title: "T",
      root_topic: "T",
      status: "active",
      aycl_category: "math",
    };
    expect(sampleBlock.span_w).toBe(2);
    expect(sampleWs.aycl_category).toBe("math");

    const view = read("components/WorkspaceView.tsx");
    const list = read("components/SessionList.tsx");
    const launchRoute = read("app/api/workspace/learner-launch/route.ts");
    const ileAuth = read("lib/ile-link-auth.ts");
    const tapAuthSrc = read("lib/tap-score-session-auth.ts");
    const tapChat = read("app/api/workspace-tap-score/chat/route.ts");
    const ileSpeech = read("app/api/workspace-ile/speech/route.ts");
    const ileIdle = read("app/api/workspace-ile/idle/route.ts");
    const tapSpeech = read("app/api/workspace-tap-score/speech/route.ts");
    const tapIdle = read("app/api/workspace-tap-score/idle/route.ts");
    const tapScore = read("lib/tap-score.ts");
    const exercise = read("components/ExerciseTapClient.tsx");
    const tapClient = read("components/TapScoreClient.tsx");
    const sessionView = read("components/SessionView.tsx");
    const stash = read("app/api/v3/stash/workspaces/[id]/stash/route.ts");
    const tapLinks = read("app/api/workspace/tap-links/route.ts");
    const domain = read("lib/domain/types.ts");

    expect(view).toContain("from \"@/lib/domain/types\"");
    expect(view).toContain("postWorkspaceGridOp");
    expect(view).toContain("WORKSPACE_LEARNER_LAUNCH_PATH");
    expect(view).not.toMatch(/from\("blocks"\)\s*\n\s*\.update/);
    expect(view).not.toContain("router.refresh()");
    expect(list).toContain("postWorkspaceGridOp");
    expect(list).not.toContain("router.refresh()");
    expect(list).not.toContain("interface Block");
    expect(exercise).toContain("TAP_SESSION_RUNTIME_PATHS.start");
    expect(exercise).toContain("TAP_SESSION_RUNTIME_PATHS.complete");
    expect(tapClient).toContain("TAP_SESSION_RUNTIME_PATHS.start");
    expect(tapClient).toContain("TAP_SESSION_RUNTIME_PATHS.complete");
    expect(launchRoute).toContain("guardWorkspaceRoute");
    expect(ileAuth).toContain("resolveIleActingParticipantId");
    expect(tapAuthSrc).toContain("workspaceRow?.organization_id");
    expect(tapChat).toContain("uploadWorkspaceProofOfWork");
    expect(ileSpeech).toContain("uploadWorkspaceProofOfWork");
    expect(ileIdle).toContain("uploadWorkspaceProofOfWork");
    expect(tapSpeech).toContain("uploadWorkspaceProofOfWork");
    expect(tapIdle).toContain("uploadWorkspaceProofOfWork");
    expect(tapScore).toContain("buildTapStartingTopicsFallback");
    expect(tapScore).toContain("buildTapOpeningQuestionFallback");
    expect(tapScore).not.toContain("Failed to generate practice content");
    expect(exercise).toContain("tapTracePayload");
    expect(tapClient).toContain("tapTracePayload");
    expect(sessionView).toContain("postIleSessionChat");
    expect(sessionView).toContain("decideIleKeyboardAction");
    expect(sessionView).not.toContain('from "./HeliosChat"');
    expect(stash).toContain("authenticateStashRequest");
    expect(tapLinks).toContain("requireProductWorkspaceLinkAuth");
    expect(domain).toContain("span_w");
    expect(domain).toContain("aycl_category");

    writeScratch(
      "p1-p10-excerpts.txt",
      [
        `gridOpsPath=${WORKSPACE_GRID_OPS_PATH}`,
        `learnerLaunch=${WORKSPACE_LEARNER_LAUNCH_PATH}`,
        `ileGuestActing=${guest}`,
        `ileAssignedActing=${assigned}`,
        `tapOrg=${tapAuth.organization_id}`,
        `practiceTrace=${shouldIncludePracticeOnTapTrace({ practice: true })}`,
        `sessionChat=${ILE_SESSION_CHAT_PATH}`,
        `tapStart=${TAP_SESSION_RUNTIME_PATHS.start}`,
        `tapComplete=${TAP_SESSION_RUNTIME_PATHS.complete}`,
        "one grid-ops client: WorkspaceView + SessionList",
        "domain types: shell re-exports lib/domain/types",
        "learner launch/prompt via token-aware APIs",
        "happy-path mutate: no router.refresh",
        "ILE guest acting participant, TAP cookie org from workspace",
        "TAP/ILE speech/idle/chat: uploadWorkspaceProofOfWork",
        "TAP shells: TAP_SESSION_RUNTIME_PATHS start/complete + tapTracePayload",
        "TAP LLM miss uses resolveTap*FromLlm fallbacks",
        "ILE: postIleSessionChat + decideIleKeyboardAction",
        "product-auth decideProductWorkspaceAccess; stash authenticateStashRequest",
      ].join("\n"),
    );
  });
});
