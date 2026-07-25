/**
 * Pure helpers + authentic copy for the staging SaaS tech-role demo workspace.
 * No DB I/O — membership and embeddings use shipped knowledge-config / region APIs.
 */

import {
  createCustomVerificationModelFromVectors,
  createSyntheticKnowledgeRegionFromProfile,
  encodeKnowledgeConfig,
  encodeSyntheticRegionProfile,
  scoreAgainstCustomVerificationModel,
  type CustomVerificationModelSpec,
  type CustomVerificationScore,
  type CustomVerificationSubjectRef,
  type PowFeatureRow,
  type SyntheticRegionProfile,
} from "@/lib/knowledge-config";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
} from "@/lib/prompt-kernel/world-model";

/** Stable marker for idempotent find/replace on staging. */
export const SAAS_TECH_DEMO_MARKER = "[DEMO:saas-tech-roles-v1]";

export const SAAS_TECH_DEMO_WORKSPACE = {
  title: "Helios Cloud — Engineering Role Competency Map",
  root_topic: "SaaS multi-role engineering competency verification",
  description:
    "Internal mobility and onboarding workspace for Helios Cloud (B2B SaaS). " +
    "Engineering leadership maps proof-of-work from real tool and screen sessions " +
    "against role knowledge regions — Backend, Frontend, SRE/Platform, and Full-stack Product — " +
    "so transfers and new hires demonstrate the work patterns that matter before they own production paths.",
  conversion_goal:
    "Confirm each engineer lands in the correct role region (or document intentional out-of-region gaps) before production ownership.",
  // Marker stays in notes only (internal idempotency); title stays human/workspace-like.
  notes:
    `${SAAS_TECH_DEMO_MARKER} Internal mobility cohort for Helios eng role mapping — multi-subject PoW, role regions, and core-backend cohort region.`,
  source_type: "topic" as const,
  payment_status: "paid" as const,
  status: "active" as const,
};

export type DemoRoleKey = "backend" | "frontend" | "sre" | "fullstack";

export interface DemoRoleDefinition {
  key: DemoRoleKey;
  regionName: string;
  /** Synthetic role profile used to build the region centroid. */
  profile: SyntheticRegionProfile;
  description: string;
}

export interface DemoPowEvent {
  proof_of_work_type: "tool" | "screen" | "video" | "eeg";
  tool_name: string;
  tool_action: string;
  file_name: string;
  mime_type: string;
  metadata: Record<string, unknown>;
  /** Offset from subject session start (ms). */
  offset_ms: number;
}

export interface DemoSubjectDefinition {
  /** Stable key used for idempotent guest email / labels. */
  key: string;
  displayName: string;
  emailLocalPart: string;
  roleHint: DemoRoleKey | "off_role" | "mixed";
  /** Role this subject should score into (null = deliberately out of all role regions). */
  expectedInRegion: DemoRoleKey | null;
  verification_score: number;
  strengths: string[];
  friction_patterns: string[];
  preferred_modalities: string[];
  powEvents: DemoPowEvent[];
  /**
   * When true, seed stamps PoW / knowledge_config with the workspace owner's
   * auth `user_id` (not a guest). Guests stay the multi-persona cohort.
   */
  isOwnerUser?: boolean;
}

export interface DemoBlockDefinition {
  key: string;
  title: string;
  description: string;
  is_start?: boolean;
}

export const DEMO_BLOCKS: DemoBlockDefinition[] = [
  {
    key: "api_contracts",
    title: "Service boundaries & API contracts",
    description:
      "Design and review gRPC/REST contracts, idempotency, and failure modes for Helios billing and tenant APIs.",
    is_start: true,
  },
  {
    key: "observability",
    title: "Observability & on-call runbooks",
    description:
      "Trace a production incident from alert → dashboards → runbook → postmortem notes with SRE tooling.",
  },
  {
    key: "ui_system",
    title: "Product UI system & client state",
    description:
      "Ship a resilient React surface: design tokens, optimistic mutations, and accessibility checks.",
  },
  {
    key: "release_trains",
    title: "Release trains & progressive delivery",
    description:
      "Cut a canary release with feature flags, rollout metrics, and rollback criteria.",
  },
  {
    key: "data_perf",
    title: "Data model & query performance",
    description:
      "Explain index choices, N+1 traps, and read-path caching for multi-tenant Postgres.",
  },
];

