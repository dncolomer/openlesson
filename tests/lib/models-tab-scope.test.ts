import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateLearningWorldModels,
  dedupeSubjectRefs,
  parseIdList,
  parseSubjectOptionKey,
  resolveEmbeddingsSubjectSelection,
  resolveModelsTabCanInspectOthers,
  resolveModelsTabScope,
  resolveModelsTabScopeFromRequest,
  shouldLockModelsTabSubjectToSelf,
  subjectOptionKeyFromRef,
} from "@/lib/pow-api/models-tab-scope";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import { readKnowledgePanelSurface } from "../helpers/surface-source";
import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.LEARNER_LWM_EMB_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-e257e60caf66/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  if (rel.endsWith("KnowledgeConfigTrajectoryPanel.tsx")) {
    return readKnowledgePanelSurface();
  }
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("learner self-lock for LWM + Embeddings", () => {
  it("owner in learner mode cannot inspect others; scope forces self user_id", () => {
    // Owner would normally inspect; learner lock wins.
    expect(
      resolveModelsTabCanInspectOthers({
        isOwner: true,
        lockSubjectToSelf: true,
      }),
    ).toBe(false);
    expect(
      resolveModelsTabCanInspectOthers({
        isOwner: true,
        lwmEmbeddingsOnly: true,
      }),
    ).toBe(false);
    expect(
      resolveModelsTabCanInspectOthers({
        isOwner: true,
        interactionMode: "learner",
      }),
    ).toBe(false);
    // Creator owner still inspects
    expect(
      resolveModelsTabCanInspectOthers({
        isOwner: true,
        interactionMode: "creator",
      }),
    ).toBe(true);
    expect(
      resolveModelsTabCanInspectOthers({
        isOwner: false,
        interactionMode: "creator",
      }),
    ).toBe(false);

    expect(shouldLockModelsTabSubjectToSelf({ interactionMode: "learner" })).toBe(
      true,
    );
    expect(shouldLockModelsTabSubjectToSelf({ lwmEmbeddingsOnly: true })).toBe(
      true,
    );
    expect(shouldLockModelsTabSubjectToSelf({ interactionMode: "creator" })).toBe(
      false,
    );

    // Even with canInspectOthers true + other target, lock forces self
    const locked = resolveModelsTabScope({
      mode: "all",
      currentUserId: ME,
      targetUserId: OTHER,
      targetGuestUserId: GUEST,
      canInspectOthers: true,
      lockSubjectToSelf: true,
    });
    expect(locked.mode).toBe("user");
    expect(locked.kind).toBe("single");
    expect(locked.subjects).toEqual([{ user_id: ME }]);
    expect(locked.query).toEqual({ scope: "user", user_id: ME });
    expect(locked.label).toBe("You");

    const embLocked = resolveEmbeddingsSubjectSelection({
      selectedKeys: [`u:${OTHER}`, `g:${GUEST}`],
      currentUserId: ME,
      canInspectOthers: true,
      lockSubjectToSelf: true,
    });
    expect(embLocked.kind).toBe("single");
    expect(embLocked.subjects).toEqual([{ user_id: ME }]);
    expect(embLocked.query.user_id).toBe(ME);
    expect(embLocked.query.user_ids).toBeUndefined();
    expect(embLocked.query.guest_user_id).toBeUndefined();

    writeEvidence(
      "learner-lwm-emb-scope.log",
      [
        "owner_learner_inspect=" +
          resolveModelsTabCanInspectOthers({
            isOwner: true,
            interactionMode: "learner",
          }),
        "owner_creator_inspect=" +
          resolveModelsTabCanInspectOthers({
            isOwner: true,
            interactionMode: "creator",
          }),
        "locked_scope=" + JSON.stringify(locked),
        "emb_locked=" + JSON.stringify(embLocked),
      ].join("\n"),
    );
  });

  it("learner Knowledge path locks pickers; creator still inspects", () => {
    const panel = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    const perf = read("components/WorkspacePerformancePanel.tsx");
    const view = readWorkspaceViewSurface();

    expect(panel).toContain("resolveModelsTabCanInspectOthers");
    expect(panel).toContain("lockSubjectToSelf");
    expect(panel).toContain("data-knowledge-lock-subject-to-self");
    expect(panel).toContain("data-knowledge-can-inspect-others");
    // canInspect derived from pure helper — not bare isOwner alone
    expect(panel).toMatch(
      /canInspectOthers\s*=\s*resolveModelsTabCanInspectOthers/,
    );
    // Force LWM + emb to self when locked
    expect(panel).toContain("setLwmUserId(currentUserId)");
    expect(panel).toContain("setLwmGuestUserId(\"\")");

    // Performance panel threads lock for LWM + Embeddings (not ranking)
    expect(perf).toContain("lockSubjectToSelf={lwmEmbeddingsOnly}");
    expect(perf).toContain('panelView="models"');
    expect(perf).toContain('panelView="lwm"');
    // Creator ranking path does not force lock via lwmEmbeddingsOnly
    expect(view).toContain("lwmEmbeddingsOnly={modeShell.knowledgeLwmEmbeddingsOnly}");

    // UserPicker / multi: disabled self when !canInspectOthers
    expect(panel).toContain("if (!canInspectOthers)");
    expect(panel).toContain("disabled");
    expect(panel).toContain("data-embeddings-user-multiselect=\"false\"");

    writeEvidence(
      "learner-lwm-emb-ui.log",
      [
        "panel_lock_prop=true",
        "panel_resolve_can_inspect=true",
        "perf_lockSubjectToSelf=lwmEmbeddingsOnly",
        "view_shell_flag=true",
        "disabled_picker_when_locked=true",
      ].join("\n"),
    );
  });
});

