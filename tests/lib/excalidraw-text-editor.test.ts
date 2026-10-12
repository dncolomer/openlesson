import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commitOpenExcalidrawTextEditor } from "@/lib/excalidraw-text-editor";

class TestKeyboardEvent {
  type: string;
  key: string;
  code: string;
  bubbles: boolean;
  cancelable: boolean;
  constructor(
    type: string,
    init: { key: string; code: string; bubbles: boolean; cancelable: boolean },
  ) {
    this.type = type;
    this.key = init.key;
    this.code = init.code;
    this.bubbles = init.bubbles;
    this.cancelable = init.cancelable;
  }
}

describe("commitOpenExcalidrawTextEditor", () => {
  const previous = (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent;
  beforeAll(() => {
    (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = TestKeyboardEvent;
  });
  afterAll(() => {
    (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = previous;
  });

  it("asks the open canvas editor to submit before blur", () => {
    const seen: string[] = [];
    const editor = {
      isConnected: true,
      dispatchEvent(event: Event) {
        seen.push(event.type);
        this.isConnected = false;
        return true;
      },
      blur() {
        seen.push("blur");
      },
    };
    const doc = {
      querySelector(selector: string) {
        return selector === "textarea.excalidraw-wysiwyg" ? editor : null;
      },
    };
    commitOpenExcalidrawTextEditor(doc as unknown as Document);
    expect(seen[0]).toBe("keydown");
    expect(seen).not.toContain("blur");
  });

  it("blurs an editor that is still connected after Escape", () => {
    const seen: string[] = [];
    const editor = {
      isConnected: true,
      dispatchEvent() {
        seen.push("keydown");
        return true;
      },
      blur() {
        seen.push("blur");
      },
    };
    commitOpenExcalidrawTextEditor({
      querySelector: () => editor,
    } as unknown as Document);
    expect(seen).toEqual(["keydown", "blur"]);
  });

  it("does nothing when no editor is open", () => {
    expect(() =>
      commitOpenExcalidrawTextEditor({ querySelector: () => null } as unknown as Document),
    ).not.toThrow();
  });
});