export const DEMO_ROLE_REGIONS: DemoRoleDefinition[] = [
  {
    key: "backend",
    regionName: "Backend Engineering",
    description:
      "High-validation region for backend engineers who own service contracts, Postgres performance, and durable job systems.",
    profile: {
      name: "Backend Engineering",
      description: "Service APIs, Postgres, queues, and multi-tenant isolation",
      verification_score: 88,
      augmentation_score: 82,
      optimization_score: 80,
      ghc_score: 72,
      strengths: [
        "api-contracts",
        "postgres-indexing",
        "queue-reliability",
        "multi-tenant-isolation",
        "idempotent-writes",
      ],
      friction_patterns: ["schema-migration-risk", "n-plus-one-queries"],
      preferred_modalities: ["tool", "screen", "speech"],
      pow_types: ["tool", "screen", "tool", "speech"],
      tool_names: [
        "postgres-explain",
        "grpc-reflection",
        "redis-cli",
        "temporal-ui",
        "datadog-apm",
      ],
    },
  },
  {
    key: "frontend",
    regionName: "Frontend Engineering",
    description:
      "High-validation region for product frontend engineers shipping React surfaces, design systems, and client-side performance.",
    profile: {
      name: "Frontend Engineering",
      description: "React, design tokens, accessibility, and client perf",
      verification_score: 86,
      augmentation_score: 84,
      optimization_score: 78,
      ghc_score: 70,
      strengths: [
        "react-composition",
        "design-tokens",
        "a11y-audit",
        "optimistic-ui",
        "bundle-budget",
      ],
      friction_patterns: ["prop-drilling", "layout-thrash"],
      preferred_modalities: ["screen", "tool", "speech"],
      pow_types: ["screen", "tool", "screen", "speech"],
      tool_names: [
        "chrome-devtools",
        "storybook",
        "figma-inspect",
        "lighthouse",
        "react-profiler",
      ],
    },
  },
  {
    key: "sre",
    regionName: "SRE / Platform",
    description:
      "High-validation region for SRE and platform engineers who run incidents, SLOs, and progressive delivery safely.",
    profile: {
      name: "SRE / Platform",
      description: "Incidents, SLOs, k8s, and canary rollouts",
      verification_score: 90,
      augmentation_score: 80,
      optimization_score: 85,
      ghc_score: 74,
      strengths: [
        "incident-command",
        "slo-error-budgets",
        "k8s-rollouts",
        "runbook-discipline",
        "canary-analysis",
      ],
      friction_patterns: ["alert-fatigue", "toil-creep"],
      preferred_modalities: ["tool", "speech", "screen"],
      pow_types: ["tool", "screen", "speech", "tool"],
      tool_names: [
        "pagerduty",
        "kubectl",
        "grafana",
        "argo-rollouts",
        "incident-io",
      ],
    },
  },
  {
    key: "fullstack",
    regionName: "Full-stack Product Engineering",
    description:
      "High-validation region for full-stack product engineers who cut across API, UI, and ship metrics end-to-end.",
    profile: {
      name: "Full-stack Product Engineering",
      description: "End-to-end feature ownership across API + UI + metrics",
      verification_score: 84,
      augmentation_score: 86,
      optimization_score: 80,
      ghc_score: 76,
      strengths: [
        "feature-flag-ship",
        "end-to-end-ownership",
        "product-metrics",
        "api-ui-contract",
        "customer-repro",
      ],
      friction_patterns: ["context-switch-tax", "half-done-slices"],
      preferred_modalities: ["tool", "screen", "speech"],
      pow_types: ["tool", "screen", "tool", "speech"],
      tool_names: [
        "posthog",
        "linear",
        "vercel-preview",
        "prisma-studio",
        "mixpanel",
      ],
    },
  },
];

