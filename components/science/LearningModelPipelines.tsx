import { SCIENCE_LEARNING_MODEL_MODES } from "@/lib/science/learning-model-copy";
import { LearningModelModeGlyph } from "@/components/science/LearningModelMarks";

export function LearningModelPipelines() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-learning-model-pipelines>
      {SCIENCE_LEARNING_MODEL_MODES.map((mode) => (
        <article
          key={mode.id}
          data-learning-model-mode={mode.id}
          className="console-copy flex flex-col p-5"
        >
          <div className="flex items-start gap-3">
            <span className="relative h-9 w-9 shrink-0 overflow-clip border border-white/25 text-zinc-200 [clip-path:inset(0)]">
              <LearningModelModeGlyph id={mode.id} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {mode.name}
              </p>
              <h3 className="mt-1 text-lg text-white">{mode.job}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">{mode.body}</p>
        </article>
      ))}
    </div>
  );
}
