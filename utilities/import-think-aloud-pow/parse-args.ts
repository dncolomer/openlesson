export const IMPORT_THINK_ALOUD_USAGE = `Usage:
  npm run import:think-aloud-pow -- --media <path> --workspace <id>
  npm run import:think-aloud-pow -- --media <path> --workspace <id> --dry-run
  npm run import:think-aloud-pow -- --transcript <json> --workspace <id> --dry-run

ILE Explore Solo only (project / Solo). Persist is the default path.
--dry-run prints the event list and does not write PoW.

Options:
  --media <path>         Video or audio file (xAI STT)
  --transcript <path>    Word-level JSON fixture (skips STT; for debug)
  --workspace <id>       Workspace UUID (required)
  --session <id>         Optional ILE session UUID (generated if omitted)
  --block <id>           Optional block UUID
  --dry-run              Print timeline / mapped events; do not persist
  --help, -h             Show this help

Never TAP. Never Helios chat. System 2 promotions are inferred via xAI and applied automatically.
`;

export type ImportThinkAloudArgs = {
  help: boolean;
  dryRun: boolean;
  mediaPath: string | null;
  transcriptPath: string | null;
  workspaceId: string | null;
  sessionId: string | null;
  blockId: string | null;
  errors: string[];
};

function takeValue(argv: string[], index: number): { value: string | null; next: number } {
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) return { value: null, next: index };
  return { value: next, next: index + 1 };
}

export function parseImportThinkAloudArgs(argv: string[]): ImportThinkAloudArgs {
  const result: ImportThinkAloudArgs = {
    help: false,
    dryRun: false,
    mediaPath: null,
    transcriptPath: null,
    workspaceId: null,
    sessionId: null,
    blockId: null,
    errors: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg === "--media") {
      const taken = takeValue(argv, i);
      result.mediaPath = taken.value;
      i = taken.next;
      if (!taken.value) result.errors.push("--media requires a path");
      continue;
    }
    if (arg === "--transcript") {
      const taken = takeValue(argv, i);
      result.transcriptPath = taken.value;
      i = taken.next;
      if (!taken.value) result.errors.push("--transcript requires a path");
      continue;
    }
    if (arg === "--workspace") {
      const taken = takeValue(argv, i);
      result.workspaceId = taken.value;
      i = taken.next;
      if (!taken.value) result.errors.push("--workspace requires an id");
      continue;
    }
    if (arg === "--session") {
      const taken = takeValue(argv, i);
      result.sessionId = taken.value;
      i = taken.next;
      continue;
    }
    if (arg === "--block") {
      const taken = takeValue(argv, i);
      result.blockId = taken.value;
      i = taken.next;
      continue;
    }
    result.errors.push(`Unknown argument: ${arg}`);
  }

  if (!result.help) {
    if (!result.workspaceId) result.errors.push("--workspace is required");
    if (!result.mediaPath && !result.transcriptPath) {
      result.errors.push("--media or --transcript is required");
    }
  }
  return result;
}
