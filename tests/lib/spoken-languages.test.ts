import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildConversationLanguageInstruction,
  coerceSpokenLocale,
  isSpokenLocale,
  spokenLanguageNames,
  spokenLocales,
  toSpeechBcp47,
  tutoringLocales,
  withConversationLanguageInstruction,
} from "@/lib/tutoring-languages";
import {
  setSpeechRecognitionConstructorForTests,
  startLiveSpeechRecognition,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";

const FULL_ALLOWLIST = ["en", "vi", "zh", "es", "de", "pl", "ca"] as const;

describe("spoken language allowlist", () => {
  it("keeps full tutoring/spoken allowlist (en/vi/zh/es/de/pl/ca) for TAP and ILE", () => {
    expect([...spokenLocales]).toEqual([...FULL_ALLOWLIST]);
    expect([...tutoringLocales]).toEqual([...FULL_ALLOWLIST]);
    for (const code of spokenLocales) {
      expect(spokenLanguageNames[code]).toBeTruthy();
    }
    expect(spokenLanguageNames.en).toBe("English");
    expect(spokenLanguageNames.de).toBe("Deutsch");
    expect(spokenLanguageNames.es).toBe("Español");
    expect(spokenLanguageNames.vi).toBe("Tiếng Việt");
    expect(spokenLanguageNames.zh).toBe("中文");
    expect(spokenLanguageNames.pl).toBe("Polski");
    expect(spokenLanguageNames.ca).toBe("Català");
  });

  it("isSpokenLocale / coerceSpokenLocale gate unknown UI locales", () => {
    expect(isSpokenLocale("de")).toBe(true);
    expect(isSpokenLocale("pl")).toBe(true);
    expect(isSpokenLocale("zh")).toBe(true);
    expect(isSpokenLocale("fr")).toBe(false);
    expect(coerceSpokenLocale("es")).toBe("es");
    expect(coerceSpokenLocale("zh")).toBe("zh");
    expect(coerceSpokenLocale("fr")).toBe("en");
    expect(coerceSpokenLocale(undefined)).toBe("en");
  });
});

describe("toSpeechBcp47", () => {
  it("maps full allowlist to Web Speech BCP-47 tags", () => {
    expect(toSpeechBcp47("en")).toBe("en-US");
    expect(toSpeechBcp47("de")).toBe("de-DE");
    expect(toSpeechBcp47("es")).toBe("es-ES");
    expect(toSpeechBcp47("vi")).toBe("vi-VN");
    expect(toSpeechBcp47("zh")).toBe("zh-CN");
    expect(toSpeechBcp47("pl")).toBe("pl-PL");
    expect(toSpeechBcp47("ca")).toBe("ca-ES");
  });

  it("defaults unknown or empty values to en-US", () => {
    expect(toSpeechBcp47(undefined)).toBe("en-US");
    expect(toSpeechBcp47(null)).toBe("en-US");
    expect(toSpeechBcp47("")).toBe("en-US");
    expect(toSpeechBcp47("fr")).toBe("en-US");
  });
});

describe("TAP speech language wiring", () => {
  it("starts live recognition with selected conversation language, not hardcoded en-US only", () => {
    const tapSrc = readFileSync(
      path.join(process.cwd(), "components/TapScoreClient.tsx"),
      "utf8",
    );
    expect(tapSrc).toContain("toSpeechBcp47");
    expect(tapSrc).toContain("conversationLanguage");
    // All startLiveSpeechRecognition calls must pass a resolved speech lang variable
    const startCalls = [
      ...tapSrc.matchAll(/startLiveSpeechRecognition\(\s*speechBindings\s*,\s*([^)]+)\)/g),
    ];
    expect(startCalls.length).toBeGreaterThanOrEqual(3);
    for (const match of startCalls) {
      const langArg = match[1].trim();
      expect(langArg).not.toBe('"en-US"');
      expect(langArg).not.toBe("'en-US'");
      // Must use the shared resolver or a derived speechLang variable
      expect(
        langArg === "speechLang" ||
          langArg.includes("toSpeechBcp47") ||
          langArg.includes("speechLang") ||
          langArg.includes("langRef"),
      ).toBe(true);
    }
    // Conversation language picker uses spoken allowlist (shared briefing config)
    const briefingSrc = readFileSync(
      path.join(process.cwd(), "components/TapBriefingConfig.tsx"),
      "utf8",
    );
    expect(briefingSrc).toContain("spokenLocales");
    expect(tapSrc).toContain("TapBriefingConfig");
  });

  it("resolves TAP conversation language codes to the correct BCP-47 tags", () => {
    expect(toSpeechBcp47("de")).toBe("de-DE");
    expect(toSpeechBcp47("es")).toBe("es-ES");
    expect(toSpeechBcp47("en")).toBe("en-US");
    expect(toSpeechBcp47("vi")).toBe("vi-VN");
  });

  it("startLiveSpeechRecognition receives BCP-47 from toSpeechBcp47 for all spoken locales", () => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start() {}
      stop() {}
      abort() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() {
        return false;
      }
    }

    setSpeechRecognitionConstructorForTests(
      FakeRecognition as unknown as new () => SpeechRecognitionLike,
    );

    try {
      for (const code of spokenLocales) {
        const expected = toSpeechBcp47(code);
        const recognitionRef = { current: null as SpeechRecognitionLike | null };
        const shouldListenRef = { current: false };
        const restartTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
        const langRef = { current: "en-US" };
        const bindings: LiveSpeechRecognitionBindings = {
          recognitionRef,
          shouldListenRef,
          restartTimerRef,
          langRef,
          onResult: () => {},
          onListeningChange: () => {},
          onError: () => {},
        };
        const recognition = startLiveSpeechRecognition(bindings, expected) as FakeRecognition;
        expect(recognition.lang).toBe(expected);
        expect(langRef.current).toBe(expected);
        expect(expected).toMatch(/^(en-US|de-DE|es-ES|vi-VN|zh-CN|pl-PL|ca-ES)$/);
      }
    } finally {
      setSpeechRecognitionConstructorForTests(undefined);
    }
  });
});

