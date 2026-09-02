/**
 * Mode-aware ILE chapter grain, closure, and map-expansion instructions.
 *
 * Dialog (Learning Mode) chapters are topic-horizon conversations.
 * Project (Solo / exercise) chapters stay standalone longer-horizon tasks.
 *
 * Grain and Done policy live as prompt data filled by compose helpers so
 * tests can assert Dialog vs Project text without calling a model.
 */
import {
  ILE_SESSION_MODE_DEFAULT,
  normalizeIleSessionMode,
  type IleSessionMode,
} from "@/lib/ile-mode";

/** Dialog must not offer Mark as Done before this many substantive learner turns. */
export const ILE_DIALOG_MIN_SUBSTANTIVE_TURNS_BEFORE_DONE = 3;

export const ILE_CHAPTER_SUGGEST_TOOL_ACTION = "chapter_suggest" as const;
export const ILE_CHAPTER_ADD_TOOL_ACTION = "chapter_add" as const;
export const ILE_CHAPTER_LOAD_TOOL_ACTION = "chapter_load" as const;
export const ILE_CHAPTER_RELOAD_TOOL_ACTION = "chapter_reload" as const;

const CHAPTER_SUGGEST_MARKER =
  /<!--\s*ile-chapter-suggest\s*:\s*([\s\S]*?)\s*-->/i;

export interface IleChapterSuggestion {
  topic: string;
  title: string;
  description: string;
  keyword?: string;
}

/**
 * Shared opinionated learning harness for chapter-create and in-chapter coaching.
 * Topic-aware: do not stamp the same elicit → draw → list loop on every subject.
 */
export function ileLearningHarnessRules(): string {
  return `LEARNING HARNESS (opinionated, topic-aware — chapter map AND live coaching):
This product is a learning harness, not a quiz and not a one-size-fits-all workshop. Be opinionated about HOW to guide this specific topic: mix diagnostic questions with tasks the learner must do. Never force the same chapter structure or the same in-chapter move for every subject.

CHAPTER PATH (what chapters exist and how they are typed):
- Sequence chapters as a guided path through THIS topic: what to ask vs what to make them do next.
- Mix question | task | suggestion | checkpoint as the topic warrants — not question-only, not "summarize / sketch / list" stamped onto every map.
- Choose chapter shapes from the topic: worked example, comparison, case judgment, implementation, derivation, definition-then-apply, critique, lookup-then-use, oral walkthrough. Do not invent a Canvas or drawing chapter because "we always draw."

IN-CHAPTER MOVES (how Helios guides the next turn):
- After a workable first answer, go deeper on the same topic: apply, contrast, debug, extend, or checkpoint. Ask another question only when it unblocks that act.
- Pick the next move from the topic, not a fixed loop (forbidden as always-on defaults: "sketch this on the Canvas", "draw it", "make a list", "summarize what you understand").
- Canvas / sketch / draw ONLY when the work is spatial, structural, visual, or the learner is stuck on a relationship that a diagram would actually clarify. For purely verbal, ethical, historical, legal, conversational, or definition-only work, do not send them to the Canvas.

TOOL FIT (use when the topic earns it — never as ritual):
- Canvas: diagrams, systems, geometry, architecture, flow, spatial relations.
- Notebook: decisions, written proofs, case notes, reflections.
- Screen share / IDE: when the artifact lives outside ILE.
- Grokipedia: facts or examples that unblock practice — not a substitute for doing the work.`;
}

