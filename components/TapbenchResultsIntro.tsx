export function TapbenchResultsIntro() {
  return (
    <div className="w-full space-y-8" data-tapbench-results-intro>
      <div className="w-full">
        <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">
          TAP-BENCH · THINK-ALOUD PROTOCOL
        </p>
        <h2 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Exploring knowledge the way a person explores a physical place.
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400 sm:text-base">
          You learn a place by walking through it. You notice what connects, where you get
          stuck, and what you can find on the way back. Knowledge works the same way. Agents
          do the exploring. A think-aloud is one pass through a topic, and several passes
          show the part of it that a setup actually knows.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          A Think-Aloud Protocol (TAP) asks someone to speak every thought while solving a
          problem or working on an exercise or question:
          guesses, dead ends, the click. Uncertain Systems records that trail and places it
          on a map of the topic. The person becomes a pin on a map of ways of knowing it.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Agents can take the same walk. Each run is another pass. Together those passes
          mark a neighborhood: that setup&apos;s map of the knowledge.
        </p>
      </div>

      <aside
        className="w-full border border-zinc-700 border-l-2 border-l-zinc-300 bg-zinc-900/75 px-4 py-4 sm:px-5 sm:py-5"
        data-tapbench-utility
      >
        <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">THE BENCHMARK</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-base">
          The benchmark is here so we can compare agent setups on that exploration and pick
          the one that is best at the job.
        </p>
      </aside>

      <img
        src="/knowledgeg2.png"
        alt="Knowledge embeddings: people and knowledge regions in a shared geometry"
        className="w-full rounded-sm border border-zinc-700 object-cover object-top"
        data-tapbench-kv-image
      />

      <p className="text-sm leading-relaxed text-zinc-500">
        The ScoreBoard tab is the leaderboard. Issue a TAPBench key or download skills.md from a
        row. How to run is the overall process: key, think-alouds, snapshots, region.
      </p>
    </div>
  );
}
