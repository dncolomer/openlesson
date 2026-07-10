"use client";

export function AdminLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-neutral-400">
      Loading...
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-red-400">
      <p>{message}</p>
    </div>
  );
}