function powBundle(
  tools: Array<{
    type?: DemoPowEvent["proof_of_work_type"];
    tool: string;
    action: string;
    file: string;
    mime?: string;
    meta?: Record<string, unknown>;
  }>,
): DemoPowEvent[] {
  return tools.map((t, i) => ({
    proof_of_work_type: t.type ?? (i % 3 === 1 ? "screen" : "tool"),
    tool_name: t.tool,
    tool_action: t.action,
    file_name: t.file,
    mime_type: t.mime ?? (t.type === "screen" ? "image/png" : "application/json"),
    metadata: {
      system: 2,
      demo_subject: true,
      ...(t.meta || {}),
    },
    offset_ms: i * 90_000 + (i % 2) * 12_000,
  }));
}

/**
 * Workspace owner as a real signed-in subject (auth user_id, not guest).
 * Staff / platform-lead style fullstack PoW so the admin sees themselves on the map.
 */
export const DEMO_OWNER_SUBJECT: DemoSubjectDefinition = {
  key: "owner_user",
  displayName: "You (workspace owner)",
  emailLocalPart: "owner+helios-demo",
  roleHint: "fullstack",
  expectedInRegion: "fullstack",
  isOwnerUser: true,
  verification_score: 88,
  strengths: [
    "feature-flag-ship",
    "end-to-end-ownership",
    "api-ui-contract",
    "product-metrics",
    "customer-repro",
  ],
  friction_patterns: ["context-switch-tax"],
  preferred_modalities: ["tool", "screen", "speech"],
  powEvents: powBundle([
    {
      tool: "linear",
      action: "triage-onboarding-epic",
      file: "eng_role_map_epic.json",
      meta: { selective_thought: true, system: 2 },
    },
    {
      tool: "prisma-studio",
      action: "review-tenant-schema",
      file: "tenant_isolation_model.json",
    },
    {
      type: "screen",
      tool: "datadog-apm",
      action: "spot-check-p99",
      file: "owner_service_p99.png",
      mime: "image/png",
    },
    {
      tool: "posthog",
      action: "check-activation-funnel",
      file: "helios_activation.json",
    },
    {
      type: "screen",
      tool: "vercel-preview",
      action: "qa-role-map-ui",
      file: "competency_map_preview.png",
      mime: "image/png",
      meta: { system: 2, submit: true },
    },
    {
      tool: "github",
      action: "review-pr-diff",
      file: "pr_role_regions_diff.json",
      meta: { system: 2 },
    },
  ]),
};

/**
 * Authentic-looking guest subjects: most align to a role; at least one is deliberately off-role.
 * Owner is separate (`DEMO_OWNER_SUBJECT`) and stamped as auth user, not guest.
 */
