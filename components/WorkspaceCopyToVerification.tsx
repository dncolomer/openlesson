"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Copies goals, context, and knowledge regions from a Learning workspace
 * into a new Verification workspace. Map, DAGs, and AYCL stay behind.
 */
export function WorkspaceCopyToVerification({
  workspaceId,
  workspaceTitle,
  isOwner,
}: {
  workspaceId: string;
  workspaceTitle: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(
    workspaceTitle.trim() ? `${workspaceTitle.trim()} verification` : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOwner) return null;

  const create = async () => {
    const title = name.trim();
    if (!title || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/copy-to-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data?.error?.message === "string"
            ? data.error.message
            : "Could not create the Verification workspace.";
        setError(message);
        return;
      }
      const nextId = typeof data.workspaceId === "string" ? data.workspaceId : "";
      if (!nextId) {
        setError("Could not create the Verification workspace.");
        return;
      }
      router.push(`/workspace/${nextId}`);
    } catch {
      setError("Could not create the Verification workspace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="copy-to-verification"
    >
      <h2 className="text-sm font-medium text-white">Verification workspace</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-400">
        Create a Verification workspace from this map&apos;s goals, context, and knowledge regions.
        The map stays on this Learning workspace.
      </p>
      <label className="mt-4 block text-xs text-neutral-500" htmlFor={`copy-verification-${workspaceId}`}>
        Name
      </label>
      <input
        id={`copy-verification-${workspaceId}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={120}
        className="mt-1 w-full max-w-md rounded-none border border-neutral-800 bg-black px-3 py-2 text-sm text-white"
        data-copy-verification-name
      />
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || name.trim().length === 0}
        className="mt-3 rounded-none bg-white px-3 py-2 text-xs font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
        data-copy-verification-submit
      >
        {busy ? "Creating…" : "Create verification workspace from this"}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-400" data-copy-verification-error>
          {error}
        </p>
      ) : null}
    </section>
  );
}
