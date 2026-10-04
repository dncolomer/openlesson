/** Corner ticks and scan lines shared by the session sidebar console. */

const ARM = "pointer-events-none absolute z-[3] h-2.5 w-2.5 border-white/85";

export function SessionConsoleMarks() {
  return (
    <>
      <span aria-hidden className={`${ARM} left-1 top-1 border-l border-t`} />
      <span aria-hidden className={`${ARM} right-1 top-1 border-r border-t`} />
      <span aria-hidden className={`${ARM} bottom-1 left-1 border-b border-l`} />
      <span aria-hidden className={`${ARM} bottom-1 right-1 border-b border-r`} />
    </>
  );
}

export function SessionConsoleScan() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.05) 3px)",
      }}
    />
  );
}
