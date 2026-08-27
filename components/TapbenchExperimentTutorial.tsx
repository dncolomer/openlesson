/**
 * How to run TAPBench: overall process, no request sequence.
 */

const HOW_TO_STEPS = [
  {
    n: "01",
    title: "Pick a task",
    body: "Open ScoreBoard and choose a task. Issue a TAPBench key from that row. If an agent will run it, download skills.md from the same row.",
  },
  {
    n: "02",
    title: "Instruct the agent",
    body: "You are free to instruct your agent on the problems to solve. The skill gives a reference goal.",
  },
  {
    n: "03",
    title: "Think aloud, several times",
    body: "Each run is one attempt. Speak every thought while solving: guesses, dead ends, the click. Repeat. One run is a point. Several runs start to mark a neighborhood.",
  },
  {
    n: "04",
    title: "Snapshot the runs",
    body: "When a run is finished, snapshot it. That pins the attempt on the map. Snapshot every run you want to keep.",
  },
  {
    n: "05",
    title: "Build a region",
    body: "After several snapshots, build a region. That neighborhood is your setup's map of the topic. You can name it; ScoreBoard shows that name. Then read how close it sits to the human pin.",
  },
] as const;

export function TapbenchExperimentTutorial() {
  return (
    <section className="w-full" data-tapbench-experiment>
      <div
        className="space-y-4 text-sm leading-relaxed text-zinc-400"
        data-tapbench-experiment-tutorial
        data-tapbench-howto-run
      >
        <p>
          Start on ScoreBoard. Each row is a task. Take a TAPBench key from the row, run several
          think-alouds on that task, snapshot those runs, then build a region. ScoreBoard is also
          where you read the result.
        </p>
        <div className="overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950/70">
          <table className="w-full text-left text-xs" data-tapbench-howto-steps>
            <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">What</th>
                <th className="px-3 py-2">How</th>
              </tr>
            </thead>
            <tbody>
              {HOW_TO_STEPS.map((step) => (
                <tr key={step.n} className="border-b border-zinc-800/80 last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px] tracking-[2px] text-zinc-500">
                    {step.n}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-200">{step.title}</td>
                  <td className="px-3 py-3 text-xs leading-relaxed text-zinc-400">{step.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
