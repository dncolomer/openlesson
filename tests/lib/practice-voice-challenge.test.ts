/**
 * Speak-aloud gate: shipped decision logic plus the UI that calls it.
 * Does not open a live ILE or TAP session.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { IleInsightEmptySlots } from "@/components/session-view/ile-insight-trophies";
import {
  IleSessionImpurityScreen,
  IleSilenceRestScreen,
} from "@/components/session-view/ile-silence-lock-screen";
import {
  ILE_SESSION_IMPURITY_BODY,
  ILE_SESSION_IMPURITY_KICKER,
  ILE_SESSION_IMPURITY_LOG_OFF,
  ILE_SESSION_IMPURITY_SAVE,
  ILE_SESSION_IMPURITY_TITLE,
  ILE_SILENCE_LOCK_MINUTES_DESC,
  ILE_SILENCE_LOCK_MINUTES_MIN,
  ILE_SILENCE_REST_TITLE,
  PRACTICE_VOICE_CHALLENGE_SCRIPT,
  TAP_VOICE_CHALLENGE_SENTENCE_TWO,
  TAP_VOICE_CHALLENGE_SCRIPT,
  clampIleSilenceLockMinutes,
  ileImpurityExitPlan,
  ileMicCountsAsSilence,
  ileRestUnlock,
  ileSilenceLockOutcome,
  ileSilenceShouldLock,
  ILE_VOICE_CHALLENGE_SCRIPT,
  ILE_VOICE_CHALLENGE_SENTENCE_TWO,
  ileVoiceChallengeTranscriptPasses,
  ileWorkspaceStartAllowed,
  latchVoiceChallengePass,
  mergeVoiceChallengeHeard,
  voiceChallengeFillRatio,
  voiceChallengeReadMarks,
  nextIleSilenceLock,
  practiceVoiceChallengeTranscriptPasses,
  prepareBriefingStep,
  releaseVoiceChallengeStartLatch,
  retryVoiceChallenge,
  scoredTapBriefingStep,
  voiceChallengeStartSucceeded,
} from "@/lib/practice-voice-challenge";
import { applyIlePregameDifficultyPreset } from "@/lib/ile-pregame-settings";
import { scoutThinkAloudEnabled } from "@/lib/scout-session";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("practice voice challenge script and transcript", () => {
  it("script contains speaking thinking out loud the whole time plus raw thinking signal and baseline attention", () => {
    expect(PRACTICE_VOICE_CHALLENGE_SCRIPT).toMatch(/speak your thinking out loud the whole time/i);
    expect(PRACTICE_VOICE_CHALLENGE_SCRIPT).toMatch(/raw thinking signal/i);
    expect(PRACTICE_VOICE_CHALLENGE_SCRIPT).toMatch(/baseline attention/i);
    expect(practiceVoiceChallengeTranscriptPasses(PRACTICE_VOICE_CHALLENGE_SCRIPT)).toBe(true);
    expect(TAP_VOICE_CHALLENGE_SCRIPT).toContain("I'm done answering");
    expect(TAP_VOICE_CHALLENGE_SCRIPT).toContain("read each question out loud");
    expect(
      latchVoiceChallengePass({
        alreadyPassed: false,
        transcript: PRACTICE_VOICE_CHALLENGE_SCRIPT,
      }).shouldStart,
    ).toBe(false);
    expect(
      latchVoiceChallengePass({
        alreadyPassed: false,
        transcript: TAP_VOICE_CHALLENGE_SCRIPT,
      }).shouldStart,
    ).toBe(true);
    expect(ileVoiceChallengeTranscriptPasses(PRACTICE_VOICE_CHALLENGE_SCRIPT)).toBe(false);
    expect(ileVoiceChallengeTranscriptPasses(ILE_VOICE_CHALLENGE_SENTENCE_TWO)).toBe(false);
    expect(ileVoiceChallengeTranscriptPasses(ILE_VOICE_CHALLENGE_SCRIPT)).toBe(true);
    expect(
      latchVoiceChallengePass({
        alreadyPassed: false,
        transcript: ILE_VOICE_CHALLENGE_SCRIPT,
        ile: true,
      }).shouldStart,
    ).toBe(true);
  });

  it("empty and unrelated transcripts fail and a transcript covering both points passes", () => {
    expect(practiceVoiceChallengeTranscriptPasses("")).toBe(false);
    expect(practiceVoiceChallengeTranscriptPasses("   ")).toBe(false);
    expect(practiceVoiceChallengeTranscriptPasses("the weather is nice today")).toBe(false);
    expect(
      practiceVoiceChallengeTranscriptPasses("speak your thinking out loud the whole time"),
    ).toBe(false);
    expect(
      practiceVoiceChallengeTranscriptPasses("raw thinking signal and a baseline attention increase"),
    ).toBe(false);
    const keepMost = PRACTICE_VOICE_CHALLENGE_SCRIPT.split(/(?<=\.)\s+/)
      .map((sentence) => {
        const words = sentence.split(/\s+/);
        return words.slice(0, Math.ceil(words.length * 0.8)).join(" ");
      })
      .join(" ");
    const keepHalf = PRACTICE_VOICE_CHALLENGE_SCRIPT.split(/(?<=\.)\s+/)
      .map((sentence) => {
        const words = sentence.split(/\s+/);
        return words.slice(0, Math.floor(words.length * 0.5)).join(" ");
      })
      .join(" ");
    expect(practiceVoiceChallengeTranscriptPasses(keepMost)).toBe(true);
    expect(practiceVoiceChallengeTranscriptPasses(keepHalf)).toBe(false);
  });

  it("keeps both points when recognition restarts between sentences, and a second pass does not start again", () => {
    const [firstSentence, secondSentence] = PRACTICE_VOICE_CHALLENGE_SCRIPT.split(/(?<=\.)\s+/);
    const first = mergeVoiceChallengeHeard({
      committedText: "",
      sessionResults: [firstSentence ?? ""],
    });
    expect(practiceVoiceChallengeTranscriptPasses(first)).toBe(false);
    const combined = mergeVoiceChallengeHeard({
      committedText: first,
      sessionResults: [secondSentence ?? ""],
    });
    expect(practiceVoiceChallengeTranscriptPasses(combined)).toBe(true);
    const firstPass = latchVoiceChallengePass({
      alreadyPassed: false,
      transcript: `${combined} ${TAP_VOICE_CHALLENGE_SENTENCE_TWO}`,
    });
    expect(firstPass.shouldStart).toBe(true);
    expect(firstPass.passed).toBe(true);
    const secondPass = latchVoiceChallengePass({
      alreadyPassed: firstPass.passed,
      transcript: combined,
    });
    expect(secondPass.shouldStart).toBe(false);
    expect(secondPass.passed).toBe(true);
    const partial = voiceChallengeReadMarks({
      script: PRACTICE_VOICE_CHALLENGE_SCRIPT,
      transcript: "You will now speak your thinking out loud the whole time",
    });
    const partialWords = partial.filter((mark) => mark.kind === "word");
    expect(partialWords.find((mark) => mark.text === "speak")?.heard).toBe(true);
    expect(partialWords.find((mark) => mark.text === "raw")?.heard).toBe(false);
    expect(voiceChallengeFillRatio(partial)).toBeGreaterThan(0);
    expect(voiceChallengeFillRatio(partial)).toBeLessThan(1);
    const full = voiceChallengeReadMarks({
      script: PRACTICE_VOICE_CHALLENGE_SCRIPT,
      transcript: PRACTICE_VOICE_CHALLENGE_SCRIPT,
    });
    expect(voiceChallengeFillRatio(full)).toBe(1);
    expect(voiceChallengeFillRatio(voiceChallengeReadMarks({
      script: PRACTICE_VOICE_CHALLENGE_SCRIPT,
      transcript: "",
    }))).toBe(0);
    expect(releaseVoiceChallengeStartLatch({ startSucceeded: true }).release).toBe(false);
    expect(releaseVoiceChallengeStartLatch({ startSucceeded: false }).release).toBe(true);
    expect(voiceChallengeStartSucceeded({ ok: true })).toBe(true);
    expect(voiceChallengeStartSucceeded(undefined)).toBe(false);
    const retry = retryVoiceChallenge({ alreadyPassed: false });
    expect(retry.reset).toBe(true);
    expect(retry.shouldStart).toBe(false);
    expect(retryVoiceChallenge({ alreadyPassed: true })).toEqual({
      reset: false,
      shouldStart: false,
    });
    const challenge = read("components/PracticeVoiceChallenge.tsx");
    expect(challenge).toContain("data-practice-voice-retry");
    expect(challenge).toContain("retryVoiceChallenge");
    const retryAt = challenge.indexOf("function retry");
    const retryBody = challenge.slice(retryAt, retryAt + 400);
    expect(retryBody).not.toContain("onPassRef");
    expect(challenge).toContain("mergeVoiceChallengeHeard");
    expect(challenge).toContain("latchVoiceChallengePass");
    const stopAt = challenge.indexOf("recognition.stop()");
    const passAt = challenge.indexOf("onPassRef.current()");
    expect(stopAt).toBeGreaterThan(-1);
    expect(passAt).toBeGreaterThan(stopAt);
    const tap = read("components/tap-score/tap-score-phases.tsx");
    const prepare = read("components/scout-tap/scout-tap-phases.tsx");
    expect(tap).toContain("releaseVoiceChallengeStartLatch");
    expect(prepare).toContain("releaseVoiceChallengeStartLatch");
    expect(tap).not.toContain("passGuard.current = false;\n    });");
    expect(prepare).not.toContain("finally(() => {\n      passGuard.current = false;");
  });
});

describe("a pass is required before ILE, TAP, Prepare, and rest unlock", () => {
  it("ILE workspace start, TAP topic and practice, Prepare live, and ILE rest unlock require a pass", () => {
    expect(ileWorkspaceStartAllowed(false)).toBe(false);
    expect(ileWorkspaceStartAllowed(true)).toBe(true);

    expect(scoredTapBriefingStep({ choice: null, challengePassed: false })).toBe("pick");
    expect(scoredTapBriefingStep({ choice: "topic", challengePassed: false })).toBe("challenge");
    expect(scoredTapBriefingStep({ choice: "practice", challengePassed: false })).toBe("challenge");
    expect(scoredTapBriefingStep({ choice: "topic", challengePassed: true })).toBe("live");
    expect(scoredTapBriefingStep({ choice: "practice", challengePassed: true })).toBe("live");

    expect(prepareBriefingStep({ startConfirmed: false, challengePassed: false })).toBe("confirm");
    expect(prepareBriefingStep({ startConfirmed: true, challengePassed: false })).toBe("challenge");
    expect(prepareBriefingStep({ startConfirmed: true, challengePassed: true })).toBe("live");
    expect(prepareBriefingStep({ startConfirmed: false, challengePassed: true })).toBe("confirm");

    expect(ileRestUnlock({ challengePassed: false, lockCount: 1 }).locked).toBe(true);
    expect(ileRestUnlock({ challengePassed: true, lockCount: 1 }).locked).toBe(false);
    expect(ileRestUnlock({ challengePassed: true, lockCount: 2 }).locked).toBe(false);
    expect(ileRestUnlock({ challengePassed: true, lockCount: 3 }).locked).toBe(true);
  });

  it("TAP order is topic-or-practice choice then challenge", () => {
    expect(scoredTapBriefingStep({ choice: null, challengePassed: true })).toBe("pick");
    expect(scoredTapBriefingStep({ choice: "practice", challengePassed: false })).toBe("challenge");
    expect(scoredTapBriefingStep({ choice: "topic", challengePassed: false })).toBe("challenge");
  });
});

describe("ILE silence lock", () => {
  it("silence at the configured positive minutes locks and a shorter span does not", () => {
    expect(ileSilenceShouldLock({ silenceMs: 5 * 60_000 - 1, minutes: 5 })).toBe(false);
    expect(ileSilenceShouldLock({ silenceMs: 5 * 60_000, minutes: 5 })).toBe(true);
    const short = nextIleSilenceLock({
      lockCount: 0,
      silenceMs: 2 * 60_000,
      minutes: 5,
      alreadyLatched: false,
    });
    expect(short.outcome).toBe("continue");
    expect(short.lockCount).toBe(0);
    const hit = nextIleSilenceLock({
      lockCount: 0,
      silenceMs: 5 * 60_000,
      minutes: 5,
      alreadyLatched: false,
    });
    expect(hit.latched).toBe(true);
    expect(hit.outcome).toBe("rest");
  });

  it("a zero or off setting is clamped back to a positive duration", () => {
    expect(clampIleSilenceLockMinutes(0)).toBe(ILE_SILENCE_LOCK_MINUTES_MIN);
    expect(clampIleSilenceLockMinutes("0")).toBe(ILE_SILENCE_LOCK_MINUTES_MIN);
    expect(clampIleSilenceLockMinutes("off")).toBe(ILE_SILENCE_LOCK_MINUTES_MIN);
    expect(clampIleSilenceLockMinutes(false)).toBe(ILE_SILENCE_LOCK_MINUTES_MIN);
    expect(clampIleSilenceLockMinutes(0)).toBeGreaterThan(0);
    expect(ileSilenceShouldLock({ silenceMs: 60_000, minutes: 0 })).toBe(true);
    expect(ileSilenceShouldLock({ silenceMs: 59_000, minutes: "off" })).toBe(false);
    expect(
      ileMicCountsAsSilence({
        muted: true,
        hasStream: true,
        audioTracks: [{ muted: false, enabled: true, readyState: "live" }],
      }),
    ).toBe(true);
    expect(
      ileMicCountsAsSilence({
        muted: false,
        hasStream: true,
        audioTracks: [{ muted: true, enabled: true, readyState: "live" }],
      }),
    ).toBe(true);
    expect(
      ileMicCountsAsSilence({
        muted: false,
        hasStream: false,
        audioTracks: [],
      }),
    ).toBe(true);
    expect(
      ileMicCountsAsSilence({
        muted: false,
        hasStream: true,
        audioTracks: [{ muted: false, enabled: true, readyState: "live" }],
      }),
    ).toBe(false);
    const casual = applyIlePregameDifficultyPreset("casual");
    expect(casual.silenceLockMinutes).toBeGreaterThan(0);
    expect(applyIlePregameDifficultyPreset("ironman").silenceLockMinutes).toBe(3);
  });

  it("lock 1 and 2 are rest-and-unlock and lock 3 is impurity without another return to work", () => {
    expect(ileSilenceLockOutcome(1)).toBe("rest");
    expect(ileSilenceLockOutcome(2)).toBe("rest");
    expect(ileSilenceLockOutcome(3)).toBe("impurity");
    const third = nextIleSilenceLock({
      lockCount: 2,
      silenceMs: 60_000,
      minutes: 1,
      alreadyLatched: false,
    });
    expect(third.lockCount).toBe(3);
    expect(third.outcome).toBe("impurity");
    expect(ileRestUnlock({ challengePassed: true, lockCount: third.lockCount }).locked).toBe(true);
  });

  it("impurity save persists and log off leaves", () => {
    expect(ileImpurityExitPlan("save").persistSession).toBe(true);
    expect(ileImpurityExitPlan("logoff").leave).toBe(true);
    expect(ileImpurityExitPlan("save").leave).toBe(true);
    expect(ileImpurityExitPlan("logoff").persistSession).toBe(true);
  });
});

describe("shipped voice-challenge UI wiring", () => {
  it("ILE start/help is a full-viewport surface with multi-sentence placeholders and the voice challenge wired to workspace start", () => {
    const chrome = read("components/session-view/session-chrome.tsx");
    const guide = read("components/SessionOnboardingGuide.tsx");
    const view = read("components/SessionView.tsx");
    const helpAt = chrome.indexOf('data-ile-help-fullscreen=""');
    expect(helpAt).toBeGreaterThan(-1);
    expect(chrome.slice(helpAt, helpAt + 400)).toContain("h-full w-full");
    expect(chrome.slice(helpAt, helpAt + 400)).not.toContain("max-h-[min(88vh,44rem)]");
    expect(guide).toContain("PracticeVoiceChallenge");
    expect(guide).toContain("ileWorkspaceStartAllowed");
    expect(guide).toContain("onStart?.()");
    expect(view).toContain("onStart={() => { void handleWelcomePlay(); }}");
    const html = renderToStaticMarkup(
      createElement(IleInsightEmptySlots, { count: 3, label: "slots" }),
    );
    expect(html).toContain("data-ile-welcome-insight-skeleton");
    expect(html).toContain("data-ile-welcome-insight-skeleton-mark");
    expect(html).toContain("data-ile-welcome-insight-skeleton-bar");
    expect(html).not.toContain("data-ile-welcome-insight-placeholder-text");
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/After you work a chapter/);
    expect(html).not.toMatch(/>Empty</);
    const spoken = renderToStaticMarkup(createElement(PracticeVoiceChallenge, { onPass: () => {} }));
    const ileSpoken = renderToStaticMarkup(
      createElement(PracticeVoiceChallenge, { onPass: () => {}, variant: "ile" }),
    );
    expect(spoken).toContain("data-practice-voice-challenge");
    expect(spoken).toContain('data-practice-voice-variant="tap"');
    expect(spoken).toContain("Read this aloud to start");
    expect(spoken).toContain("data-practice-voice-word");
    expect(spoken).toContain('data-heard="false"');
    expect(spoken).toContain("data-practice-voice-fill");
    expect(spoken).not.toContain("data-ile-sample-insight-card");
    expect(spoken).toContain("data-practice-voice-retry");
    expect(spoken).toContain("Try again");
    expect(ileSpoken).toContain('data-practice-voice-variant="ile"');
    expect(ileSpoken.replace(/<[^>]+>/g, "")).toContain("In this session I will work to craft insights");
    expect(ileSpoken).toContain('data-practice-voice-sentence="2"');
    expect(ileSpoken).toContain("data-ile-sample-insight-card");
    expect(ileSpoken).toContain("data-ile-sample-insight-bar");
    expect(ileSpoken).toContain("Sample insight");
    expect(ileSpoken).not.toContain("A finished idea from one area of the map.");
    expect(read("components/PracticeVoiceChallenge.tsx")).toContain("data-practice-voice-loading");
    expect(read("components/PracticeVoiceChallenge.tsx")).not.toContain("speechSynthesis");
    expect(read("components/SessionOnboardingGuide.tsx")).toContain("data-ile-voice-challenge");
    expect(read("components/SessionOnboardingGuide.tsx")).toContain("max-w-xl");
  });

  it("TAP briefing renders topic or practice pick before the challenge and does not start from the pick", () => {
    const phases = read("components/tap-score/tap-score-phases.tsx");
    const pickAt = phases.indexOf('data-tap-briefing-step="pick"');
    const challengeAt = phases.indexOf('data-tap-briefing-step="challenge"');
    expect(pickAt).toBeGreaterThan(-1);
    expect(challengeAt).toBeGreaterThan(-1);
    expect(phases).toContain("omitIntroSlide");
    expect(phases).toContain("onStartTopic={chooseTopic}");
    expect(phases).toContain("onPracticeFirst={choosePractice}");
    expect(phases).not.toMatch(/onPracticeFirst=\{\(\) => void startSession/);
    expect(phases).not.toMatch(/onStartTopic=\{\(selectedTopic\) => void startSession/);
    const choose = phases.slice(phases.indexOf("function choosePractice"), phases.indexOf("function passTapChallenge"));
    expect(choose).not.toContain("startSession");
    const pass = phases.slice(phases.indexOf("function passTapChallenge"), phases.indexOf("const briefingStep"));
    expect(pass).toContain('startSession({ practice: true })');
    expect(pass).toContain("scoredTapBriefingStep");
    expect(pass).toContain('step !== "live"');
  });

  it("Prepare renders the challenge after start confirmation and does not enter live before a pass", () => {
    const phases = read("components/scout-tap/scout-tap-phases.tsx");
    expect(phases).toContain("confirmPrepareStart");
    expect(phases).toContain("passPrepareChallenge");
    expect(phases).toContain('data-prepare-briefing-step="confirm"');
    expect(phases).toContain('data-prepare-briefing-step="challenge"');
    expect(phases).toContain("onStart={confirmPrepareStart}");
    expect(phases).not.toContain("onStart={() => void startSession()}");
    const confirm = phases.slice(
      phases.indexOf("function confirmPrepareStart"),
      phases.indexOf("function passPrepareChallenge"),
    );
    expect(confirm).not.toContain("startSession");
    expect(confirm).toContain("prepareBriefingStep");
    const pass = phases.slice(
      phases.indexOf("function passPrepareChallenge"),
      phases.indexOf("const prepareStep"),
    );
    expect(pass).toContain('step !== "live"');
    expect(pass).toContain("startSession()");
    expect(scoutThinkAloudEnabled()).toBe(false);
    expect(phases).toContain("scoutThinkAloudEnabled()");
    const drill = read("components/exercise-tap/exercise-tap-phases.tsx");
    expect(drill).toContain('variant="drill"');
    expect(drill).toContain("omitIntroSlide");
    expect(drill).not.toMatch(/onPracticeFirst=\{\(\) => void startSession/);
    expect(read("components/scout-tap/scout-tap-phases.tsx")).toContain('variant="prepare"');
  });

  it("difficulty settings expose the silence-minutes control with no off switch", () => {
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    const at = welcome.indexOf("data-ile-silence-lock-minutes");
    expect(at).toBeGreaterThan(-1);
    const block = welcome.slice(at, at + 1400);
    expect(block).toContain('type="range"');
    expect(block).toContain("ILE_SILENCE_LOCK_MINUTES_MIN");
    expect(block).toContain("clampIleSilenceLockMinutes");
    expect(block).not.toContain('type="checkbox"');
    expect(block.toLowerCase()).not.toContain("turn off");
    expect(welcome).toContain("ILE_SILENCE_LOCK_MINUTES_DESC");
    expect(ILE_SILENCE_LOCK_MINUTES_DESC).toMatch(/cannot be turned off/i);
    expect(read("components/SessionView.tsx")).toContain("silenceLockMinutes={silenceLockMinutes}");
    expect(read("components/SessionView.tsx")).toContain("useIleSilenceLock");
  });

  it("the impurity screen shows lost-progress session-impurity framing plus save and log off and break-ok copy", () => {
    const screen = read("components/session-view/ile-silence-lock-screen.tsx");
    const view = read("components/SessionView.tsx");
    expect(ILE_SESSION_IMPURITY_KICKER).toMatch(/session impurity/i);
    expect(ILE_SESSION_IMPURITY_TITLE).toMatch(/lost progress/i);
    expect(ILE_SESSION_IMPURITY_BODY).toMatch(/ok to take a break/i);
    expect(ILE_SESSION_IMPURITY_SAVE).toBe("Save");
    expect(ILE_SESSION_IMPURITY_LOG_OFF).toBe("Log off");
    expect(screen).toContain("data-ile-session-impurity");
    expect(screen).toContain("data-ile-silence-rest");
    expect(screen).toContain("data-ile-impurity-save");
    expect(screen).toContain("data-ile-impurity-logoff");
    expect(screen).toContain("ILE_SESSION_IMPURITY_BODY");
    expect(ILE_SILENCE_REST_TITLE).toBe("Taking a rest");
    const impurity = renderToStaticMarkup(
      createElement(IleSessionImpurityScreen, {
        lockCount: 3,
        onSave: () => {},
        onLogOff: () => {},
      }),
    );
    expect(impurity).toContain(ILE_SESSION_IMPURITY_KICKER);
    expect(impurity).toContain(ILE_SESSION_IMPURITY_TITLE);
    expect(impurity).toContain(ILE_SESSION_IMPURITY_BODY);
    expect(impurity).toContain(ILE_SESSION_IMPURITY_SAVE);
    expect(impurity).toContain(ILE_SESSION_IMPURITY_LOG_OFF);
    expect(impurity).not.toContain("data-practice-voice-challenge");
    const rest = renderToStaticMarkup(
      createElement(IleSilenceRestScreen, {
        lockCount: 1,
        onUnlock: () => {},
        onSaveAndLeave: () => {},
      }),
    );
    expect(rest).toContain(ILE_SILENCE_REST_TITLE);
    expect(rest).toContain("data-practice-voice-challenge");
    expect(rest).toContain("data-ile-silence-save-and-leave");
    expect(rest).toContain("Save and leave");
    expect(read("components/SessionView.tsx")).toContain("ileMicCountsAsSilence");
    expect(read("components/SessionView.tsx")).toContain("slotCount={minInsightsPerChapter}");
    expect(view).toContain("IleSessionImpurityScreen");
    expect(view).toContain("IleSilenceRestScreen");
    expect(view).toContain('ileImpurityExitPlan("save")');
    expect(view).toContain("setShowSaveExitNameDialog(true)");
    expect(read("components/session-view/session-chrome.tsx")).toContain(
      'testId="ile-save-exit-name"',
    );
    expect(read("components/session-view/session-chrome.tsx")).toContain("data-ile-session-name");
    expect(view).toContain('ileImpurityExitPlan("logoff")');
    expect(view).toContain("pauseAndGoToDashboard");
    expect(view).toContain("persistSession: plan.persistSession");
  });
});
