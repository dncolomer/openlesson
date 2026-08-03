/**
 * Pure clone arm / disarm / target-resolve logic.
 * Drives shipped helpers — no re-implementation of paste rules.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterClonePaste,
  armClone,
  buildCloneInsertPayload,
  cancelCloneArm,
  cloneArmAfterSelectionChange,
  createDisarmedCloneState,
  disarmClone,
  isCloneArmed,
  resolveClonePasteTarget,
  shouldInterceptEmptyClickForClone,
} from "@/lib/clone-block";

const SCRATCH =
  process.env.CLONE_BLOCK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-172de092c1c8/implementer";

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

describe("clone arm / disarm", () => {
  it("arms with source id; empty id stays disarmed", () => {
    const armed = armClone("block-abc");
    expect(armed).toEqual({ armed: true, sourceBlockId: "block-abc" });
    expect(isCloneArmed(armed)).toBe(true);
    expect(shouldInterceptEmptyClickForClone(armed)).toBe(true);

    expect(armClone("")).toEqual(createDisarmedCloneState());
    expect(armClone("   ")).toEqual(createDisarmedCloneState());
    expect(isCloneArmed(createDisarmedCloneState())).toBe(false);
    expect(shouldInterceptEmptyClickForClone(null)).toBe(false);

    expect(disarmClone()).toEqual(createDisarmedCloneState());
    expect(cancelCloneArm(armed)).toEqual(createDisarmedCloneState());
    expect(afterClonePaste(armed)).toEqual(createDisarmedCloneState());
  });

  it("clears arm when selection leaves the source block", () => {
    const armed = armClone("src-1");
    expect(
      cloneArmAfterSelectionChange({
        state: armed,
        soleSelectedBlockId: "src-1",
      }),
    ).toEqual(armed);
    expect(
      cloneArmAfterSelectionChange({
        state: armed,
        soleSelectedBlockId: "other",
      }),
    ).toEqual(createDisarmedCloneState());
    expect(
      cloneArmAfterSelectionChange({
        state: armed,
        soleSelectedBlockId: null,
      }),
    ).toEqual(createDisarmedCloneState());
  });
});

describe("resolveClonePasteTarget", () => {
  it("accepts placeable empty; rejects occupied / unusable / not armed", () => {
    const armed = armClone("src-1");
    const occupied = new Set(["2:2", "3:3"]);
    const unusable = new Set(["4:4"]);

    const ok = resolveClonePasteTarget({
      state: armed,
      target: { row: 1, col: 1 },
      occupiedKeys: occupied,
      unusableKeys: unusable,
    });
    expect(ok).toEqual({
      ok: true,
      sourceBlockId: "src-1",
      target: { row: 1, col: 1 },
    });

    expect(
      resolveClonePasteTarget({
        state: armed,
        target: { row: 2, col: 2 },
        occupiedKeys: occupied,
        unusableKeys: unusable,
      }),
    ).toEqual({ ok: false, reason: "occupied" });

    expect(
      resolveClonePasteTarget({
        state: armed,
        target: { row: 4, col: 4 },
        occupiedKeys: occupied,
        unusableKeys: unusable,
      }),
    ).toEqual({ ok: false, reason: "unusable" });

    expect(
      resolveClonePasteTarget({
        state: createDisarmedCloneState(),
        target: { row: 1, col: 1 },
        occupiedKeys: occupied,
      }),
    ).toEqual({ ok: false, reason: "not_armed" });

    expect(
      resolveClonePasteTarget({
        state: armed,
        target: null,
      }),
    ).toEqual({ ok: false, reason: "invalid_target" });

    // After paste arm clears — next resolve fails
    const after = afterClonePaste(armed);
    expect(
      resolveClonePasteTarget({
        state: after,
        target: { row: 1, col: 1 },
      }).ok,
    ).toBe(false);

    writeEvidence(
      "clone-block.log",
      [
        "arm=" + JSON.stringify(armed),
        "paste_ok=" + JSON.stringify(ok),
        "reject_occupied=occupied",
        "reject_unusable=unusable",
        "after_paste_disarmed=" + JSON.stringify(after),
        "payload=" +
          JSON.stringify(
            buildCloneInsertPayload({
              source: {
                title: "Quadratic equations",
                description: "Solve ax^2+bx+c=0",
                planning_prompt: "Focus on factoring",
                local_context: { notes: "handout" },
              },
              target: { row: 1, col: 1 },
            }),
          ),
      ].join("\n"),
    );
  });

  it("buildCloneInsertPayload copies content; no graph edges; 1×1 at target", () => {
    const payload = buildCloneInsertPayload({
      source: {
        title: "Derivatives",
        description: "Rate of change",
        planning_prompt: "Use tangent intuition",
        local_context: { notes: "n" },
        is_start: true,
      },
      target: { row: 7, col: 9 },
    });
    expect(payload.title).toBe("Derivatives");
    expect(payload.description).toBe("Rate of change");
    expect(payload.planning_prompt).toBe("Use tangent intuition");
    expect(payload.local_context).toEqual({ notes: "n" });
    expect(payload.is_start).toBe(false);
    expect(payload.next_block_ids).toEqual([]);
    expect(payload.lock_until_block_ids).toEqual([]);
    expect(payload.position_x).toBe(9);
    expect(payload.position_y).toBe(7);
    expect(payload.span_w).toBe(1);
    expect(payload.span_h).toBe(1);
    expect(payload.shape_cells).toBeNull();
    expect(payload.status).toBe("available");
  });
});
