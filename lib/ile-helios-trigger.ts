/**
 * ILE Helios dialogue: classify a Helios appearance as a learner send vs an
 * auto-fire (idle heartbeat, speech-segment TIM, or other PoW interruption).
 *
 * Auto-fires stay off the ILE dialogue so Helios does not appear without a
 * send. whyHelios is the explanation token if a surface ever shows them.
 * TAP idle/interruption UX does not use this helper.
 */

export type IleHeliosPowOrigin = "idle" | "speech" | "other";

export type IleHeliosTriggerKind = "user_send" | "idle" | "speech" | "interruption";

export type IleHeliosTriggerInput = {
  kind: IleHeliosTriggerKind;
};

export const ILE_HELIOS_WHY_COPY = {
  idle: "Helios checked in after a pause in your work.",
  speech: "Helios responded to a spoken segment.",
  interruption: "Helios interrupted from a proof-of-work signal.",
} as const;

export type IleHeliosTriggerDecision = {
  kind: IleHeliosTriggerKind;
  /** Learner send → Helios reply on the ILE dialogue. Auto-fires do not. */
  showOnDialogue: boolean;
  whyHelios: string | null;
};

export function ileHeliosTriggerKindFromPowOrigin(
  origin: IleHeliosPowOrigin | undefined,
): Exclude<IleHeliosTriggerKind, "user_send"> {
  if (origin === "idle") return "idle";
  if (origin === "speech") return "speech";
  return "interruption";
}

export function classifyIleHeliosTrigger(
  input: IleHeliosTriggerInput,
): IleHeliosTriggerDecision {
  if (input.kind === "user_send") {
    return { kind: "user_send", showOnDialogue: true, whyHelios: null };
  }
  return {
    kind: input.kind,
    showOnDialogue: false,
    whyHelios: ILE_HELIOS_WHY_COPY[input.kind],
  };
}

/** Same classifier the ILE idle/speech apply path uses at fire time. */
export function applyIleHeliosAutoFire(input: {
  kind: IleHeliosTriggerKind;
}): IleHeliosTriggerDecision & { applied: boolean } {
  const decision = classifyIleHeliosTrigger({ kind: input.kind });
  return { ...decision, applied: decision.showOnDialogue };
}
