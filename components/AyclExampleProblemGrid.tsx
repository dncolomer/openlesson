export function AyclExampleProblemGrid({
  problems,
}: {
  problems: readonly string[];
}) {
  const cards = problems.slice(0, 4);
  if (cards.length === 0) return null;
  return (
    <ul
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-aycl-example-problems
    >
      {cards.map((problem, index) => (
        <li
          key={`problem-${index}`}
          className="console-copy flex min-h-[8.5rem] flex-col rounded-none px-4 py-4 text-sm leading-relaxed text-zinc-300"
          data-aycl-landing-problem
        >
          <span className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="text-zinc-200">{problem}</p>
        </li>
      ))}
    </ul>
  );
}
