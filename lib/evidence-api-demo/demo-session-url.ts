export function buildDemoTapSessionUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/tap/session/${token}`;
}

export function normalizeDemoSessionUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function openDemoSessionUrl(url: string): void {
  const normalized = normalizeDemoSessionUrl(url);
  const link = document.createElement("a");
  link.href = normalized;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}