export const DEMO_SUBJECTS: DemoSubjectDefinition[] = [
  {
    key: "maya_backend",
    displayName: "Maya Chen",
    emailLocalPart: "maya.chen+helios-demo",
    roleHint: "backend",
    expectedInRegion: "backend",
    verification_score: 91,
    strengths: [
      "api-contracts",
      "postgres-indexing",
      "queue-reliability",
      "multi-tenant-isolation",
    ],
    friction_patterns: ["schema-migration-risk"],
    preferred_modalities: ["tool", "screen", "speech"],
    powEvents: powBundle([
      {
        tool: "postgres-explain",
        action: "analyze-query-plan",
        file: "billing_invoice_lookup_plan.json",
        meta: { selective_thought: true, system: 2 },
      },
      {
        type: "screen",
        tool: "datadog-apm",
        action: "inspect-latency-trace",
        file: "tenant_api_p99_trace.png",
        mime: "image/png",
      },
      {
        tool: "grpc-reflection",
        action: "review-proto-contract",
        file: "tenant_service_v3.proto.json",
      },
      {
        tool: "temporal-ui",
        action: "debug-workflow-retry",
        file: "invoice_reconcile_workflow.json",
      },
      {
        tool: "redis-cli",
        action: "inspect-cache-keys",
        file: "rate_limit_bucket_scan.json",
      },
      {
        type: "screen",
        tool: "postgres-explain",
        action: "index-diff-review",
        file: "migration_idx_tenant_created.png",
        mime: "image/png",
        meta: { system: 2, submit: true },
      },
    ]),
  },
  {
    key: "sam_backend",
    displayName: "Sam Okonkwo",
    emailLocalPart: "sam.okonkwo+helios-demo",
    roleHint: "backend",
    expectedInRegion: "backend",
    verification_score: 87,
    strengths: ["idempotent-writes", "postgres-indexing", "api-contracts"],
    friction_patterns: ["n-plus-one-queries"],
    preferred_modalities: ["tool", "screen"],
    powEvents: powBundle([
      {
        tool: "postgres-explain",
        action: "rewrite-join",
        file: "usage_rollup_join_plan.json",
      },
      {
        type: "screen",
        tool: "grpc-reflection",
        action: "contract-test-fail",
        file: "contract_diff_screen.png",
        mime: "image/png",
      },
      {
        tool: "redis-cli",
        action: "ttl-audit",
        file: "session_cache_ttls.json",
      },
      {
        tool: "temporal-ui",
        action: "replay-failed-activity",
        file: "webhook_delivery_replay.json",
      },
      {
        tool: "datadog-apm",
        action: "span-tag-review",
        file: "tenant_id_span_tags.json",
        meta: { system: 2 },
      },
    ]),
  },
  {
    key: "jordan_frontend",
    displayName: "Jordan Lee",
    emailLocalPart: "jordan.lee+helios-demo",
    roleHint: "frontend",
    expectedInRegion: "frontend",
    verification_score: 89,
    strengths: ["react-composition", "design-tokens", "a11y-audit", "bundle-budget"],
    friction_patterns: ["layout-thrash"],
    preferred_modalities: ["screen", "tool"],
    powEvents: powBundle([
      {
        type: "screen",
        tool: "chrome-devtools",
        action: "paint-profile",
        file: "billing_table_paint.png",
        mime: "image/png",
      },
      {
        tool: "storybook",
        action: "document-token-variants",
        file: "button_token_story.json",
      },
      {
        type: "screen",
        tool: "figma-inspect",
        action: "spacing-audit",
        file: "settings_drawer_spacing.png",
        mime: "image/png",
      },
      {
        tool: "lighthouse",
        action: "a11y-run",
        file: "settings_a11y_report.json",
        meta: { selective_thought: true },
      },
      {
        tool: "react-profiler",
        action: "rerender-hotspot",
        file: "filter_chip_profiler.json",
        meta: { submit: true, system: 2 },
      },
    ]),
  },
  {
    key: "riley_frontend",
    displayName: "Riley Park",
    emailLocalPart: "riley.park+helios-demo",
    roleHint: "frontend",
    expectedInRegion: "frontend",
    verification_score: 83,
    strengths: ["optimistic-ui", "react-composition", "design-tokens"],
    friction_patterns: ["prop-drilling"],
    preferred_modalities: ["screen", "tool", "speech"],
    powEvents: powBundle([
      {
        tool: "storybook",
        action: "interaction-test",
        file: "modal_focus_trap_story.json",
      },
      {
        type: "screen",
        tool: "chrome-devtools",
        action: "network-waterfall",
        file: "dashboard_waterfall.png",
        mime: "image/png",
      },
      {
        tool: "react-profiler",
        action: "memo-boundary",
        file: "list_virtualization.json",
      },
      {
        tool: "lighthouse",
        action: "perf-budget",
        file: "dashboard_lighthouse.json",
      },
      {
        type: "screen",
        tool: "figma-inspect",
        action: "token-diff",
        file: "dark_mode_tokens.png",
        mime: "image/png",
      },
    ]),
  },
  {
    key: "priya_sre",
    displayName: "Priya Nair",
    emailLocalPart: "priya.nair+helios-demo",
    roleHint: "sre",
    expectedInRegion: "sre",
    verification_score: 93,
    strengths: [
      "incident-command",
      "slo-error-budgets",
      "k8s-rollouts",
      "runbook-discipline",
    ],
    friction_patterns: ["alert-fatigue"],
    preferred_modalities: ["tool", "speech", "screen"],
    powEvents: powBundle([
      {
        tool: "pagerduty",
        action: "ack-and-page-secondary",
        file: "sev2_ack_timeline.json",
        meta: { selective_thought: true, system: 2 },
      },
      {
        type: "screen",
        tool: "grafana",
        action: "slo-burn-rate",
        file: "api_slo_burn.png",
        mime: "image/png",
      },
      {
        tool: "kubectl",
        action: "describe-rollout",
        file: "canary_pod_events.json",
      },
      {
        tool: "argo-rollouts",
        action: "promote-canary",
        file: "canary_analysis_result.json",
      },
      {
        tool: "incident-io",
        action: "write-postmortem-timeline",
        file: "sev2_timeline_draft.json",
        meta: { submit: true },
      },
    ]),
  },
  {
    key: "alex_fullstack",
    displayName: "Alex Rivera",
    emailLocalPart: "alex.rivera+helios-demo",
    roleHint: "fullstack",
    expectedInRegion: "fullstack",
    verification_score: 85,
    strengths: [
      "feature-flag-ship",
      "end-to-end-ownership",
      "product-metrics",
      "api-ui-contract",
    ],
    friction_patterns: ["context-switch-tax"],
    preferred_modalities: ["tool", "screen"],
    powEvents: powBundle([
      {
        tool: "linear",
        action: "slice-mvp-tickets",
        file: "usage_export_epic.json",
      },
      {
        tool: "prisma-studio",
        action: "verify-schema-shape",
        file: "export_job_model.json",
      },
      {
        type: "screen",
        tool: "vercel-preview",
        action: "qa-preview-deploy",
        file: "preview_export_ui.png",
        mime: "image/png",
      },
      {
        tool: "posthog",
        action: "funnel-check",
        file: "export_activation_funnel.json",
      },
      {
        tool: "mixpanel",
        action: "event-taxonomy",
        file: "export_events.json",
        meta: { system: 2, submit: true },
      },
    ]),
  },
  {
    key: "casey_offrole",
    displayName: "Casey Brooks",
    emailLocalPart: "casey.brooks+helios-demo",
    roleHint: "off_role",
    expectedInRegion: null,
    verification_score: 42,
    strengths: ["stakeholder-comms", "slide-storytelling"],
    friction_patterns: ["no-production-path", "tool-surface-thin"],
    preferred_modalities: ["screen"],
    powEvents: powBundle([
      {
        type: "screen",
        tool: "google-slides",
        action: "edit-qbr-deck",
        file: "qbr_overview.png",
        mime: "image/png",
        meta: { system: 1 },
      },
      {
        tool: "notion",
        action: "draft-roadmap-note",
        file: "roadmap_notes.json",
        meta: { system: 1 },
      },
      {
        type: "screen",
        tool: "figma-jam",
        action: "workshop-board",
        file: "discovery_workshop.png",
        mime: "image/png",
      },
      {
        tool: "gmail",
        action: "send-status-update",
        file: "weekly_status.json",
        meta: { system: 1, stash: true },
      },
    ]),
  },
  {
    key: "devon_mixed",
    displayName: "Devon Walsh",
    emailLocalPart: "devon.walsh+helios-demo",
    roleHint: "mixed",
    // Junior rotating through backend — not yet in-region for Backend bar.
    expectedInRegion: null,
    verification_score: 58,
    strengths: ["eager-notes", "shadowing"],
    friction_patterns: ["shallow-tooling", "guided-only"],
    preferred_modalities: ["screen", "tool"],
    powEvents: powBundle([
      {
        type: "screen",
        tool: "vscode",
        action: "read-service-readme",
        file: "readme_scroll.png",
        mime: "image/png",
        meta: { system: 1 },
      },
      {
        tool: "postgres-explain",
        action: "run-example-query",
        file: "tutorial_select.json",
        meta: { system: 1 },
      },
      {
        type: "screen",
        tool: "notion",
        action: "copy-onboarding-checklist",
        file: "onboarding_checklist.png",
        mime: "image/png",
      },
      {
        tool: "slack",
        action: "ask-for-help",
        file: "help_thread.json",
        meta: { system: 1 },
      },
    ]),
  },
];

