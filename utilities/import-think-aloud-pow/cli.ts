import { IMPORT_THINK_ALOUD_USAGE, parseImportThinkAloudArgs } from "./parse-args";
import { runImportThinkAloud } from "./run";

export async function runImportThinkAloudCli(argv: string[]): Promise<number> {
  const args = parseImportThinkAloudArgs(argv);
  if (args.help) {
    process.stdout.write(IMPORT_THINK_ALOUD_USAGE);
    return 0;
  }
  if (args.errors.length > 0) {
    process.stderr.write(`${args.errors.join("\n")}\n\n${IMPORT_THINK_ALOUD_USAGE}`);
    return 1;
  }

  try {
    const result = await runImportThinkAloud({
      workspaceId: args.workspaceId!,
      mediaPath: args.mediaPath,
      transcriptPath: args.transcriptPath,
      sessionId: args.sessionId,
      blockId: args.blockId,
      dryRun: args.dryRun,
    });
    const payload = {
      surface: "ile",
      session_mode: "project",
      dry_run: result.dryRun,
      persisted: result.persisted,
      transcribed: result.transcribed,
      system2_inferred: result.system2Inferred,
      ffmpeg: result.ffmpeg,
      warnings: result.warnings,
      events: result.events,
      tool_names: [...new Set(result.uploads.map((row) => row.tool_name).filter(Boolean))],
      types: [...new Set(result.uploads.map((row) => row.type))],
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}
