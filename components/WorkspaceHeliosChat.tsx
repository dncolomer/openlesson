"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HeliosMarkdown } from "@/components/thought-ui/HeliosMarkdown";
import { HeliosProbeAvatar } from "@/components/thought-ui/ThoughtUi";
import { toSpeechBcp47 } from "@/lib/tutoring-languages";
import {
  getSpeechRecognitionConstructor,
  startLiveSpeechRecognition,
  stopLiveSpeechRecognition,
  type LiveSpeechRecognitionBindings,
  type SpeechRecognitionLike,
} from "@/lib/useSessionThoughtInterface";
import {
  applyHeliosMapToolsAtomically,
  parseHeliosMapChatModelTurn,
  type HeliosMapAtomicStep,
  type HeliosMapSnapshot,
  type HeliosMapToolHost,
} from "@/lib/workspace-helios-tools";
import {
  HELIOS_MAP_OPENING_EXAMPLES,
  HELIOS_MAP_OPENING_PLACEHOLDER,
  HELIOS_MAP_OPENING_QUESTION,
  heliosMapOpeningMarkdown,
} from "@/lib/workspace-helios-opening";
import {
  heliosSpeechFinalDelta,
  heliosSpeechUtteranceFromEvent,
} from "@/lib/workspace-helios-voice";
import {
  heliosSelectionContext,
  serializeHeliosMapSelection,
} from "@/lib/workspace-helios-selection";
import {
  emptyWorkspaceMapSelection,
  type WorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import {
  capHeliosAttachedFiles,
  HELIOS_MAP_FILE_ACCEPT,
  HELIOS_MAP_FILES_FALLBACK_PROMPT,
  HELIOS_MAP_MAX_ATTACHED_FILES,
  HELIOS_MAP_MAX_FILE_BYTES,
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
  type HeliosAttachedFile,
} from "@/lib/workspace-helios-files";
import type { WorkspaceFileContextItem } from "@/lib/prompt-workspace-context";
import { serializeHeliosWorkspaceMapTypes } from "@/lib/workspace-helios-expertise";
import type { WorkspaceMapTypesState } from "@/lib/workspace-map-types";

type LiveActionKind = "user" | "reply" | "tool";

type LiveAction = {
  id: string;
  kind: LiveActionKind;
  text: string;
};

export function WorkspaceHeliosChat({
  workspaceId,
  ayclToken,
  locale,
  snapshot,
  host,
  mapSelection,
  workspaceFileItems,
  workspaceMapTypes,
}: {
  workspaceId: string;
  ayclToken?: string;
  locale?: string;
  snapshot: HeliosMapSnapshot;
  host?: HeliosMapToolHost | null;
  mapSelection?: WorkspaceMapSelection | null;
  workspaceFileItems?: WorkspaceFileContextItem[] | null;
  workspaceMapTypes?: WorkspaceMapTypesState | null;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(HELIOS_MAP_OPENING_QUESTION);
  const [actions, setActions] = useState<LiveAction[]>([]);
  const [showToolTrace, setShowToolTrace] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [interim, setInterim] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<HeliosAttachedFile[]>([]);
  const [workspaceFileNames, setWorkspaceFileNames] = useState<string[]>([]);
  const [showWorkspaceFiles, setShowWorkspaceFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const selectionRef = useRef(mapSelection || emptyWorkspaceMapSelection());
  selectionRef.current = mapSelection || emptyWorkspaceMapSelection();
  const hostRef = useRef(host);
  hostRef.current = host;
  const selectionContext = useMemo(
    () => heliosSelectionContext(mapSelection, snapshot),
    [mapSelection, snapshot],
  );
  const attachedRef = useRef(attachedFiles);
  attachedRef.current = attachedFiles;
  const mapTypesRef = useRef(workspaceMapTypes);
  mapTypesRef.current = workspaceMapTypes;
  const workspaceFileNamesRef = useRef(workspaceFileNames);
  workspaceFileNamesRef.current = workspaceFileNames;
  const workspaceFiles = useMemo(
    () =>
      (workspaceFileItems || [])
        .map((item) => String(item.name || "").trim())
        .filter(Boolean),
    [workspaceFileItems],
  );
  const filesActive = attachedFiles.length > 0 || workspaceFileNames.length > 0;
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
      if (!prompt) return;
      setError("");
      setBusy(true);
      busyRef.current = true;
      setStatus("Helios is working on the map…");
      pushAction(prompt, "user");
      try {
        const response = await fetch("/api/workspace/helios-map-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            userPrompt: prompt,
            snapshot: snapshotRef.current,
            selection: serializeHeliosMapSelection(selectionRef.current),
            files: attachedRef.current,
            workspaceFileNames: workspaceFileNamesRef.current,
            mapTypes: serializeHeliosWorkspaceMapTypes(mapTypesRef.current),
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
        const parsed = parseHeliosMapChatModelTurn(data);
        const applied = await applyHeliosMapToolsAtomically({
          snapshot: snapshotRef.current,
          calls: parsed.toolCalls,
          host: hostRef.current,
          onStep: async (step: HeliosMapAtomicStep) => {
            const label = step.result.ok
              ? `${step.call.name}: ${step.result.message}`
              : `${step.call.name}: ${step.result.error}`;
            pushAction(label, "tool");
          },
        });
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
    [ayclToken, pushAction, workspaceId],
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
    const hasFiles =
      attachedRef.current.length > 0 || workspaceFileNamesRef.current.length > 0;
    if (!text && !hasFiles) return;
    setDraft("");
    enqueuePrompt(text || HELIOS_MAP_FILES_FALLBACK_PROMPT);
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

  function remainingFileSlots() {
    return Math.max(
      0,
      HELIOS_MAP_MAX_ATTACHED_FILES -
        attachedFiles.length -
        workspaceFileNames.length,
    );
  }

  async function addLocalFiles(incoming: FileList | File[]) {
    const slots = remainingFileSlots();
    if (slots <= 0) {
      setError(`You can attach up to ${HELIOS_MAP_MAX_ATTACHED_FILES} files.`);
      return;
    }
    const toRead = Array.from(incoming).slice(0, slots);
    const next: HeliosAttachedFile[] = [];
    for (const file of toRead) {
      const mimeType = normalizeHeliosFileMime(file.name, file.type);
      if (!isHeliosAllowedMimeType(mimeType)) {
        setError("That file type is not supported.");
        continue;
      }
      if (file.size > HELIOS_MAP_MAX_FILE_BYTES) {
        setError("File is too large (10 MB).");
        continue;
      }
      const read = await new Promise<HeliosAttachedFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          const data = dataUrl.split(",")[1] || "";
          if (!data) {
            resolve(null);
            return;
          }
          resolve({
            name: file.name,
            mimeType,
            data,
            size: file.size,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (read) next.push(read);
    }
    if (next.length === 0) return;
    setError("");
    setAttachedFiles((prev) =>
      capHeliosAttachedFiles([...prev, ...next], workspaceFileNames).local,
    );
  }

  function removeLocalFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleWorkspaceFile(name: string) {
    setWorkspaceFileNames((prev) => {
      if (prev.includes(name)) return prev.filter((item) => item !== name);
      if (prev.length + attachedFiles.length >= HELIOS_MAP_MAX_ATTACHED_FILES) {
        setError(`You can attach up to ${HELIOS_MAP_MAX_ATTACHED_FILES} files.`);
        return prev;
      }
      setError("");
      return [...prev, name];
    });
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-workspace-helios-chat=""
      data-workspace-helios-live=""
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-3">
        <HeliosProbeAvatar isActiveTurn={busy || listening} size="ile" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-none text-neutral-100">Helios</p>
          <p
            className="mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-500"
            data-workspace-helios-live-status
          >
            {listening
              ? interim || "Listening…"
              : busy
                ? "Working on the map"
                : "Learning Map builder"}
          </p>
        </div>
        {actions.some((action) => action.kind === "tool") ? (
          <button
            type="button"
            aria-pressed={showToolTrace}
            data-workspace-helios-tool-trace-toggle
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {actions.length > 0 ? (
          <>
            <p
              className="text-sm leading-relaxed text-neutral-300"
              data-workspace-helios-status
            >
              {status}
            </p>
            <ol className="mt-3 flex flex-col gap-2" data-workspace-helios-live-log>
              {(showToolTrace
                ? actions
                : actions.filter((action) => action.kind !== "tool")
              ).map((action) => (
                <li
                  key={action.id}
                  data-helios-map-step=""
                  data-helios-map-step-kind={action.kind}
                  className="text-sm leading-relaxed text-neutral-400"
                >
                  <HeliosMarkdown>{action.text}</HeliosMarkdown>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="mt-3" data-workspace-helios-opening>
            <div
              className="text-sm leading-relaxed text-neutral-300"
              data-workspace-helios-opening-question
            >
              <HeliosMarkdown>{heliosMapOpeningMarkdown()}</HeliosMarkdown>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
              Examples
            </p>
            <ul className="mt-2 flex flex-col gap-1" data-workspace-helios-opening-examples>
              {HELIOS_MAP_OPENING_EXAMPLES.map((example) => (
                <li key={example.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => enqueuePrompt(example.prompt)}
                    data-workspace-helios-opening-example={example.id}
                    className="w-full cursor-pointer px-0 py-1.5 text-left text-sm leading-snug text-neutral-100 underline decoration-white/35 underline-offset-4 hover:text-white hover:decoration-white disabled:cursor-default disabled:opacity-40"
                  >
                    {example.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error ? (
          <p className="mt-2 text-xs text-red-400" data-helios-map-chat-error>
            {error}
          </p>
        ) : null}
      </div>
      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-white/10 p-3"
        data-workspace-helios-chat-form
      >
        <div
          className={`mb-2 border px-2 py-1 ${
            selectionContext.active || filesActive
              ? "border-white/25 bg-white/5"
              : "border-white/15"
          }`}
          data-workspace-helios-context=""
          data-workspace-helios-selection=""
          data-workspace-helios-selection-kind={selectionContext.kind}
          data-workspace-helios-files=""
          aria-live="polite"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files?.length) {
              void addLocalFiles(event.dataTransfer.files);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {selectionContext.chips.length > 0 ? (
                selectionContext.chips.map((chip) => (
                  <li
                    key={chip.key}
                    data-workspace-helios-selection-chip={chip.key}
                    className="max-w-[10rem] truncate border border-white/15 px-1.5 py-0.5 text-[10px] leading-none text-neutral-100"
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
                  data-workspace-helios-selection-empty
                >
                  {selectionContext.summary}
                </li>
              )}
              {attachedFiles.map((file, index) => (
                <li
                  key={`local-${file.name}-${index}`}
                  data-workspace-helios-files-chip={file.name}
                  className="flex max-w-[10rem] items-center gap-1 border border-white/15 px-1.5 py-0.5 text-[10px] leading-none text-neutral-100"
                  title={file.name}
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeLocalFile(index)}
                    className="shrink-0 text-neutral-500 hover:text-neutral-100"
                  >
                    ×
                  </button>
                </li>
              ))}
              {workspaceFileNames.map((name) => (
                <li
                  key={`workspace-${name}`}
                  data-workspace-helios-files-chip={name}
                  className="flex max-w-[10rem] items-center gap-1 border border-white/15 px-1.5 py-0.5 text-[10px] leading-none text-neutral-100"
                  title={name}
                >
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => toggleWorkspaceFile(name)}
                    className="shrink-0 text-neutral-500 hover:text-neutral-100"
                  >
                    ×
                  </button>
                </li>
              ))}
              {!filesActive ? (
                <li className="sr-only" data-workspace-helios-files-empty>
                  No files attached
                </li>
              ) : null}
            </ul>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                data-workspace-helios-files-attach
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || remainingFileSlots() <= 0}
                className="border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-neutral-300 disabled:opacity-40"
              >
                Attach
              </button>
              {workspaceFiles.length > 0 ? (
                <button
                  type="button"
                  data-workspace-helios-files-workspace-toggle
                  aria-pressed={showWorkspaceFiles}
                  onClick={() => setShowWorkspaceFiles((open) => !open)}
                  className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                    showWorkspaceFiles
                      ? "border-white/40 bg-white/10 text-neutral-100"
                      : "border-white/15 text-neutral-400"
                  }`}
                >
                  Workspace
                </button>
              ) : null}
            </div>
          </div>
          {showWorkspaceFiles && workspaceFiles.length > 0 ? (
            <ul
              className="mt-1 max-h-24 overflow-y-auto"
              data-workspace-helios-files-workspace-list
            >
              {workspaceFiles.map((name) => {
                const checked = workspaceFileNames.includes(name);
                return (
                  <li key={name}>
                    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-neutral-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorkspaceFile(name)}
                        data-workspace-helios-files-workspace-option={name}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept={HELIOS_MAP_FILE_ACCEPT}
            multiple
            className="hidden"
            data-workspace-helios-files-input
            onChange={(event) => {
              if (event.target.files?.length) {
                void addLocalFiles(event.target.files);
              }
              event.target.value = "";
            }}
          />
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            listening
              ? interim || "Listening…"
              : HELIOS_MAP_OPENING_PLACEHOLDER
          }
          rows={3}
          disabled={busy}
          aria-label="Message Helios"
          className="min-h-[4.5rem] w-full resize-none rounded-none border border-white/30 bg-black/55 px-3 py-2.5 text-sm leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-400 focus:border-white/60 focus:bg-black/70 disabled:opacity-50"
          data-workspace-helios-chat-input
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            data-workspace-helios-chat-mic
            className={`shrink-0 border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
              listening
                ? "border-white/40 bg-white/10 text-neutral-100"
                : "border-white/15 text-neutral-300"
            }`}
          >
            {listening ? "Mic on" : "Mic"}
          </button>
          <button
            type="submit"
            disabled={
              busy ||
              (!draft.trim() &&
                attachedFiles.length === 0 &&
                workspaceFileNames.length === 0)
            }
            className="min-w-0 flex-1 border border-white/15 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-neutral-200 disabled:opacity-40"
            data-workspace-helios-chat-send
          >
            {busy ? "Helios is working…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
