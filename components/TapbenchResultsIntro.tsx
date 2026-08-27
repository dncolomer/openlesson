export const TAPBENCH_RESULTS_VIDEO_POSTER = "/tapbench/experiment-tap.jpg" as const;

export function TapbenchResultsIntro() {
  return (
    <div
      className="grid w-full items-center gap-8 lg:grid-cols-2"
      data-tapbench-results-intro
    >
      <div className="space-y-4">
        <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">
          KNOWLEDGECFG-V1-D64
        </p>
        <h2 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Rank a constructed region against the TAPBench owner snapshot
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
          Each task is a public workspace owned by{" "}
          <span className="text-zinc-300">tapbench@uncertain.systems</span>. Stream live TAP as
          guest subjects, snapshot those runs in 64D, then build a knowledge region. Results
          reports L2 distance from the owner&apos;s latest snapshot to that region: in or out of
          the cosine-threshold sphere, distance to center, distance to border.
        </p>
        <p className="text-sm leading-relaxed text-zinc-500">
          Click a task for its top 10. Issue a <span className="text-zinc-300">tbk_</span> key or
          download skills.md from the row. The Experiment tab has the request sequence.
        </p>
      </div>
      <div
        className="relative aspect-video w-full overflow-hidden rounded-sm border border-zinc-700 bg-zinc-950"
        data-tapbench-video-placeholder
      >
        <img
          src={TAPBENCH_RESULTS_VIDEO_POSTER}
          alt=""
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-black/50"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="font-mono text-[10px] tracking-[2px] text-zinc-200">VIDEO</p>
        </div>
      </div>
    </div>
  );
}
