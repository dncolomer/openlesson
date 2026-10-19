"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Mic } from "lucide-react";
import { HeliosMarkdown } from "@/components/thought-ui/HeliosMarkdown";
import { HeliosProbeAvatar } from "@/components/thought-ui/ThoughtUi";
import { toSpeechBcp47 } from "@/lib/tutoring-languages";
import {
  applyAuthorUnsysHeliosTools,
  AUTHOR_UNSYS_HELIOS_EXAMPLES,
  AUTHOR_UNSYS_HELIOS_OPENING,
  AUTHOR_UNSYS_HELIOS_PLACEHOLDER,
  authorUnsysHeliosSelectionContext,
  isAuthorUnsysHeliosHostTool,
  parseAuthorUnsysHeliosChatTurn,
  resolveAuthorUnsysHeliosBranchId,
  type AuthorUnsysHeliosApplyState,
} from "@/lib/author-unsys-helios";
import {
  heliosSpeechFinalDelta,
  heliosSpeechUtteranceFromEvent,
} from "@/lib/workspace-helios-voice";
import {
  getSpeechRecognitionConstructor,
  startLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";
import type { SessionBranchModel } from "@/lib/session-branch-model";

type LiveActionKind = "user" | "reply" | "tool";

type LiveAction = {
  id: string;
  kind: LiveActionKind;
  text: string;
};

export function WorkspaceBlockUnsysHeliosChat({
  workspaceId,
  ayclToken,
  locale,
  blockId,
  blockTitle,
  model,
  focusId,
  disabled = false,
  onApplied,
  onGenerateGraph,
}: {
  workspaceId?: string | null;
  ayclToken?: string;
  locale?: string;
  blockId: string;
  blockTitle: string;
  model: SessionBranchModel | null;
  focusId: string;
  disabled?: boolean;
  onApplied: (next: AuthorUnsysHeliosApplyState) => void;
  onGenerateGraph?: (input: {
    parentId?: string;
    seedModel?: SessionBranchModel | null;
  }) => Promise<AuthorUnsysHeliosApplyState | null>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(AUTHOR_UNSYS_HELIOS_OPENING);
  const [actions, setActions] = useState<LiveAction[]>([]);
  const [showToolTrace, setShowToolTrace] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [interim, setInterim] = useState("");

  const modelRef = useRef(model);
  modelRef.current = model;
  const focusRef = useRef(focusId);
  focusRef.current = focusId;
  const appliedRef = useRef(onApplied);
  appliedRef.current = onApplied;
  const generateRef = useRef(onGenerateGraph);
  generateRef.current = onGenerateGraph;
  const selectionContext = authorUnsysHeliosSelectionContext(model, focusId);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const pendingRef = useRef<string[]>([]);
  const sentFinalsRef = useRef("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(toSpeechBcp47(locale));
  langRef.current = toSpeechBcp47(locale);

  const pushAction = useCallback((text: string, kind: LiveActionKind) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setActions((prev) => [
      ...prev.slice(-24),
      { id: `${Date.now()}-${prev.length}`, kind, text: trimmed },
    ]);
  }, []);

  const runPrompt = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || !workspaceId) return;
      setError("");
      setBusy(true);
      busyRef.current = true;
      setStatus("Helios is working on the seed…");
      pushAction(prompt, "user");
      try {
        const response = await fetch("/api/workspace/helios-unsys-seed-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            userPrompt: prompt,
            blockId,
            blockTitle,
            focusId: focusRef.current,
            seedModel: modelRef.current,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (!response.ok) {
          throw new Error(
            String(data.error || data.message || "Helios could not reply"),
          );
        }
        const parsed = parseAuthorUnsysHeliosChatTurn(data);
        let state: AuthorUnsysHeliosApplyState | null = modelRef.current
          ? {
              model: modelRef.current,
              focusId: focusRef.current,
            }
          : null;
        let mutated = false;
        for (const call of parsed.toolCalls) {
          if (isAuthorUnsysHeliosHostTool(call.name)) {
            const parentId =
              call.name === "generate_deeper"
                ? (state
                    ? resolveAuthorUnsysHeliosBranchId(
                        state.model,
                        call.args.parentId ??
                          call.args.branchId ??
                          call.args.parent ??
                          call.args.id,
                      ) || state.focusId
                    : String(call.args.parentId || call.args.branchId || "").trim())
                : undefined;
            const generated = await generateRef.current?.({
              parentId: parentId || undefined,
              seedModel: state?.model ?? modelRef.current,
            });
            if (generated) {
              state = generated;
              mutated = true;
              pushAction(`${call.name}: ${parentId || "first ring"}`, "tool");
            } else {
              pushAction(`${call.name}: could not generate`, "tool");
            }
            continue;
          }
          if (!state) {
            pushAction(`${call.name}: no graph yet`, "tool");
            continue;
          }
          const applied = applyAuthorUnsysHeliosTools({
            model: state.model,
            focusId: state.focusId,
            calls: [call],
          });
          for (const step of applied.steps) {
            pushAction(`${step.name}: ${step.message}`, "tool");
            if (step.ok) mutated = true;
          }
          state = {
            model: applied.model,
            focusId: applied.focusId,
          };
        }
        if (mutated && state) {
          appliedRef.current(state);
        }
        const reply = parsed.reply || "Ready.";
        setStatus(reply);
        if (parsed.reply) pushAction(parsed.reply, "reply");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Helios could not reply";
        setError(message);
        setStatus(message);
      } finally {
        setBusy(false);
        busyRef.current = false;
        const queued = pendingRef.current.shift();
        if (queued) void runPrompt(queued);
      }
    },
    [ayclToken, blockId, blockTitle, pushAction, workspaceId],
  );

  const enqueuePrompt = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt) return;
      if (busyRef.current) {
        pendingRef.current.push(prompt);
        setStatus("Queued for Helios…");
        return;
      }
      void runPrompt(prompt);
    },
    [runPrompt],
  );

  const speechBindings = useMemo<LiveSpeechRecognitionBindings>(
    () => ({
      recognitionRef,
      shouldListenRef,
      restartTimerRef,
      langRef,
      onResult: (event) => {
        const spoken = heliosSpeechUtteranceFromEvent(event);
        setInterim(spoken.interim);
        const delta = heliosSpeechFinalDelta(
          spoken.finals,
          sentFinalsRef.current,
        );
        if (spoken.finals) sentFinalsRef.current = spoken.finals;
        if (delta) enqueuePrompt(delta);
      },
      onListeningChange: setListening,
      onError: (speechError) => {
        if (speechError) setError(speechError);
      },
    }),
    [enqueuePrompt],
  );

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionConstructor());
    return () => {
      stopLiveSpeechRecognition(speechBindings);
    };
  }, [speechBindings]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    enqueuePrompt(text);
  }

  function toggleMic() {
    if (speechSupported === false) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    if (shouldListenRef.current) {
      stopLiveSpeechRecognition(speechBindings);
      setListening(false);
      setInterim("");
      return;
    }
    sentFinalsRef.current = "";
    setError("");
    startLiveSpeechRecognition(speechBindings, langRef.current);
  }

  if (!workspaceId) return null;

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-author-unsys-helios-chat=""
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
        <HeliosProbeAvatar isActiveTurn={busy || listening} size="ile" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-100">Helios</p>
          <p
            className="text-[10px] uppercase tracking-[0.14em] text-neutral-500"
            data-author-unsys-helios-status
          >
            {listening
              ? interim || "Listening…"
              : busy
                ? "Working on the seed"
                : "Seed helper"}
          </p>
        </div>
        {actions.some((action) => action.kind === "tool") ? (
          <button
            type="button"
            aria-pressed={showToolTrace}
            data-author-unsys-helios-tool-trace-toggle
            onClick={() => setShowToolTrace((open) => !open)}
            className={`shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
              showToolTrace
                ? "border-white/40 bg-white/10 text-neutral-100"
                : "border-white/15 text-neutral-400"
            }`}
          >
            {showToolTrace ? "Trace on" : "Trace"}
          </button>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {actions.length > 0 ? (
          <>
            <p className="text-[11px] leading-relaxed text-neutral-300">
              {status}
            </p>
            <ol className="mt-2 flex flex-col gap-1.5" data-author-unsys-helios-live-log>
              {(showToolTrace
                ? actions
                : actions.filter((action) => action.kind !== "tool")
              ).map((action) => (
                <li
                  key={action.id}
                  data-author-unsys-helios-step={action.kind}
                  className="text-[11px] leading-relaxed text-neutral-400"
                >
                  <HeliosMarkdown>{action.text}</HeliosMarkdown>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div data-author-unsys-helios-opening>
            <p className="text-[11px] leading-relaxed text-neutral-300">
              {AUTHOR_UNSYS_HELIOS_OPENING}
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {AUTHOR_UNSYS_HELIOS_EXAMPLES.map((example) => (
                <li key={example.id}>
                  <button
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => enqueuePrompt(example.prompt)}
                    data-author-unsys-helios-example={example.id}
                    className="w-full cursor-pointer px-0 py-1 text-left text-[11px] leading-snug text-neutral-100 underline decoration-white/35 underline-offset-4 hover:text-white hover:decoration-white disabled:cursor-default disabled:opacity-40"
                  >
                    {example.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error ? (
          <p className="mt-2 text-[11px] text-red-400" data-author-unsys-helios-error>
            {error}
          </p>
        ) : null}
      </div>
      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-white/10 p-2"
        data-author-unsys-helios-form
      >
        <div
          className={`mb-2 border px-2 py-1 ${
            selectionContext.active ? "border-white/25 bg-white/5" : "border-white/15"
          }`}
          data-author-unsys-helios-context=""
          data-author-unsys-helios-selection=""
          aria-live="polite"
        >
          <ul className="flex min-w-0 flex-wrap items-center gap-1">
            {selectionContext.chips.length > 0 ? (
              selectionContext.chips.map((chip) => (
                <li
                  key={chip.key}
                  data-author-unsys-helios-selection-chip={chip.key}
                  className="max-w-[12rem] truncate border border-white/15 px-1.5 py-0.5 text-[10px] leading-none text-neutral-100"
                  title={chip.hint ? `${chip.label} ${chip.hint}` : chip.label}
                >
                  {chip.label}
                  {chip.hint ? (
                    <span className="ml-1 text-neutral-500">{chip.hint}</span>
                  ) : null}
                </li>
              ))
            ) : (
              <li
                className="truncate text-[11px] text-neutral-500"
                data-author-unsys-helios-selection-empty
              >
                {selectionContext.summary}
              </li>
            )}
          </ul>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            listening ? interim || "Listening…" : AUTHOR_UNSYS_HELIOS_PLACEHOLDER
          }
          rows={2}
          disabled={busy || disabled}
          aria-label="Message Helios"
          className="min-h-[3.25rem] w-full resize-none rounded-none border border-white/30 bg-black/55 px-2 py-2 text-[12px] leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-400 focus:border-white/60 disabled:opacity-50"
          data-author-unsys-helios-chat-input
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? "Stop microphone" : "Start microphone"}
            title={listening ? "Stop microphone" : "Start microphone"}
            data-author-unsys-helios-chat-mic
            disabled={disabled}
            className={`flex shrink-0 items-center justify-center border p-2 ${
              listening
                ? "border-white/40 bg-white/10 text-neutral-100"
                : "border-white/15 text-neutral-300"
            }`}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="submit"
            disabled={busy || disabled || !draft.trim()}
            className="min-w-0 flex-1 border border-white/15 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-neutral-200 disabled:opacity-40"
            data-author-unsys-helios-chat-send
          >
            {busy ? "Helios is working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
