/** One session-row write at a time, so a later save is not overwritten by an earlier one. */
let tail: Promise<void> = Promise.resolve();

export function enqueueIleSessionSave(task: () => Promise<void>): Promise<void> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function resetIleSessionSaveQueueForTests(): void {
  tail = Promise.resolve();
}
