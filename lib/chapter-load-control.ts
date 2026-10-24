/**
 * Chapter-map load control: active chapter stays clickable (re-load).
 * In-flight load is the only disable reason.
 */

export const CHAPTER_LOAD_LABEL = "Load chapter";
export const CHAPTER_RELOAD_LABEL = "Reload Chapter";

export const CHAPTER_LOAD_LABEL_KEY = "chapterMap.loadChapter";
export const CHAPTER_RELOAD_LABEL_KEY = "chapterMap.reloadChapter";

export type ChapterLoadControl = {
  disabled: boolean;
  isActiveChapter: boolean;
  labelKey: typeof CHAPTER_LOAD_LABEL_KEY | typeof CHAPTER_RELOAD_LABEL_KEY;
};

export function isSelectedChapterActive(input: {
  selectedIndex: number | null | undefined;
  activeChapterIndex: number | null | undefined;
}): boolean {
  const selected = Number(input.selectedIndex);
  const active = Number(input.activeChapterIndex);
  if (!Number.isFinite(selected) || selected < 0) return false;
  if (!Number.isFinite(active) || active < 0) return false;
  return selected === active;
}

export function isChapterLoadControlDisabled(input: {
  selectedIndex: number | null | undefined;
  loadingChapterIndex?: number | null;
}): boolean {
  const selected = Number(input.selectedIndex);
  if (!Number.isFinite(selected) || selected < 0) return true;
  return input.loadingChapterIndex === selected;
}

export function chapterLoadControlLabelKey(isActiveChapter: boolean): ChapterLoadControl["labelKey"] {
  return isActiveChapter ? CHAPTER_RELOAD_LABEL_KEY : CHAPTER_LOAD_LABEL_KEY;
}

export function chapterLoadControlEnglishLabel(isActiveChapter: boolean): string {
  return isActiveChapter ? CHAPTER_RELOAD_LABEL : CHAPTER_LOAD_LABEL;
}

/** In-flight load is the only reason to ignore a load/re-load click. */
export function shouldAllowChapterLoadClick(input: { chapterLoading: boolean }): boolean {
  return !input.chapterLoading;
}

export function resolveChapterLoadControl(input: {
  selectedIndex: number | null | undefined;
  activeChapterIndex: number | null | undefined;
  loadingChapterIndex?: number | null;
}): ChapterLoadControl {
  const isActiveChapter = isSelectedChapterActive(input);
  return {
    disabled: isChapterLoadControlDisabled(input),
    isActiveChapter,
    labelKey: chapterLoadControlLabelKey(isActiveChapter),
  };
}
