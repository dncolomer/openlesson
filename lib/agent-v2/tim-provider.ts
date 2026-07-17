import type { ProofOfWorkApiInterruption } from "./predictive-interruption-types";
import { normalizePredictedInterruption } from "./tim-normalize";
import type { TimFeatureEnvelopeV1 } from "./tim-feature-envelope";
import { predictRawFromFeaturesWithLlm } from "./tim-llm-predictor";

/**
 * Pluggable Trace Interruption Model backend.
 * Default is in-process Grok; a future external TIM implements the same interface.
 */
export interface TimProvider {
  readonly id: string;
  predict(features: TimFeatureEnvelopeV1): Promise<ProofOfWorkApiInterruption>;
}

let providerOverride: TimProvider | null = null;

export function setTimProviderForTests(provider: TimProvider | null): void {
  providerOverride = provider;
}

export function getTimProvider(): TimProvider {
  return providerOverride ?? defaultGrokTimProvider;
}

/**
 * Default baked-in TIM: Grok over the feature envelope.
 * Returns null when the model declines interruption (or API unavailable).
 */
export const defaultGrokTimProvider: TimProvider = {
  id: "builtin-grok",
  async predict(features: TimFeatureEnvelopeV1): Promise<ProofOfWorkApiInterruption> {
    const raw = await predictRawFromFeaturesWithLlm(features);
    if (!raw?.should_interrupt) {
      return null;
    }
    return normalizePredictedInterruption(
      {
        delay_ms: raw.delay_ms,
        confidence: raw.confidence,
        intervention: {
          type: raw.intervention_type,
          message: raw.message,
          rationale: raw.rationale,
          consumer_action: raw.consumer_action,
          block_id: features.event.block_id ?? null,
        },
      },
      features.event.endpoint,
      features.event.workspace_id,
    );
  },
};

export async function predictWithTimProvider(
  features: TimFeatureEnvelopeV1,
): Promise<ProofOfWorkApiInterruption> {
  return getTimProvider().predict(features);
}
