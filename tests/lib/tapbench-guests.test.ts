import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  assertTapbenchGuestForKey,
  memoryTapbenchGuestStore,
  resetTapbenchGuestStoreForTests,
  tapbenchGuestIdFromRequest,
} from "@/lib/tapbench/guests";
import { bufferSubjectId } from "@/lib/pow-api/stash-api";

const ROOT = join(__dirname, "../..");

describe("TAPBench guests (one key, many runs)", () => {
  beforeEach(() => {
    resetTapbenchGuestStoreForTests();
  });

  it("reads guest id from header, query, or body", () => {
    const header = new NextRequest("http://localhost/x", {
      headers: { "X-Tapbench-Guest": "g-1" },
    });
    expect(tapbenchGuestIdFromRequest(header, {})).toBe("g-1");
    const query = new NextRequest("http://localhost/x?guest_user_id=g-2");
    expect(tapbenchGuestIdFromRequest(query, {})).toBe("g-2");
    const body = new NextRequest("http://localhost/x");
    expect(tapbenchGuestIdFromRequest(body, { guest_user_id: "g-3" })).toBe("g-3");
  });

  it("stores and looks up guests per operator key", async () => {
    const row = await memoryTapbenchGuestStore.insert({
      id: "g-a",
      key_id: "k-1",
      guest_user_id: "g-a",
      workspace_id: "ws-1",
      label: "run 1",
      created_at: new Date().toISOString(),
      stopped_at: null,
    });
    expect(row.guest_user_id).toBe("g-a");
    const listed = await memoryTapbenchGuestStore.listByKey("k-1");
    expect(listed).toHaveLength(1);
    const found = await assertTapbenchGuestForKey(memoryTapbenchGuestStore, "k-1", "g-a");
    expect(found.label).toBe("run 1");
    await expect(assertTapbenchGuestForKey(memoryTapbenchGuestStore, "k-1", "missing")).rejects.toMatchObject({
      code: "guest_not_found",
    });
  });

  it("isolates TAP buffers per TAPBench guest", () => {
    expect(
      bufferSubjectId({
        auth_method: "tapbench_key",
        user_id: "issuer",
        guest_user_id: "g-a",
        key_id: "k-1",
      }),
    ).toBe("tapbench-guest:g-a");
    expect(
      bufferSubjectId({
        auth_method: "tapbench_key",
        user_id: "issuer",
        guest_user_id: "g-b",
        key_id: "k-1",
      }),
    ).toBe("tapbench-guest:g-b");
  });

  it("ships guests, snapshot, and region routes", () => {
    for (const rel of [
      "app/api/v3/tapbench/tasks/[id]/guests/route.ts",
      "app/api/v3/tapbench/tasks/[id]/snapshot/route.ts",
      "app/api/v3/tapbench/tasks/[id]/region/route.ts",
    ]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(true);
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain("requireTapbenchTaskAuth");
    }
  });
});