export function ileChapterGrainRules(mode: IleSessionMode): string {
  if (mode === "project") {
    return `PROJECT CHAPTER GRAIN (Explore Solo — standalone exercises):
- Each chapter is a standalone longer-horizon exercise: one completable task per chapter, not a Dialog multi-turn script.
- Write a self-contained exercise the learner can finish solo (Thoughts, Notebook, Canvas as needed). Do not script a conversation sequence.
- Do not split one exercise into micro-chapters such as "summarize what you understand as X", "draw X on a notebook", "make a list", then "finish the list from chapter 1".
- Activity types (question | task | suggestion | checkpoint) name the chapter's primary exercise shape. They MUST NOT each become their own chapter.
- After Mark as Done, the product may suggest adjacent follow-up exercise chapters. Do not pre-split those follow-ups into the initial map unless they are distinct standalone exercises.`;
  }

  return `DIALOG CHAPTER GRAIN (Explore · Dialog / Learning Mode — topic-horizon conversations):
- Each chapter is a topic-horizon conversation: a multi-turn guided dialogue on one topic, not a single interaction.
- Sequential micro-acts that belong in one conversation MUST be one chapter, not four. Forbidden Dialog splits (these are turns inside one chapter, never separate chapters):
  * "Summarize what you understand as X"
  * "Draw X on a notebook" / sketch X on the Canvas
  * "Make a list" of the note taker / capture a list
  * "Finish the list from chapter 1" / continue the same artifact
- Activity types (question | task | suggestion | checkpoint) mix inside a chapter as turns or as the chapter's primary type. They MUST NOT each become their own chapter.
- Work that uses the same chapter-scoped tool (Notebook / Canvas) stays in that one chapter. Tools are chapter-scoped — do not send the learner to a new chapter to keep writing the same notebook or canvas.
- Chapter descriptions name the topic-horizon (what they can do after a deep conversation), not a one-shot micro-task.`;
}

export function ileChapterClosureRules(mode: IleSessionMode): string {
  if (mode === "project") {
    return `PROJECT MARK-AS-DONE POLICY:
- Each chapter is a standalone exercise. Invite Mark as Done when the learner has completed that exercise (or it is substantially done).
- Preserve follow-up-after-Done: after Done, adjacent exercise chapters may be suggested.
- Dual-stack Thoughts / Done-lock / no-eval-on-Done stay unchanged.
- A finished exercise is enough — do not invent extra validation after the task is done.`;
  }

  return `DIALOG MARK-AS-DONE POLICY:
- Do NOT invite "Mark as Done" after the first shallow interaction or the first workable answer. First-interaction closure is forbidden.
- A workable first answer is a reason to go deeper in-chapter — ask a follow-up, route a tool, apply, compare, or checkpoint — not to close.
- Closure is offered only after a multi-turn guided conversation has substantially met that chapter's objective (several learner turns covering elicit → apply/externalize → check).
- Set can_auto_advance true only when that multi-turn / chapter-objective depth is met.
- Do not invent stricter edge-case tests after a workable answer; go deeper on the same topic instead of closing early.`;
}

export function ileChapterExpansionRules(mode: IleSessionMode): string {
  if (mode === "project") {
    return `PROJECT CHAPTER MAP EXPANSION:
- After Mark as Done, suggest adjacent follow-up exercise chapters (existing Project follow-up flow).
- Completing a chapter is also Proof of Work: TIM may place an adjacent TIM-sourced exercise (explore icon until accepted or rejected), in addition to the follow-up chips.
- Do not prompt mid-exercise to grow the map the way Dialog does.`;
  }

  return `DIALOG CHAPTER MAP EXPANSION:
- The chapter map can be expanded / grow — it is not a fixed list.
- Completing a chapter is Proof of Work. TIM may grow the map with an adjacent TIM-sourced chapter (explore icon until the learner accepts or rejects it). Do not fight that expansion.
- Prompt the learner to suggest / propose new chapters about the topic they are actually working on (not only after Explore Solo Done).
- When they (or you) suggest a new chapter, that suggestion is Proof of Work; if they accept and add it, the accepted add is also Proof of Work.
- Ask something like: "This thread could be its own chapter — want to add one about [concrete topic]?"
- Do not auto-insert chapters without the learner confirming (TIM chapter-complete expansions are the exception).
- When you propose a new chapter, append a hidden last-line marker the client will strip and record as PoW:
  <!--ile-chapter-suggest:{"topic":"<short topic>","title":"<optional title>","keyword":"<1 or 2 map words>"}-->`;
}

/**
 * Fill mode placeholders. If a registry override omits a placeholder, append
 * the matching block so Dialog vs Project grain still differs.
 */
