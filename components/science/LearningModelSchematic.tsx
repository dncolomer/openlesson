import { LEARNING_MODEL_CATALOG_4 } from "@/lib/learning-model";
import {
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_EXAMPLE,
} from "@/lib/science/learning-model-copy";

export function LearningModelSchematic() {
  const example = SCIENCE_LEARNING_MODEL_EXAMPLE;
  return (
    <figure
      className="console-copy p-5 sm:p-6"
      data-learning-model-schematic
    >
      <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        G* · {example.generativeModel}
      </figcaption>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {SCIENCE_LEARNING_MODEL_COPY.schematicLead}
      </p>

      <div className="mt-6 border border-white/20 p-4 sm:p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          State factor f · {example.stateFactor}
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {example.hiddenStates.map((state, index) => (
            <li
              key={state.id}
              data-schematic-hidden-state={state.id}
              className="border border-white/15 px-3 py-3"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Hidden state s{index + 1}
              </p>
              <p className="mt-1 text-sm text-white">{state.title}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                Likelihood p(o|s): {state.likelihood}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Actions u · policy π
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEARNING_MODEL_CATALOG_4.map((action) => (
            <li
              key={action.id}
              data-schematic-action={action.id}
              className="border border-white/20 px-3 py-3"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {action.kind}
              </p>
              <p className="mt-1 text-sm text-white">{action.label}</p>
            </li>
          ))}
        </ul>
      </div>

      <ol
        className="mt-6 grid gap-2 sm:grid-cols-3"
        data-learning-model-projection-map
      >
        <li className="border border-white/15 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Calibrate
          </p>
          <p className="mt-1 text-sm text-zinc-300">Projects onto hidden states. Leaves a prior.</p>
        </li>
        <li className="border border-white/15 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Learn
          </p>
          <p className="mt-1 text-sm text-zinc-300">Projects onto actions. Leaves a posterior.</p>
        </li>
        <li className="border border-white/15 px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Verify
          </p>
          <p className="mt-1 text-sm text-zinc-300">Projects onto the cheapest policy. Leaves a distance.</p>
        </li>
      </ol>
    </figure>
  );
}