/** Cohort region: pretends it was created from real user PoW (not synthetic Grok tag). */
export const DEMO_COHORT_REGION = {
  name: "Helios Core Backend Bar",
  description:
    "Cohort knowledge region created from Helios core backend engineers' proof-of-work " +
    "(Maya Chen, Sam Okonkwo). Distilled from their knowledge-config embeddings after " +
    "live tool/screen sessions on API contracts and query performance — not synthetic prompt generation.",
  /** Subject keys included in the cohort. */
  subjectKeys: ["maya_backend", "sam_backend"] as const,
};

export const DEMO_GUEST_EMAIL_DOMAIN = "demo.uncertain.systems";

export function demoGuestEmail(localPart: string): string {
  return `${localPart}@${DEMO_GUEST_EMAIL_DOMAIN}`;
}

export function roleRegionByKey(key: DemoRoleKey): DemoRoleDefinition {
  const found = DEMO_ROLE_REGIONS.find((r) => r.key === key);
  if (!found) throw new Error(`unknown role key: ${key}`);
  return found;
}

/**
 * Cosine floor for synthetic role regions in this demo.
 * Default synthetic softening (≤0.72) is too loose in knowledgecfg-v1-d64 —
 * off-role PoW still sits ~0.75–0.85 cosine to role centroids. 0.85 keeps
 * role-aligned subjects in-region while pushing off-role / junior subjects out.
 */