describe("resolveModelsTabScope", () => {
  it("non-inspectors always resolve to self user scope", () => {
    const r = resolveModelsTabScope({
      mode: "all",
      currentUserId: ME,
      canInspectOthers: false,
    });
    expect(r.mode).toBe("user");
    expect(r.kind).toBe("single");
    expect(r.subjects).toEqual([{ user_id: ME }]);
    expect(r.query).toEqual({ scope: "user", user_id: ME });
    expect(r.query).not.toHaveProperty("subject");
  });

  it("owner user mode targets a specific user", () => {
    const r = resolveModelsTabScope({
      mode: "user",
      currentUserId: ME,
      targetUserId: OTHER,
      canInspectOthers: true,
    });
    expect(r.kind).toBe("single");
    expect(r.subjects).toEqual([{ user_id: OTHER }]);
    expect(r.query.user_id).toBe(OTHER);
    expect(r.query.guest_user_id).toBeUndefined();
  });

  it("owner user mode self uses unique user_id", () => {
    const r = resolveModelsTabScope({
      mode: "user",
      currentUserId: ME,
      targetUserId: ME,
      canInspectOthers: true,
    });
    expect(r.query).toEqual({ scope: "user", user_id: ME });
    expect(r.query).not.toHaveProperty("subject");
  });

  it("owner user mode guest targets guest_user_id", () => {
    const r = resolveModelsTabScope({
      mode: "user",
      currentUserId: ME,
      targetGuestUserId: GUEST,
      canInspectOthers: true,
    });
    expect(r.subjects).toEqual([{ guest_user_id: GUEST }]);
    expect(r.query.guest_user_id).toBe(GUEST);
  });

  it("owner all mode has empty subjects and scope=all", () => {
    const r = resolveModelsTabScope({
      mode: "all",
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.mode).toBe("all");
    expect(r.kind).toBe("all");
    expect(r.subjects).toEqual([]);
    expect(r.query).toEqual({ scope: "all" });
  });

  it("owner user_group mode emits multi-subject query lists", () => {
    const r = resolveModelsTabScope({
      mode: "user_group",
      currentUserId: ME,
      canInspectOthers: true,
      groupMembers: [
        { user_id: ME },
        { user_id: OTHER },
        { guest_user_id: GUEST },
        { user_id: OTHER }, // dup
      ],
    });
    expect(r.mode).toBe("user_group");
    expect(r.kind).toBe("multi");
    expect(r.subjects).toHaveLength(3);
    expect(r.query.scope).toBe("user_group");
    expect(r.query.user_ids?.split(",").sort()).toEqual([ME, OTHER].sort());
    expect(r.query.guest_user_ids).toBe(GUEST);
  });
});

describe("resolveModelsTabScopeFromRequest", () => {
  it("parses user_group id lists from request fields", () => {
    const r = resolveModelsTabScopeFromRequest({
      scope: "user_group",
      user_ids: `${ME},${OTHER}`,
      guest_user_ids: GUEST,
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.kind).toBe("multi");
    expect(r.subjects).toHaveLength(3);
  });

  it("explicit user_id is used; subject token is ignored", () => {
    const r = resolveModelsTabScopeFromRequest({
      scope: "user",
      subject: "me", // deprecated — ignored
      user_id: OTHER,
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.subjects).toEqual([{ user_id: OTHER }]);
    expect(r.query.user_id).toBe(OTHER);
    expect(r.query).not.toHaveProperty("subject");
  });

  it("non-owner cannot open all even if requested", () => {
    const r = resolveModelsTabScopeFromRequest({
      scope: "all",
      currentUserId: ME,
      canInspectOthers: false,
    });
    expect(r.mode).toBe("user");
    expect(r.query.user_id).toBe(ME);
    expect(r.query).not.toHaveProperty("subject");
  });
});

describe("resolveEmbeddingsSubjectSelection", () => {
  it("non-inspectors always resolve to self regardless of selected keys", () => {
    const r = resolveEmbeddingsSubjectSelection({
      selectedKeys: [`u:${OTHER}`, `g:${GUEST}`],
      currentUserId: ME,
      canInspectOthers: false,
    });
    expect(r.mode).toBe("user");
    expect(r.kind).toBe("single");
    expect(r.subjects).toEqual([{ user_id: ME }]);
    expect(r.query).toEqual({ scope: "user", user_id: ME });
  });

  it("0 selected keys falls back to self (owner)", () => {
    const r = resolveEmbeddingsSubjectSelection({
      selectedKeys: [],
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.kind).toBe("single");
    expect(r.query).toEqual({ scope: "user", user_id: ME });
  });

  it("1 selected key uses single user scope", () => {
    const r = resolveEmbeddingsSubjectSelection({
      selectedKeys: [`u:${OTHER}`],
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.mode).toBe("user");
    expect(r.kind).toBe("single");
    expect(r.query.user_id).toBe(OTHER);
    expect(r.query.user_ids).toBeUndefined();
  });

  it("1 guest key uses single guest scope", () => {
    const r = resolveEmbeddingsSubjectSelection({
      selectedKeys: [`g:${GUEST}`],
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.kind).toBe("single");
    expect(r.query.guest_user_id).toBe(GUEST);
  });

  it("2+ keys use user_group multi scope with id lists", () => {
    const r = resolveEmbeddingsSubjectSelection({
      selectedKeys: [`u:${ME}`, `u:${OTHER}`, `g:${GUEST}`, `u:${OTHER}`],
      currentUserId: ME,
      canInspectOthers: true,
    });
    expect(r.mode).toBe("user_group");
    expect(r.kind).toBe("multi");
    expect(r.subjects).toHaveLength(3);
    expect(r.query.scope).toBe("user_group");
    expect(r.query.user_ids?.split(",").sort()).toEqual([ME, OTHER].sort());
    expect(r.query.guest_user_ids).toBe(GUEST);
  });

  it("parseSubjectOptionKey / subjectOptionKeyFromRef round-trip", () => {
    expect(parseSubjectOptionKey(`u:${ME}`)).toEqual({ user_id: ME });
    expect(parseSubjectOptionKey(`g:${GUEST}`)).toEqual({ guest_user_id: GUEST });
    expect(subjectOptionKeyFromRef({ user_id: ME })).toBe(`u:${ME}`);
    expect(subjectOptionKeyFromRef({ guest_user_id: GUEST })).toBe(`g:${GUEST}`);
  });
});

describe("parseIdList / dedupeSubjectRefs", () => {
  it("parses and trims comma lists", () => {
    expect(parseIdList(" a, b , ,c ")).toEqual(["a", "b", "c"]);
    expect(parseIdList(null)).toEqual([]);
  });

  it("dedupes subject refs preferring guest key", () => {
    const out = dedupeSubjectRefs([
      { user_id: ME },
      { user_id: ME },
      { guest_user_id: GUEST, user_id: OTHER },
    ]);
    expect(out).toEqual([{ user_id: ME }, { guest_user_id: GUEST }]);
  });
});

describe("aggregateLearningWorldModels", () => {
  it("unions strengths and appetite; averages scores", () => {
    const a = emptyLearningWorldModel("ws");
    a.learning_profile.strengths = ["algebra", "proofs"];
    a.evidence_appetite.want_more = ["reflection"];
    a.scores_snapshot.verification_score = 80;
    a.scores_snapshot.ghc_score = 40;

    const b = emptyLearningWorldModel("ws");
    b.learning_profile.strengths = ["algebra", "debugging"];
    b.evidence_appetite.want_more = ["decision_rationale"];
    b.evidence_appetite.saturated = ["tool_crud_events"];
    b.scores_snapshot.verification_score = 60;
    b.scores_snapshot.ghc_score = 50;

    const agg = aggregateLearningWorldModels({ workspaceId: "ws", models: [a, b] });
    expect(agg.learning_profile.strengths.sort()).toEqual(
      ["algebra", "debugging", "proofs"].sort(),
    );
    expect(agg.evidence_appetite.want_more.sort()).toEqual(
      ["decision_rationale", "reflection"].sort(),
    );
    expect(agg.evidence_appetite.saturated).toEqual(["tool_crud_events"]);
    expect(agg.scores_snapshot.verification_score).toBe(70);
    expect(agg.scores_snapshot.ghc_score).toBe(45);
  });

  it("returns empty model when no inputs", () => {
    const agg = aggregateLearningWorldModels({ workspaceId: "ws", models: [] });
    expect(agg.workspace_id).toBe("ws");
    expect(agg.learning_profile.strengths).toEqual([]);
    expect(agg.scores_snapshot.verification_score).toBeNull();
  });
});
