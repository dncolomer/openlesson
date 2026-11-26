import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendSessionPowLog,
  formatSessionPowLogLine,
  isSessionDeveloperModeShortcut,
  SESSION_POW_LOG_LIMIT,
  sessionPowLogEntriesFromCanvas,
  type SessionPowLogEntry,
} from "@/lib/session-pow-log";

const ROOT = join(__dirname, "../..");

function entry(id: string, action: string): SessionPowLogEntry {
  return { id, at: 1, action };
}

describe("session PoW developer log", () => {
  it("maps classified canvas events and caps the live window", () => {
    const first = sessionPowLogEntriesFromCanvas(
      [
        { toolAction: "draw_freedraw", metadata: {} },
        { toolAction: "  ", metadata: {} },
        { toolAction: "simplify", metadata: { prompt: "Say it in fewer words." } },
      ],
      { at: 1_700_000_000_000, fromId: 3 },
    );
    expect(first.nextId).toBe(5);
    expect(first.entries).toEqual([
      { id: "4", at: 1_700_000_000_000, action: "draw_freedraw" },
      {
        id: "5",
        at: 1_700_000_000_000,
        action: "simplify",
        prompt: "Say it in fewer words.",
      },
    ]);
    expect(formatSessionPowLogLine(first.entries[0]!)).toBe("draw_freedraw");
    expect(formatSessionPowLogLine(first.entries[1]!)).toBe("simplify  Say it in fewer words.");
    expect(
      formatSessionPowLogLine({ action: "dictate", prompt: "a".repeat(90) }, 8),
    ).toBe("dictate  aaaaaaa…");

    const filled = Array.from({ length: SESSION_POW_LOG_LIMIT }, (_, index) =>
      entry(String(index + 1), "draw_text"),
    );
    const next = appendSessionPowLog(filled, first.entries);
    expect(next).toHaveLength(SESSION_POW_LOG_LIMIT);
    expect(next[0]?.action).toBe("draw_text");
    expect(next.at(-2)?.action).toBe("draw_freedraw");
    expect(next.at(-1)?.action).toBe("simplify");
    expect(appendSessionPowLog(filled, [])).toHaveLength(SESSION_POW_LOG_LIMIT);
  });

  it("toggles the PoW overlay with hidden ⌘D / Ctrl+D and keeps it off the Commands rail", () => {
    expect(isSessionDeveloperModeShortcut({ metaKey: true, code: "KeyD", key: "d" })).toBe(true);
    expect(isSessionDeveloperModeShortcut({ ctrlKey: true, code: "KeyD", key: "d" })).toBe(true);
    expect(isSessionDeveloperModeShortcut({ metaKey: true, code: "KeyD", key: "d", repeat: true })).toBe(
      false,
    );
    expect(isSessionDeveloperModeShortcut({ code: "KeyD", key: "d" })).toBe(false);
    expect(isSessionDeveloperModeShortcut({ altKey: true, code: "KeyD", key: "d" })).toBe(false);
    expect(isSessionDeveloperModeShortcut({ metaKey: true, shiftKey: true, code: "KeyD", key: "d" })).toBe(
      false,
    );
    expect(isSessionDeveloperModeShortcut({ metaKey: true, code: "KeyL", key: "l" })).toBe(false);

    const panel = readFileSync(join(ROOT, "components/session-view/session-guide-panel.tsx"), "utf8");
    expect(panel).toContain("<AutoLayoutToggle");
    expect(panel).not.toContain("DeveloperModeToggle");
    expect(panel).not.toContain("developer.enabled");
    expect(panel).not.toContain("useSessionDeveloperHud");

    const plates = readFileSync(join(ROOT, "components/excalidraw-canvas/command-plate.tsx"), "utf8");
    expect(plates).not.toContain("DeveloperModeToggle");
    expect(plates).not.toContain('data-session-command="developer-mode"');
    expect(plates).not.toContain("data-session-developer-mode-track");

    const overlay = readFileSync(
      join(ROOT, "components/session-view/session-pow-log-overlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("pointer-events-none");
    expect(overlay).toContain("absolute right-2 top-2");
    expect(overlay).toContain("data-session-pow-log");
    expect(overlay).toContain("formatSessionPowLogLine");
    expect(overlay).toContain("if (!hud.enabled) return null");

    const policy = readFileSync(
      join(ROOT, "components/session-view/session-policy-context.tsx"),
      "utf8",
    );
    expect(policy).toContain("sessionPowLogEntriesFromCanvas");
    expect(policy).toContain("appendSessionPowLog");
    expect(policy).toContain("isSessionDeveloperModeShortcut");
    expect(policy).toContain('window.addEventListener("keydown", onKeyDown, true)');
    expect(policy).toContain("DeveloperHudContext.Provider");

    const chrome = readFileSync(join(ROOT, "components/session-view/session-chrome.tsx"), "utf8");
    const host = readFileSync(join(ROOT, "components/session-view/session-work-surface.tsx"), "utf8");
    expect(chrome).toContain("<SessionPowLogOverlay");
    expect(host).toContain("<SessionPowLogOverlay");
    const chromeStage = chrome.indexOf('data-ile-canvas-stage className="relative z-0');
    expect(chromeStage).toBeGreaterThan(-1);
    expect(chrome.indexOf("<SessionPowLogOverlay", chromeStage)).toBeGreaterThan(chromeStage);
    const hostStage = host.indexOf("data-ile-canvas-stage");
    expect(host.indexOf("<SessionPowLogOverlay", hostStage)).toBeGreaterThan(hostStage);
  });
});