export function applyIleChapterModeInstructions(
  template: string,
  mode?: IleSessionMode | string | null,
): string {
  const resolved = normalizeIleSessionMode(mode, ILE_SESSION_MODE_DEFAULT);
  const grain = ileChapterGrainRules(resolved);
  const closure = ileChapterClosureRules(resolved);
  const expansion = ileChapterExpansionRules(resolved);
  const harness = ileLearningHarnessRules();
  const sessionModeLabel = resolved === "project" ? "project" : "learning";

  let out = template
    .replaceAll("{session_mode}", sessionModeLabel)
    .replaceAll("{ile_session_mode}", sessionModeLabel)
    .replaceAll("{chapter_grain_rules}", grain)
    .replaceAll("{chapter_closure_rules}", closure)
    .replaceAll("{chapter_expansion_rules}", expansion)
    .replaceAll("{learning_harness_rules}", harness);

  const missing: string[] = [];
  if (!template.includes("{chapter_grain_rules}")) missing.push(grain);
  if (!template.includes("{chapter_closure_rules}")) missing.push(closure);
  if (!template.includes("{chapter_expansion_rules}")) missing.push(expansion);
  if (!template.includes("{learning_harness_rules}")) missing.push(harness);
  if (missing.length > 0) {
    out = `${out.trim()}\n\n${missing.join("\n\n")}`;
  }
  return out;
}

export function shouldOfferIleChapterDone(input: {
  sessionMode?: IleSessionMode | string | null;
  canAutoAdvance: boolean;
  substantiveLearnerTurns: number;
}): boolean {
  if (!input.canAutoAdvance) return false;
  const mode = normalizeIleSessionMode(input.sessionMode, ILE_SESSION_MODE_DEFAULT);
  if (mode === "project") return true;
  return (
    input.substantiveLearnerTurns >= ILE_DIALOG_MIN_SUBSTANTIVE_TURNS_BEFORE_DONE
  );
}

export function normalizeIleChapterSuggestion(raw: unknown): IleChapterSuggestion | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const topic = raw.trim();
    if (topic.length < 3) return null;
    return {
      topic: topic.slice(0, 200),
      title: topic.slice(0, 120),
      description: topic.slice(0, 400),
    };
  }
  if (typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const topic = String(
    rec.topic || rec.title || rec.name || rec.chapter || rec.description || "",
  ).trim();
  if (topic.length < 3) return null;
  const title = String(rec.title || rec.name || topic).trim() || topic;
  const description = String(rec.description || rec.body || rec.summary || topic).trim() || topic;
  const keyword = String(rec.keyword || rec.map_keyword || rec.mapKeyword || "").trim();
  return {
    topic: topic.slice(0, 200),
    title: title.slice(0, 120),
    description: description.slice(0, 400),
    ...(keyword ? { keyword: keyword.slice(0, 28) } : {}),
  };
}

/**
 * Strip the hidden Helios marker and return a real suggestion when present.
 * Also recognizes a short "add a chapter about X" coach/learner phrase.
 */
