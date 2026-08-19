/**
 * Prep Helios / ILE chat text for react-markdown + KaTeX.
 * Strips leaked role tags and un-doubles LLM LaTeX backslashes.
 */
export function processHeliosMarkdown(content: string): string {
  return String(content || "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "")
    .replace(
      /<\/?(?:system|developer|assistant|user|tool|system-reminder)[^>]*>/gi,
      "",
    )
    .replace(/```(?:system|developer|tool|assistant|user)[\s\S]*?```/gi, "")
    .replace(/\\\\([a-zA-Z]+)/g, "\\$1")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)");
}