export const DEMO_ROLE_REGION_COSINE_THRESHOLD = 0.85;

/** Build a role region via the shipped synthetic profile → knowledgecfg path. */
export function buildRoleRegion(role: DemoRoleDefinition, workspaceId = "demo-workspace"): CustomVerificationModelSpec {
  const region = createSyntheticKnowledgeRegionFromProfile({
    name: role.regionName,
    profile: role.profile,
    description: role.description,
    workspaceId,
  });
  return {
    ...region,
    cosine_threshold: DEMO_ROLE_REGION_COSINE_THRESHOLD,
    // Keep synthetic subject label for role regions (product convention for prompt-generated regions).
    subjects: [{ label: "synthetic:grok-4.5" }],
  };
}

export function buildAllRoleRegions(workspaceId = "demo-workspace"): CustomVerificationModelSpec[] {
  return DEMO_ROLE_REGIONS.map((role) => buildRoleRegion(role, workspaceId));
}

export interface EncodedDemoSubject {
  subject: DemoSubjectDefinition;
  embedding: ReturnType<typeof encodeKnowledgeConfig>;
  vector: number[];
  powRows: PowFeatureRow[];
}

/**
 * Encode a subject from faked PoW (+ light LWM profile) through the real encoder.
 */
export function encodeDemoSubject(
  subject: DemoSubjectDefinition,
  options?: {
    workspaceId?: string;
    totalBlocks?: number;
    sessionStartMs?: number;
  },
): EncodedDemoSubject {
  const workspaceId = options?.workspaceId ?? "demo-workspace";
  const sessionStartMs = options?.sessionStartMs ?? 1_720_000_000_000;
  const totalBlocks = options?.totalBlocks ?? DEMO_BLOCKS.length;

  const powRows: PowFeatureRow[] = subject.powEvents.map((ev) => ({
    proof_of_work_type: ev.proof_of_work_type,
    timestamp_ms: sessionStartMs + ev.offset_ms,
    tool_name: ev.tool_name,
    tool_action: ev.tool_action,
    metadata: {
      ...ev.metadata,
      demo_marker: SAAS_TECH_DEMO_MARKER,
      subject_key: subject.key,
      role_hint: subject.roleHint,
      subject_kind: subject.isOwnerUser ? "owner_user" : "guest",
      is_owner_user: Boolean(subject.isOwnerUser),
    },
  }));

  const worldModel = mergeLearningWorldModelDelta(emptyLearningWorldModel(workspaceId), {
    scores_snapshot: {
      verification_score: subject.verification_score,
      augmentation_score: Math.max(0, subject.verification_score - 6),
      optimization_score: Math.max(0, subject.verification_score - 10),
      ghc_score: Math.round(subject.verification_score * 0.78),
    },
    learning_profile: {
      strengths: subject.strengths,
      friction_patterns: subject.friction_patterns,
      preferred_modalities: subject.preferred_modalities,
      temporal_patterns: { avg_dwell_ms: 5200, idle_bursts: 2 },
    },
    inferred_goal: {
      text: `${subject.displayName} demonstrating ${subject.roleHint} competency on Helios Cloud`,
      confidence: 0.75,
      source: "evolved",
    },
    exploration: {
      block_coverage: DEMO_BLOCKS.slice(0, Math.min(4, DEMO_BLOCKS.length)).map((b, i) => ({
        block_id: `block:${b.key}`,
        depth: (i === 0 ? "solid" : i < 3 ? "shallow" : "none") as "solid" | "shallow" | "none",
        evidence_refs: [`pow:${subject.key}:${i}`],
      })),
      pathways_touched: subject.strengths.slice(0, 3),
      blind_spots: subject.friction_patterns,
    },
  });

  const embedding = encodeKnowledgeConfig({
    workspaceId,
    powRows,
    worldModel,
    totalBlocks,
    asOfMs: sessionStartMs + Math.max(...subject.powEvents.map((e) => e.offset_ms), 0),
  });

  return {
    subject,
    embedding,
    vector: embedding.vector,
    powRows,
  };
}