export function extractIleChapterSuggestionFromCoachText(text: string): {
  visibleText: string;
  suggestion: IleChapterSuggestion | null;
} {
  const source = String(text || "");
  const marker = source.match(CHAPTER_SUGGEST_MARKER);
  let suggestion: IleChapterSuggestion | null = null;
  if (marker?.[1]) {
    try {
      suggestion = normalizeIleChapterSuggestion(JSON.parse(marker[1].trim()));
    } catch {
      suggestion = normalizeIleChapterSuggestion(marker[1].trim());
    }
  }

  const visibleText = source.replace(CHAPTER_SUGGEST_MARKER, "").trim();
  if (!suggestion) {
    const phrase = visibleText.match(
      /(?:add|create|open|propose)\s+(?:a\s+)?(?:new\s+)?chapter\s+(?:about|on|for|titled)\s+["“']?([^"”'.\n]{3,160})/i,
    );
    if (phrase?.[1]) {
      suggestion = normalizeIleChapterSuggestion(phrase[1]);
    }
  }
  return { visibleText, suggestion };
}

/**
 * Drive extract + persist payload from a Helios (or learner) turn.
 * Returns stripped visible text plus a real chapter_suggest PoW record.
 */
export function ileChapterSuggestionPowFromCoachText(input: {
  coachText: string;
  learnerText?: string | null;
  sessionMode?: IleSessionMode;
  currentChapterId?: string | null;
  currentChapterDescription?: string | null;
  via?: string;
}): { visibleText: string; toolData: Record<string, unknown> | null } {
  const fromCoach = extractIleChapterSuggestionFromCoachText(input.coachText);
  const fromLearner = input.learnerText
    ? extractIleChapterSuggestionFromCoachText(input.learnerText).suggestion
    : null;
  const suggestion = fromCoach.suggestion ?? fromLearner;
  if (!suggestion) {
    return { visibleText: fromCoach.visibleText, toolData: null };
  }
  return {
    visibleText: fromCoach.visibleText,
    toolData: buildIleChapterSuggestPowToolData({
      topic: suggestion.topic,
      title: suggestion.title,
      description: suggestion.description,
      keyword: suggestion.keyword,
      currentChapterId: input.currentChapterId,
      currentChapterDescription: input.currentChapterDescription,
      via: input.via ?? "helios_dialog",
      sessionMode: input.sessionMode,
    }),
  };
}

/** Persist-payload for Helios / learner "suggested a new chapter" PoW. */
export function buildIleChapterSuggestPowToolData(input: {
  topic: string;
  title?: string | null;
  description?: string | null;
  keyword?: string | null;
  currentChapterId?: string | null;
  currentChapterDescription?: string | null;
  via?: string;
  sessionMode?: IleSessionMode;
}): Record<string, unknown> {
  const suggestion = normalizeIleChapterSuggestion({
    topic: input.topic,
    title: input.title,
    description: input.description,
    keyword: input.keyword,
  });
  if (!suggestion) {
    throw new Error("chapter_suggest PoW requires chapter/topic text");
  }
  return {
    event: ILE_CHAPTER_SUGGEST_TOOL_ACTION,
    tool_action: ILE_CHAPTER_SUGGEST_TOOL_ACTION,
    topic: suggestion.topic,
    title: suggestion.title,
    description: suggestion.description,
    ...(suggestion.keyword ? { keyword: suggestion.keyword } : {}),
    chapter_topic: suggestion.topic,
    current_chapter_id: input.currentChapterId ?? null,
    current_chapter_description: (input.currentChapterDescription || "").slice(0, 160) || null,
    via: input.via ?? "helios_dialog",
    session_mode: input.sessionMode ?? ILE_SESSION_MODE_DEFAULT,
    accepted: false,
  };
}

/** Persist-payload for Load chapter / Reload Chapter (PoW tool event). */
export function buildIleChapterLoadPowToolData(input: {
  stepIndex: number;
  stepId: string;
  stepDescription?: string | null;
  sessionMode?: IleSessionMode;
  reload?: boolean;
  via?: string;
}): Record<string, unknown> {
  const reload = Boolean(input.reload);
  const action = reload ? ILE_CHAPTER_RELOAD_TOOL_ACTION : ILE_CHAPTER_LOAD_TOOL_ACTION;
  return {
    event: action,
    tool_action: action,
    stepIndex: input.stepIndex,
    stepId: input.stepId,
    stepDescription: (input.stepDescription || "").slice(0, 160),
    session_mode: input.sessionMode ?? ILE_SESSION_MODE_DEFAULT,
    reload,
    generate_pow: true,
    via: input.via ?? (reload ? "chapter_map_reload" : "chapter_map_load"),
  };
}

/** Persist-payload for accepted chapter add (existing chapter_add path). */
export function buildIleChapterAddPowToolData(input: {
  stepId: string;
  description: string;
  position_x: number;
  position_y: number;
  sessionMode?: IleSessionMode;
  exercise?: boolean;
  sourceTopic?: string | null;
  via?: string;
}): Record<string, unknown> {
  const description = String(input.description || "").trim();
  if (!description) {
    throw new Error("chapter_add PoW requires chapter/topic text");
  }
  return {
    event: ILE_CHAPTER_ADD_TOOL_ACTION,
    tool_action: ILE_CHAPTER_ADD_TOOL_ACTION,
    stepId: input.stepId,
    description: description.slice(0, 200),
    topic: (input.sourceTopic || description).slice(0, 200),
    position_x: input.position_x,
    position_y: input.position_y,
    session_mode: input.sessionMode ?? ILE_SESSION_MODE_DEFAULT,
    exercise: Boolean(input.exercise),
    accepted: true,
    via: input.via ?? "chapter_map_add",
  };
}
