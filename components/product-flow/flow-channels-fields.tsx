"use client";

import {
  FLOW_CHANNEL_IDS,
  FLOW_CHANNEL_LABELS,
  type FlowChannelId,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import { FLOW_FORM_LABEL } from "@/components/product-flow/product-flow-form";

export function FlowChannelsFields({
  value,
  onChange,
}: {
  value: FlowEnforcedChannels;
  onChange: (next: FlowEnforcedChannels) => void;
}) {
  function toggle(id: FlowChannelId) {
    onChange({ ...value, [id]: !value[id] });
  }

  return (
    <div className="space-y-4" data-flow-channels="">
      <p className={FLOW_FORM_LABEL}>Enforced channels</p>
      <p className="text-sm leading-relaxed text-neutral-400">
        Required for this run. A required channel with no data flowing
        invalidates the session. Audio off leaves the microphone optional and
        embeds canvas proof of work only.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FLOW_CHANNEL_IDS.map((id) => {
          const checked = value[id];
          return (
            <button
              key={id}
              type="button"
              data-flow-channel={id}
              data-flow-channel-on={checked ? "" : undefined}
              aria-pressed={checked}
              onClick={() => toggle(id)}
              className={`flex h-12 items-center justify-between border px-4 text-left text-sm transition ${
                checked
                  ? "border-white bg-white text-black"
                  : "border-white/40 bg-black text-neutral-300 hover:border-white/70 hover:text-white"
              }`}
            >
              <span>{FLOW_CHANNEL_LABELS[id]}</span>
              <span className="font-mono text-[10px] uppercase tracking-[1.6px]">
                {checked ? "On" : "Off"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