describe("ILE Spoken Language wiring", () => {
  it("selector options come from full spoken allowlist", () => {
    const viewSrc = readFileSync(
      path.join(process.cwd(), "components/SessionView.tsx"),
      "utf8",
    );
    expect(viewSrc).toContain("spokenLocales");
    expect(viewSrc).toContain("toSpeechBcp47");
    expect(viewSrc).toMatch(/session\.tutorLanguage|session\.spokenLanguage/);

    const enMessages = JSON.parse(
      readFileSync(path.join(process.cwd(), "messages/en.json"), "utf8"),
    ) as { session: Record<string, string> };
    // English copy must read Spoken Language (key may stay tutorLanguage or move)
    const spokenLabel =
      enMessages.session.spokenLanguage ?? enMessages.session.tutorLanguage;
    expect(spokenLabel).toBe("Spoken Language");
  });

  it("speech lang from Spoken Language de is de-DE via shared map", () => {
    expect(toSpeechBcp47("de")).toBe("de-DE");
    expect(toSpeechBcp47("es")).toBe("es-ES");
    expect(toSpeechBcp47("en")).toBe("en-US");
  });
});

describe("conversation language instruction for Explore/Drill model replies", () => {
  it("buildConversationLanguageInstruction requires Catalan for ca (not opaque code only)", () => {
    const ca = buildConversationLanguageInstruction("ca");
    expect(ca.length).toBeGreaterThan(20);
    expect(ca).toMatch(/Catalan/i);
    expect(ca).toMatch(/Respond fully|Respond in/i);
    expect(ca).toMatch(/Do not mix English/i);
    // Empty/unknown defaults: empty string for missing; coerce unknown → en instruction
    expect(buildConversationLanguageInstruction(null)).toBe("");
    expect(buildConversationLanguageInstruction(undefined)).toBe("");
    expect(buildConversationLanguageInstruction("")).toBe("");
    expect(buildConversationLanguageInstruction("en")).toMatch(/English/i);
  });

  it("withConversationLanguageInstruction prepends to system prompts", () => {
    const base = "You facilitate a knowledge-verification conversation.";
    const out = withConversationLanguageInstruction(base, "ca");
    expect(out.startsWith("IMPORTANT:")).toBe(true);
    expect(out).toContain(base);
    expect(out).toMatch(/Catalan/i);
    // Missing language leaves base unchanged
    expect(withConversationLanguageInstruction(base, null)).toBe(base);
    expect(withConversationLanguageInstruction(base, "")).toBe(base);
  });

  it("TAP chat path threads conversationLanguage into Helios system prompt", () => {
    const chat = readFileSync(
      path.join(process.cwd(), "app/api/workspace-tap-score/chat/route.ts"),
      "utf8",
    );
    expect(chat).toContain("withConversationLanguageInstruction");
    expect(chat).toContain("conversationLanguage");
    expect(chat).toContain("buildTapSelectiveThoughtSystemPrompt");
    // Must not call selective prompt without language wrap
    expect(chat).toMatch(
      /withConversationLanguageInstruction\(\s*buildTapSelectiveThoughtSystemPrompt/,
    );

    const tapClient = readFileSync(
      path.join(process.cwd(), "components/TapScoreClient.tsx"),
      "utf8",
    );
    expect(tapClient).toMatch(/conversationLanguage/);
    // chat + start + topics bodies include conversationLanguage
    expect(tapClient).toMatch(/workspace-tap-score\/chat[\s\S]*conversationLanguage/);
    expect(tapClient).toMatch(/workspace-tap-score\/start[\s\S]*conversationLanguage/);
    expect(tapClient).toMatch(/workspace-tap-score\/topics[\s\S]*conversationLanguage/);
  });

  it("TAP opening/topics generators accept conversationLanguage", () => {
    const tapScore = readFileSync(
      path.join(process.cwd(), "lib/tap-score.ts"),
      "utf8",
    );
    expect(tapScore).toContain("withConversationLanguageInstruction");
    expect(tapScore).toMatch(
      /generateTapOpeningQuestion[\s\S]*conversationLanguage/,
    );
    expect(tapScore).toMatch(
      /generateTapStartingTopics[\s\S]*conversationLanguage/,
    );

    const start = readFileSync(
      path.join(process.cwd(), "app/api/workspace-tap-score/start/route.ts"),
      "utf8",
    );
    expect(start).toContain("conversationLanguage");
    expect(start).toMatch(/generateTapOpeningQuestion\([\s\S]*conversationLanguage/);

    const topics = readFileSync(
      path.join(process.cwd(), "app/api/workspace-tap-score/topics/route.ts"),
      "utf8",
    );
    expect(topics).toContain("conversationLanguage");
    expect(topics).toMatch(/generateTapStartingTopics\([\s\S]*conversationLanguage/);

    // Drill exercise authoring also gets language
    const domain = readFileSync(
      path.join(process.cwd(), "lib/pow-api/tapbench-exercise-generate.ts"),
      "utf8",
    );
    expect(domain).toContain("withConversationLanguageInstruction");
    expect(domain).toContain("conversationLanguage");
  });

  it("session-chat (ILE Explore) uses the same language instruction helper", () => {
    const sessionChat = readFileSync(
      path.join(process.cwd(), "app/api/session-chat/route.ts"),
      "utf8",
    );
    expect(sessionChat).toContain("withConversationLanguageInstruction");
    expect(sessionChat).toContain("tutoringLanguage");

    const welcome = readFileSync(
      path.join(process.cwd(), "app/api/session-chat/welcome/route.ts"),
      "utf8",
    );
    expect(welcome).toContain("withConversationLanguageInstruction");
  });
});