export function encodeAllDemoSubjects(workspaceId = "demo-workspace"): EncodedDemoSubject[] {
  // Stagger session starts so trajectories don't collapse to one timestamp.
  return DEMO_SUBJECTS.map((s, i) =>
    encodeDemoSubject(s, {
      workspaceId,
      sessionStartMs: 1_720_000_000_000 + i * 86_400_000,
    }),
  );
}

/** Encode the workspace-owner auth subject (same encoder path as guests). */
export function encodeDemoOwnerSubject(
  workspaceId = "demo-workspace",
  options?: { sessionStartMs?: number },
): EncodedDemoSubject {
  return encodeDemoSubject(DEMO_OWNER_SUBJECT, {
    workspaceId,
    // After guest sessions so owner timeline sits as a distinct subject cloud.
    sessionStartMs: options?.sessionStartMs ?? 1_720_000_000_000 + DEMO_SUBJECTS.length * 86_400_000,
  });
}

/** Guests + owner for full multi-subject encode when needed in tests. */
export function encodeAllDemoSubjectsIncludingOwner(
  workspaceId = "demo-workspace",
): EncodedDemoSubject[] {
  return [...encodeAllDemoSubjects(workspaceId), encodeDemoOwnerSubject(workspaceId)];
}

/**
 * Build the cohort-style custom region from real subject vectors (user PoW path).
 * Description must not use the synthetic Grok tag; subjects point at real refs.
 */
export function buildCohortRegionFromSubjects(options: {
  name: string;
  description: string;
  encodedSubjects: EncodedDemoSubject[];
  subjectRefs: CustomVerificationSubjectRef[];
}): CustomVerificationModelSpec {
  if (options.encodedSubjects.length < 1) {
    throw new Error("cohort region requires at least one subject");
  }
  const vectors = options.encodedSubjects.map((s) => s.vector);
  const model = createCustomVerificationModelFromVectors({
    name: options.name,
    vectors,
    subjects: options.subjectRefs,
  });
  return {
    ...model,
    // Soften slightly for demo readability while remaining cohort-derived.
    cosine_threshold: Math.min(model.cosine_threshold, 0.78),
  };
}

