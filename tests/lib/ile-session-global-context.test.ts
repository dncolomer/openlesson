import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleSessionContextWrite,
  createIleSessionContext,
  createIleSessionContextStore,
  mergeLegacyIleChapterWorkspaces,
  parseIleSessionContextStored,
} from "@/lib/ile-session-global-context";

const ROOT = join(__dirname, "../..");

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a5fcb6d60ed5/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ILE session-global context store", () => {
  it("keeps canvas/notebook/thought/chat when the focused chapter changes", () => {
    const store = createIleSessionContextStore();
    store.focus("chapter-1");
    store.write("chapter-1", {
      whiteboardData: "canvas-png",
      notebookContent: "notes from chapter 1",
      chatMessages: [{ id: "m1", role: "user", content: "hello" }],
      pendingChatMessage: "queued",
    });
    store.write("chapter-1", (current) => ({
      chatMessages: [...current.chatMessages, { id: "m2", role: "assistant", content: "hi" }],
    }));

    const afterFirst = store.read("chapter-1");
    expect(afterFirst.whiteboardData).toBe("canvas-png");
    expect(afterFirst.notebookContent).toBe("notes from chapter 1");
    expect(afterFirst.chatMessages.map((m) => m.id)).toEqual(["m1", "m2"]);

    store.focus("chapter-2");
    const afterFocus = store.read("chapter-2");
    expect(afterFocus).toEqual(afterFirst);
    expect(afterFocus.whiteboardData).toBe("canvas-png");
    expect(afterFocus.notebookContent).toBe("notes from chapter 1");
    expect(afterFocus.chatMessages).toHaveLength(2);
    expect(afterFocus.pendingChatMessage).toBe("queued");

    store.write("chapter-2", { notebookContent: "shared notebook append" });
    expect(store.read("chapter-1").notebookContent).toBe("shared notebook append");
    expect(store.read("chapter-2").whiteboardData).toBe("canvas-png");

    // Hook write algebra: chapter key is ignored; one session context.
    let session = createIleSessionContext();
    session = applyIleSessionContextWrite(session, "chapter-1", {
      whiteboardData: "hook-canvas",
      notebookContent: "hook-notes",
      chatMessages: [{ id: "h1", role: "user", content: "q" }],
    });
    session = applyIleSessionContextWrite(session, "chapter-2", (current) => ({
      chatMessages: [...current.chatMessages, { id: "h2", role: "assistant", content: "a" }],
    }));
    expect(session.whiteboardData).toBe("hook-canvas");
    expect(session.notebookContent).toBe("hook-notes");
    expect(session.chatMessages.map((m) => m.id)).toEqual(["h1", "h2"]);

    const hook = readFileSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"), "utf8");
    expect(existsSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"))).toBe(true);
    expect(hook).toContain("applyIleSessionContextWrite");
    expect(hook).toContain("const [sessionContext, setSessionContext]");
    expect(hook).toContain("activeWorkspace = sessionContext");

    const merged = mergeLegacyIleChapterWorkspaces({
      a: { notebookContent: "A", chatMessages: [{ id: "a", role: "user", content: "a" }] },
      b: { whiteboardData: "B", chatMessages: [{ id: "b", role: "user", content: "b" }] },
    });
    expect(merged.notebookContent).toBe("A");
    expect(merged.whiteboardData).toBe("B");
    expect(merged.chatMessages.map((m) => m.id)).toEqual(["a", "b"]);

    const parsed = parseIleSessionContextStored(
      JSON.stringify({ notebookContent: "solo", chatMessages: [] }),
    );
    expect(parsed?.notebookContent).toBe("solo");

    writeScratch(
      "ile-session-global-context-excerpts.txt",
      JSON.stringify({
        afterFocusNotebook: afterFocus.notebookContent,
        sharedAfterWrite: store.read("chapter-1").notebookContent,
        chatIds: store.read("chapter-2").chatMessages.map((m) => m.id),
      }),
    );
  });
});
