"use client";

import { useEffect, useState } from "react";

type CatalogProtocol = {
  type: "protocol";
  id: string;
  name: string;
  challenge?: string;
  publicToken: string;
};

type CatalogRegion = {
  type: "region";
  id: string;
  name: string;
  kind: string;
};

const CARD = "console-copy rounded-none p-5 sm:p-6";
const LABEL = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const BTN =
  "inline-flex h-10 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black";

export function LtiDeepLinkPicker() {
  const [error, setError] = useState("");
  const [protocols, setProtocols] = useState<CatalogProtocol[]>([]);
  const [regions, setRegions] = useState<CatalogRegion[]>([]);

  useEffect(() => {
    void fetch("/api/lti/catalog")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || "Could not load catalog");
        }
        setProtocols(Array.isArray(payload.protocols) ? payload.protocols : []);
        setRegions(Array.isArray(payload.regions) ? payload.regions : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load catalog"));
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-10 text-white" data-lti-deep-link="">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className={LABEL}>LTI 1.3</p>
          <h1 className="mt-2 font-serif text-2xl">Add to the course</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Pick a published protocol, attach a knowledge region, or create a region from a simulation.
          </p>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <section className={CARD} data-lti-deep-link-protocols="">
          <p className={LABEL}>Protocols</p>
          <ul className="mt-4 space-y-2">
            {protocols.length === 0 ? (
              <li className="text-sm text-neutral-500">No published protocols in this organization.</li>
            ) : (
              protocols.map((protocol) => (
                <li key={protocol.id}>
                  <form method="post" action="/api/lti/deep-link" className="flex items-center justify-between gap-3">
                    <input type="hidden" name="type" value="protocol" />
                    <input type="hidden" name="id" value={protocol.id} />
                    <input type="hidden" name="name" value={protocol.name} />
                    <input type="hidden" name="publicToken" value={protocol.publicToken} />
                    <div>
                      <p className="text-sm text-white">{protocol.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                        {protocol.challenge || "Protocol"}
                      </p>
                    </div>
                    <button type="submit" className={BTN}>
                      Add
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className={CARD} data-lti-deep-link-regions="">
          <p className={LABEL}>Knowledge regions</p>
          <ul className="mt-4 space-y-2">
            {regions.length === 0 ? (
              <li className="text-sm text-neutral-500">No knowledge regions yet.</li>
            ) : (
              regions.map((region) => (
                <li key={region.id}>
                  <form method="post" action="/api/lti/deep-link" className="flex items-center justify-between gap-3">
                    <input type="hidden" name="type" value="region" />
                    <input type="hidden" name="id" value={region.id} />
                    <input type="hidden" name="name" value={region.name} />
                    <input type="hidden" name="kind" value={region.kind} />
                    <div>
                      <p className="text-sm text-white">{region.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                        {region.kind}
                      </p>
                    </div>
                    <button type="submit" className={BTN}>
                      Add
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>

        <form method="post" action="/api/lti/deep-link" className={CARD} data-lti-deep-link-create="">
          <input type="hidden" name="type" value="create_region" />
          <p className={LABEL}>Create</p>
          <p className="mt-2 text-sm text-neutral-300">
            Run a simulation to create a knowledge region for this course.
          </p>
          <button type="submit" className={`${BTN} mt-4`}>
            Create knowledge region
          </button>
        </form>
      </div>
    </main>
  );
}
