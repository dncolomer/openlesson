import { describe, expect, it } from "vitest";
import {
  aggregateLearningWorldModels,
  dedupeSubjectRefs,
  parseIdList,
  resolveModelsTabScope,
  resolveModelsTabScopeFromRequest,
} from "@/lib/agent-v2/models-tab-scope";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";

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