export function buildDemoCohortRegion(
  encoded: EncodedDemoSubject[],
  resolveRef: (subjectKey: string) => CustomVerificationSubjectRef,
): CustomVerificationModelSpec {
  const members = DEMO_COHORT_REGION.subjectKeys.map((key) => {
    const found = encoded.find((e) => e.subject.key === key);
    if (!found) throw new Error(`missing cohort subject ${key}`);
    return found;
  });
  const refs = DEMO_COHORT_REGION.subjectKeys.map((key) => resolveRef(key));
  return buildCohortRegionFromSubjects({
    name: DEMO_COHORT_REGION.name,
    description: DEMO_COHORT_REGION.description,
    encodedSubjects: members,
    subjectRefs: refs,
  });
}

export interface MembershipRow {
  subjectKey: string;
  displayName: string;
  regionName: string;
  roleKey: DemoRoleKey;
  score: CustomVerificationScore;
}

/** Score every subject against every role region using the shipped scorer. */
export function scoreSubjectsAgainstRoleRegions(
  encoded: EncodedDemoSubject[],
  regions: Array<{ roleKey: DemoRoleKey; model: CustomVerificationModelSpec }>,
): MembershipRow[] {
  const rows: MembershipRow[] = [];
  for (const sub of encoded) {
    for (const { roleKey, model } of regions) {
      rows.push({
        subjectKey: sub.subject.key,
        displayName: sub.subject.displayName,
        regionName: model.name,
        roleKey,
        score: scoreAgainstCustomVerificationModel(sub.vector, model),
      });
    }
  }
  return rows;
}

/**
 * Assert the demo design yields mixed membership: ≥1 in-region and ≥1 out-of-region
 * across role regions (typically aligned backend vs off-role / frontend).
 */
export function assertMixedRoleMembership(rows: MembershipRow[]): {
  inRegion: MembershipRow[];
  outOfRegion: MembershipRow[];
} {
  const inRegion = rows.filter((r) => r.score.in_region);
  const outOfRegion = rows.filter((r) => !r.score.in_region);
  if (inRegion.length < 1) {
    throw new Error("expected at least one in-region subject×role pair");
  }
  if (outOfRegion.length < 1) {
    throw new Error("expected at least one out-of-region subject×role pair");
  }
  return { inRegion, outOfRegion };
}

/** Pure self-check used by unit tests and seed summary. */
export function evaluateDemoMembershipGeometry(workspaceId = "demo-workspace"): {
  encoded: EncodedDemoSubject[];
  roleRegions: Array<{ roleKey: DemoRoleKey; model: CustomVerificationModelSpec }>;
  cohort: CustomVerificationModelSpec;
  membership: MembershipRow[];
  mixed: { inRegion: MembershipRow[]; outOfRegion: MembershipRow[] };
} {
  const encoded = encodeAllDemoSubjects(workspaceId);
  const roleRegions = DEMO_ROLE_REGIONS.map((role) => ({
    roleKey: role.key,
    model: buildRoleRegion(role, workspaceId),
  }));
  const cohort = buildDemoCohortRegion(encoded, (key) => {
    const s = encoded.find((e) => e.subject.key === key)!.subject;
    return { label: s.displayName, guest_user_id: null, user_id: null };
  });
  // Cohort must not carry synthetic tag
  const hasSynthetic = cohort.subjects.some(
    (s) => typeof s.label === "string" && s.label.includes("[synthetic:grok-4.5]"),
  );
  if (hasSynthetic) {
    throw new Error("cohort region must not use synthetic:grok-4.5 tag");
  }
  // Description check
  if (cohort.name !== DEMO_COHORT_REGION.name) {
    throw new Error("cohort name mismatch");
  }
  if (/\[synthetic:grok-4\.5\]/i.test(DEMO_COHORT_REGION.description)) {
    throw new Error("cohort description must not mention synthetic tag");
  }

  const membership = scoreSubjectsAgainstRoleRegions(encoded, roleRegions);
  const mixed = assertMixedRoleMembership(membership);

  return { encoded, roleRegions, cohort, membership, mixed };
}

/** Role centroid vector for a profile (for tests that compare spaces). */
export function roleProfileVector(role: DemoRoleDefinition, workspaceId = "demo-workspace"): number[] {
  return encodeSyntheticRegionProfile(role.profile, workspaceId);
}
