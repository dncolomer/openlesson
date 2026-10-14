import {
  SCIENCE_LEARNING_MODEL_MODES,
  SCIENCE_LEARNING_MODEL_PIPELINES,
} from "@/lib/science/learning-model-copy";

export function LearningModelPipelines() {
  return (
    <div className="space-y-6" data-learning-model-pipelines>
      {SCIENCE_LEARNING_MODEL_MODES.map((mode) => {
        const pipeline = SCIENCE_LEARNING_MODEL_PIPELINES.find((row) => row.id === mode.id);
        return (
          <article
            key={mode.id}
            data-learning-model-mode={mode.id}
            className="console-copy p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {mode.name}
                </p>
                <h3 className="mt-2 text-lg text-white">{mode.job}</h3>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-zinc-500">
                Result: {mode.result}
              </p>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">{mode.body}</p>
            {pipeline ? (
              <ol className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {pipeline.steps.map((step, index) => (
                  <li
                    key={`${mode.id}-${step.label}`}
                    data-learning-model-step={`${mode.id}-${index}`}
                    className="border border-white/15 px-3 py-3"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      {String(index + 1).padStart(2, "0")} · {step.label}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-300">{step.detail}</p>
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Input: {mode.input}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Projection: {mode.projection}
            </p>
          </article>
        );
      })}
    </div>
  );
}
