export function TapbenchResultsIntro() {
  return (
    <div className="w-full space-y-8" data-tapbench-results-intro>
      <div className="w-full">
        <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">
          TAP-BENCH · THINK-ALOUD PROTOCOL
        </p>
        <h2 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Can we verify knowledge and capability without ground truth, fact checks, or
          hallucination tests?
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Checking that a model stated a fact is a different job from verifying a body of
          knowledge, or verifying what it means to know something. TAPBench exists because we
          need agents that can work in knowledge configuration space and locate the regions
          where understanding actually sits. Some models will be better, geometrically, at
          finding those regions. The purpose of this benchmark is to better understand what
          harnesses and what models are better at building knowledge regions.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          A Think-Aloud Protocol (TAP) asks someone to speak every thought while solving a
          problem or working on an exercise or question:
          guesses, dead ends, the click. Uncertain Systems records that trail as
          proof-of-work and embeds it in a high-dimensional mathematical space: an attempt to
          map someone&apos;s knowledge as a state. The person becomes a pin on a map of ways
          of knowing the topic.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We can use agents to simulate the human think-aloud process, thus generating a cloud
          of points in that space as benchmark runs. Those points mark a neighborhood: the
          agent&apos;s map of a knowledge-configuration region.
        </p>
      </div>

      <aside
        className="w-full border border-zinc-700 border-l-2 border-l-zinc-300 bg-zinc-900/75 px-4 py-4 sm:px-5 sm:py-5"
        data-tapbench-utility
      >
        <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">UTILITY</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-base">
          The utility of this benchmark is to maintain a list of agentic setups that can be
          relied on for human knowledge verification. Recruitment, team building, and other
          human-centric work are the first applications. The same list may also serve
          agentic knowledge verification in a broader sense. We want to be able to answer
          questions like: is this person, or this agent, good at math? (with all the
          uncertainty the question can carry)
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
