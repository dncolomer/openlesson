import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const DOCS_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

const sectionClass = "rounded-md border border-neutral-800 bg-neutral-950/75 p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass = "mt-3 overflow-x-auto rounded-md border border-neutral-800 bg-black/60 p-4 font-mono text-xs text-neutral-300 sm:text-sm";

type FieldSpec = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

type EndpointSpec = {
  id: string;
  method: string;
  path: string;
  scope: string;
  summary: string;
  status: string;
  pathParams?: FieldSpec[];
  queryParams?: FieldSpec[];
  requestBody?: FieldSpec[];
  requestExample?: string;
  responseBody?: FieldSpec[];
  responseExample?: string;
  notes?: string[];
};

const ENDPOINT_SPECS: EndpointSpec[] = [
  {
    id: "create-workspace",
    method: "POST",
    path: "/api/v3/pow/workspaces",
    scope: "workspaces:write",
    summary:
      "Not available. Programmatic workspace creation is disabled; create workspaces manually in the product UI at /workspace/new.",
    status: "403 Forbidden",
    responseBody: [
      { name: "error.code", type: "string", description: "forbidden" },
      {
        name: "error.message",
        type: "string",
        description:
          "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new.",
      },
    ],
    responseExample: `{
  "error": {
    "code": "forbidden",
    "message": "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new."
  }
}`,
    notes: [
      "Workspace creation is UI-only (blank, template, or files+goal at /workspace/new).",
      "MCP tool create_workspace is not offered and hard-fails with the same message if called.",
      "Use list_workspaces / get_workspace / get_learning_progress against UI-created workspace IDs.",
    ],
  },
  {
    id: "list-blocks",
    method: "GET",
    path: "/api/v3/pow/workspaces/{workspace_id}/blocks",
    scope: "workspaces:read",
    summary: "List assessable blocks in a workspace.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    responseBody: [
      { name: "blocks", type: "array", description: "All blocks for the workspace, ordered by created_at ascending." },
      { name: "blocks[].id", type: "uuid", description: "Block ID." },
      { name: "blocks[].title", type: "string", description: "Block title." },
      { name: "blocks[].description", type: "string", description: "Demonstration objective." },
      { name: "blocks[].is_start", type: "boolean", description: "Entry block flag." },
      { name: "blocks[].next_block_ids", type: "uuid[]", description: "Next block IDs." },
      { name: "blocks[].status", type: "string", description: "available | in_progress | completed" },
      { name: "blocks[].created_at", type: "ISO-8601", description: "Creation timestamp." },
    ],
    responseExample: `{
  "blocks": [
    {
      "id": "e57844a6-1b69-465c-9120-d0812d6339ae",
      "title": "Context & Procurement Tactics",
      "description": "Demonstrate knowledge of renewal cycles.",
      "is_start": true,
      "next_block_ids": ["b454f31a-3045-4c23-a60e-820b43d0e9ce"],
      "status": "available",
      "created_at": "2026-06-23T13:01:32.691293+00:00"
    }
  ]
}`,
    notes: ["404 workspace_not_found if the key cannot access the workspace."],
  },
  {
    id: "proof-of-work-schema",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/proof-of-work-schema",
    scope: "workspaces:read",
    summary:
      "Given workspace context (blocks, plan files on xAI, proof-of-work metadata) plus an evaluation definition, Grok returns a JSON Schema for the ideal tool proof-of-work payload.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "evaluation_mode", type: "string", description: "semantic | opaque. Defaults from workspace when omitted." },
      {
        name: "definition",
        type: "string",
        description: "Semantic mode: what to evaluate — rubric text, competency description, or eval spec.",
      },
      {
        name: "definition_ref",
        type: "string",
        description: "Opaque mode: opaque reference token (required with contract.event_verbs).",
      },
      {
        name: "contract",
        type: "object",
        description: "Opaque mode: event_verbs required; optional goal_tokens, required_event_fields, token_fields.",
      },
      { name: "block_id", type: "uuid", description: "Optional: scope schema design to one block." },
      {
        name: "integration_hints",
        type: "object",
        description: "Optional hints to tailor the schema: tool_name, partner_agent, event_verbs[], goals[].",
      },
      { name: "integration_hints.tool_name", type: "string", description: "Tool identifier (e.g. pumadoc, canvas)." },
      { name: "integration_hints.partner_agent", type: "string", description: "Partner agent name for context." },
      { name: "integration_hints.event_verbs", type: "string[]", description: "Actions your agent serializes (e.g. run_simulation, edit_field)." },
      { name: "integration_hints.goals", type: "string[]", description: "High-level goals to encode (e.g. simulation_completed)." },
    ],
    requestExample: `// Semantic
{
  "definition": "Evaluate whether the learner can articulate a crisp ICP with segment rationale",
  "integration_hints": {
    "tool_name": "pumadoc",
    "event_verbs": ["run_simulation", "edit_field"]
  }
}

// Opaque
{
  "evaluation_mode": "opaque",
  "definition_ref": "trace-audit-v3",
  "contract": {
    "event_verbs": ["enumerate", "fingerprint", "aggregate", "emit", "validate"]
  }
}`,
    responseBody: [
      { name: "schema", type: "object", description: "JSON Schema (draft-07 style) for the ideal tool proof-of-work payload inside the upload data field." },
      { name: "schema_name", type: "string", description: "Snake_case identifier, typically prefixed eval_input_." },
      { name: "rationale", type: "string", description: "Why these fields capture optimal eval signal for this workspace." },
      { name: "example_payload", type: "object", description: "Example JSON matching the schema conceptually." },
      { name: "recommended_mime_type", type: "string", description: "Usually application/json for tool proof of work." },
      { name: "recommended_proof_of_work_type", type: "string", description: "tool | screen | video | eeg" },
      { name: "required_fields", type: "string[]", description: "Top-level field names integrators should always include." },
      { name: "optional_fields", type: "string[]", description: "Enrichment fields (reflections, media refs, etc.)." },
      { name: "collection_guidance", type: "string", description: "When and how often to upload proof of work for this definition." },
      {
        name: "performance_report_contract",
        type: "object",
        description:
          "Formal contract for POST .../verification-score (and sibling augmentation-score / optimization-score): one primary score, workspace_goal, marker_scores (spider_radar), gap_analysis, next actions.",
      },
      { name: "workspace_id", type: "uuid", description: "Echo of path workspace_id." },
      { name: "block_id", type: "uuid | null", description: "Echo of request block_id." },
      { name: "definition", type: "string", description: "Echo of request definition (semantic)." },
      { name: "definition_ref", type: "string", description: "Echo of opaque definition_ref." },
      { name: "evaluation_mode", type: "string", description: "semantic | opaque" },
      { name: "privacy", type: "object", description: "Present for opaque responses." },
      { name: "workspace_summary", type: "object", description: "id, title, root_topic." },
      { name: "context_counts", type: "object", description: "blocks, tap_sessions, proof_of_work_artifacts, linked_sessions, workspace_files." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs used for generation (workspace JSON + plan files)." },
    ],
    responseExample: `{
  "schema": {
    "type": "object",
    "properties": {
      "events": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "verb": { "type": "string" },
            "timestamp_ms": { "type": "integer" },
            "payload": { "type": "object" }
          },
          "required": ["verb", "timestamp_ms"]
        }
      },
      "goals_achieved": { "type": "array", "items": { "type": "string" } },
      "learner_reflection": { "type": "string" }
    },
    "required": ["events"]
  },
  "schema_name": "eval_input_icp_clarity",
  "rationale": "Time-ordered events plus goals_achieved give performance analysis enough signal to assess ICP clarity without a fixed rubric.",
  "example_payload": {
    "events": [
      { "verb": "run_simulation", "timestamp_ms": 1710000000000, "payload": { "simulation_id": "icp-v1" } }
    ],
    "goals_achieved": ["simulation_completed"],
    "learner_reflection": "Segment B has stronger willingness-to-pay signals."
  },
  "recommended_mime_type": "application/json",
  "recommended_proof_of_work_type": "tool",
  "required_fields": ["events"],
  "optional_fields": ["goals_achieved", "learner_reflection"],
  "collection_guidance": "Upload after each simulation run or when the learner publishes an ICP artifact.",
  "workspace_id": "a3090aa0-3498-4be8-aa87-32a1a6591641",
  "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae",
  "definition": "Evaluate whether the learner can articulate a crisp ICP...",
  "workspace_summary": {
    "id": "a3090aa0-3498-4be8-aa87-32a1a6591641",
    "title": "Customer Development Mastery",
    "root_topic": "Founder ICP validation"
  },
  "context_counts": {
    "blocks": 5,
    "tap_sessions": 0,
    "proof_of_work_artifacts": 0,
    "linked_sessions": 0,
    "workspace_files": 2
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "Semantic: definition required. Opaque: definition_ref + contract.event_verbs required.",
      "Use before POST .../proof-of-work when you want a concrete JSON contract for what your agent should serialize.",
      "Builds the same workspace context bundle as performance (JSON summary + up to 19 xAI artifact refs).",
      "404 block_not_found if block_id is not in this workspace.",
      "Grok-generated (semantic); opaque specs are structural and deterministic.",
    ],
  },
  {
    id: "integration-skill",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/integration-skill",
    scope: "workspaces:read",
    summary:
      "Generate a workspace-specific skill.md integration guide via POST .../integration-skill for a custom partner agent.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "integration_name", type: "string", required: true, description: "Partner integration slug or display name (e.g. acme-sales-copilot)." },
      { name: "partner_description", type: "string", description: "What the external agent does; Grok uses this to tailor examples." },
      { name: "block_id", type: "uuid", description: "Optional: focus the skill on one block." },
      { name: "base_url", type: "string", description: "Origin for example URLs; default https://uncertain.systems." },
      {
        name: "include_sections",
        type: "string[]",
        description: "Sections to include. Default: purpose, design_principles, auth, endpoints, proof_of_work_payload, performance, checklist.",
      },
    ],
    requestExample: `{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls and objection handling",
  "base_url": "https://uncertain.systems",
  "include_sections": ["purpose", "auth", "endpoints", "proof_of_work_payload", "performance", "checklist"]
}`,
    responseBody: [
      { name: "skill_md", type: "string", description: "Full markdown document with YAML frontmatter (name, description)." },
      { name: "skill_name", type: "string", description: "Derived frontmatter name, e.g. acme-sales-copilot-uncertain-systems-proof-of-work-performance." },
      { name: "suggested_share_path", type: "string", description: "Suggested public path, e.g. /acme-sales-copilot-skill.md." },
      { name: "workspace_summary", type: "object", description: "id, title, root_topic, block_count." },
      { name: "context_counts", type: "object | null", description: "Workspace context counts used during generation." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs attached during generation." },
    ],
    responseExample: `{
  "skill_md": "---\\nname: acme-sales-copilot-uncertain-systems-proof-of-work-performance\\ndescription: Acme Sales Copilot integration skill for Uncertain Systems proof-of-work upload and performance analysis.\\n---\\n\\n# Acme Sales Copilot — Uncertain Systems Proof-of-Work & Performance\\n\\n...",
  "skill_name": "acme-sales-copilot-uncertain-systems-proof-of-work-performance",
  "suggested_share_path": "/acme-sales-copilot-skill.md",
  "workspace_summary": {
    "id": "a3090aa0-3498-4be8-aa87-32a1a6591641",
    "title": "Discovery Mastery",
    "root_topic": "B2B sales discovery",
    "block_count": 5
  },
  "context_counts": {
    "blocks": 5,
    "tap_sessions": 0,
    "proof_of_work_artifacts": 0,
    "linked_sessions": 0,
    "workspace_files": 1
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "Host skill_md at suggested_share_path or inject directly into your agent's skill system.",
      "References canonical /skill.md and /docs/proof-of-work-api; includes workspace-specific block mapping and payload examples.",
      "404 block_not_found if block_id is not in this workspace.",
      "Grok-generated markdown; may take up to ~120s.",
    ],
  },
  {
    id: "upload-proof-of-work",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/proof-of-work",
    scope: "workspaces:write",
    summary: "Upload tool usage, screenshots, video, or EEG to xAI Files and link to workspace/block/session.",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "type", type: "string", required: true, description: "tool | screen | screenshot | video | eeg (screenshot aliases to screen)." },
      { name: "mime_type", type: "string", required: true, description: "Must match type (see MIME table below)." },
      { name: "data", type: "string (base64)", required: true, description: "Artifact bytes, max 10 MB." },
      { name: "file_name", type: "string", description: "Optional filename; default derived from type." },
      { name: "block_id", type: "uuid", description: "Optional block to scope proof of work." },
      { name: "session_id", type: "uuid", description: "Optional linked session ID." },
      { name: "timestamp_ms", type: "integer", description: "Client timestamp; defaults to server time." },
      { name: "chunk_index", type: "integer", description: "Chunk sequence for streaming artifacts; default 0." },
      { name: "metadata", type: "object", description: "Arbitrary JSON metadata stored on the proof of work row." },
      { name: "tool_name", type: "string", description: "For type=tool: tool identifier (e.g. canvas, pumadoc)." },
      { name: "tool_action", type: "string", description: "For type=tool: action name (e.g. draw, step_completed)." },
      { name: "band_powers", type: "object", description: "For type=eeg: band power map (numeric values)." },
      { name: "device_name", type: "string", description: "For type=eeg: device label (e.g. Muse)." },
      { name: "sample_count", type: "integer", description: "For type=eeg: sample count in chunk." },
    ],
    requestExample: `{
  "type": "tool",
  "file_name": "renewal-workbench-trace.json",
  "mime_type": "application/json",
  "data": "<base64>",
  "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae",
  "metadata": { "source": "pumadoc-customer-agent" },
  "tool_name": "renewal-workbench",
  "tool_action": "session_trace"
}`,
    responseBody: [
      { name: "proof_of_work.id", type: "uuid", description: "workspace_proof_of_work.id" },
      { name: "proof_of_work.workspace_id", type: "uuid", description: "Same as workspace_id." },
      { name: "proof_of_work.block_id", type: "uuid | null", description: "block_id if scoped." },
      { name: "proof_of_work.session_id", type: "uuid | null", description: "Optional session link." },
      { name: "proof_of_work.type", type: "string", description: "tool | screen | video | eeg" },
      { name: "proof_of_work.file_name", type: "string", description: "Stored filename." },
      { name: "proof_of_work.mime_type", type: "string", description: "MIME type." },
      { name: "proof_of_work.file_size", type: "integer", description: "Decoded byte length." },
      { name: "proof_of_work.xai_file_id", type: "string", description: "xAI Files API file_id." },
      { name: "proof_of_work.timestamp_ms", type: "integer", description: "Client or server timestamp." },
      { name: "proof_of_work.chunk_index", type: "integer", description: "Chunk index." },
      { name: "proof_of_work.metadata", type: "object", description: "Stored metadata JSON." },
      { name: "proof_of_work.tool_name", type: "string | null", description: "Tool name when type=tool." },
      { name: "proof_of_work.tool_action", type: "string | null", description: "Tool action when type=tool." },
      { name: "proof_of_work.device_name", type: "string | null", description: "EEG device when type=eeg." },
      { name: "proof_of_work.sample_count", type: "integer | null", description: "EEG samples when type=eeg." },
      { name: "proof_of_work.created_at", type: "ISO-8601", description: "Upload timestamp." },
    ],
    responseExample: `{
  "proof_of_work": {
    "id": "3d2a15c4-3e21-4e11-bf9c-c007ef0c82b4",
    "workspace_id": "a3090aa0-3498-4be8-aa87-32a1a6591641",
    "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae",
    "session_id": null,
    "type": "tool",
    "file_name": "renewal-workbench-trace.json",
    "mime_type": "application/json",
    "file_size": 992,
    "xai_file_id": "file_9f395df1-ecfd-4587-87fd-4f2e8d3cea3d",
    "timestamp_ms": 1782219694763,
    "chunk_index": 0,
    "metadata": { "source": "pumadoc-customer-agent" },
    "tool_name": "renewal-workbench",
    "tool_action": "session_trace",
    "device_name": null,
    "sample_count": null,
    "created_at": "2026-06-23T13:01:34.791176+00:00"
  }
}`,
    notes: [
      "MIME by type: tool → application/json, text/plain, text/markdown; screen → image/png, image/jpeg, image/webp; video → video/mp4, video/webm, video/quicktime; eeg → application/json, text/plain.",
      "Opaque: metadata allowlist (trace_token, goal_ref, anon, event_count, schema_version, protocol_id, phase_id, allow_plaintext). Tool payloads plaintext-linted unless allow_plaintext=true.",
      "404 block_not_found if block_id is not in this workspace.",
    ],
  },
  {
    id: "verification-score",
    method: "POST",
    path: "/api/v3/eval/workspaces/{workspace_id}/verification-score",
    scope: "workspaces:read",
    summary: 'Learning verification score (0–100) + spider markers, analysis, and next actions. TAP auto-results use this only.',
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional: scope analysis to one block." },
      { name: "style_prompt", type: "string", description: "Optional voice/tone for narrative fields." },
      { name: "file_ids", type: "string[]", description: "Optional xAI file IDs from a prior score call. Empty → rebuild context bundle." },
    ],
    requestExample: `{ "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae" }`,
    responseBody: [
      { name: "mode", type: '"score"', description: "Always score for this endpoint." },
      { name: "vertical", type: "string", description: "verification | augmentation | optimization" },
      { name: "evaluation_mode", type: "string", description: "semantic | opaque" },
      { name: "privacy", type: "object", description: "Opaque workspaces: semantic_inference, plaintext_lint, stored_prompt." },
      { name: "protocol_report", type: "object", description: "Opaque: protocol_compliance_score, phase_coverage, trace_integrity, structural_gaps." },
      { name: "workspace_goal", type: "string", description: "Inferred or owner-set workspace goal." },
      { name: "workspace_goal_source", type: "string", description: "workspace | inferred | opaque_ref" },
      { name: "report", type: "object", description: "Vertical score report payload." },
      { name: "report.score", type: "integer", description: "0–100 primary score for this vertical." },
      { name: "report.vertical", type: "string", description: "Matches the endpoint vertical." },
      { name: "report.workspace_goal", type: "string", description: "Same as top-level workspace_goal when finalized." },
      {
        name: "report.marker_scores",
        type: "array",
        description: "Spider/radar competency axes: id, label, score (0–100), rationale, optional block_id.",
      },
      { name: "report.summary", type: "string", description: "Executive analysis." },
      { name: "report.strengths", type: "string[]", description: "Demonstrated strengths." },
      { name: "report.growth_areas", type: "string[]", description: "Areas needing development." },
      { name: "report.gap_analysis.summary", type: "string", description: "Gap analysis overview." },
      { name: "report.gap_analysis.gaps", type: "array", description: "title, proof_of_work, severity (low|medium|high), suggested_repair." },
      { name: "report.gap_analysis.next_steps", type: "object", description: "directions (string[]) and events (string[]) for domain next actions." },
      { name: "report.suggestions", type: "string[]", description: "Additional recommendations." },
      { name: "report.confidence", type: "string", description: "emerging | developing | clear | well-connected" },
      { name: "proof_of_work_summary", type: "object | null", description: "Counts used in context." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs for follow-up calls." },
    ],
    responseExample: `{
  "mode": "score",
  "vertical": "verification",
  "workspace_goal": "Trial-to-paid subscription activation",
  "workspace_goal_source": "workspace",
  "report": {
    "vertical": "verification",
    "score": 68,
    "verification_score": 68,
    "workspace_goal": "Trial-to-paid subscription activation",
    "marker_scores": [
      {
        "id": "negotiation_prep",
        "label": "Negotiation Preparation",
        "score": 74,
        "rationale": "Used CRM and ROI table before price discussion."
      }
    ],
    "summary": "Learner prepared for renewal negotiation using simulated tool traces.",
    "strengths": ["Used CRM and ROI table before price discussion"],
    "growth_areas": ["Did not quantify churn risk"],
    "gap_analysis": {
      "summary": "Missing churn risk quantification.",
      "gaps": [
        {
          "title": "Missing churn risk quantification",
          "proof_of_work": "Reflection states churn risk was not modeled.",
          "severity": "medium",
          "suggested_repair": "Add probability-weighted revenue loss to ROI table."
        }
      ],
      "next_steps": {
        "directions": ["Build a repeatable churn model habit before pricing talks"],
        "events": ["Run 3 simulated procurement scenarios with churn math"]
      }
    },
    "suggestions": ["Practice live role-play with procurement pushback"],
    "confidence": "emerging"
  },
  "proof_of_work_summary": {
    "blocks": 1,
    "proof_of_work_artifacts": 2,
    "linked_sessions": 0,
    "workspace_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "One primary score per call — not a multi-vertical unified scorecard.",
      "First call with empty file_ids uploads a workspace performance JSON summary + up to 19 artifact files to xAI.",
      "If no proof of work exists, returns 200 with an empty-data score template.",
    ],
  },
  {
    id: "augmentation-score",
    method: "POST",
    path: "/api/v3/eval/workspaces/{workspace_id}/augmentation-score",
    scope: "workspaces:read",
    summary: 'Learning augmentation / practice-readiness score (0–100) + spider markers, analysis, and next actions.',
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional: scope analysis to one block." },
      { name: "style_prompt", type: "string", description: "Optional voice/tone for narrative fields." },
      { name: "file_ids", type: "string[]", description: "Optional xAI file IDs from a prior score call. Empty → rebuild context bundle." },
    ],
    requestExample: `{ "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae" }`,
    responseBody: [
      { name: "mode", type: '"score"', description: "Always score for this endpoint." },
      { name: "vertical", type: "string", description: "verification | augmentation | optimization" },
      { name: "evaluation_mode", type: "string", description: "semantic | opaque" },
      { name: "privacy", type: "object", description: "Opaque workspaces: semantic_inference, plaintext_lint, stored_prompt." },
      { name: "protocol_report", type: "object", description: "Opaque: protocol_compliance_score, phase_coverage, trace_integrity, structural_gaps." },
      { name: "workspace_goal", type: "string", description: "Inferred or owner-set workspace goal." },
      { name: "workspace_goal_source", type: "string", description: "workspace | inferred | opaque_ref" },
      { name: "report", type: "object", description: "Vertical score report payload." },
      { name: "report.score", type: "integer", description: "0–100 primary score for this vertical." },
      { name: "report.vertical", type: "string", description: "Matches the endpoint vertical." },
      { name: "report.workspace_goal", type: "string", description: "Same as top-level workspace_goal when finalized." },
      {
        name: "report.marker_scores",
        type: "array",
        description: "Spider/radar competency axes: id, label, score (0–100), rationale, optional block_id.",
      },
      { name: "report.summary", type: "string", description: "Executive analysis." },
      { name: "report.strengths", type: "string[]", description: "Demonstrated strengths." },
      { name: "report.growth_areas", type: "string[]", description: "Areas needing development." },
      { name: "report.gap_analysis.summary", type: "string", description: "Gap analysis overview." },
      { name: "report.gap_analysis.gaps", type: "array", description: "title, proof_of_work, severity (low|medium|high), suggested_repair." },
      { name: "report.gap_analysis.next_steps", type: "object", description: "directions (string[]) and events (string[]) for domain next actions." },
      { name: "report.suggestions", type: "string[]", description: "Additional recommendations." },
      { name: "report.confidence", type: "string", description: "emerging | developing | clear | well-connected" },
      { name: "proof_of_work_summary", type: "object | null", description: "Counts used in context." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs for follow-up calls." },
    ],
    responseExample: `{
  "mode": "score",
  "vertical": "augmentation",
  "workspace_goal": "Trial-to-paid subscription activation",
  "workspace_goal_source": "workspace",
  "report": {
    "vertical": "augmentation",
    "score": 68,
    "augmentation_score": 68,
    "workspace_goal": "Trial-to-paid subscription activation",
    "marker_scores": [
      {
        "id": "negotiation_prep",
        "label": "Negotiation Preparation",
        "score": 74,
        "rationale": "Used CRM and ROI table before price discussion."
      }
    ],
    "summary": "Learner prepared for renewal negotiation using simulated tool traces.",
    "strengths": ["Used CRM and ROI table before price discussion"],
    "growth_areas": ["Did not quantify churn risk"],
    "gap_analysis": {
      "summary": "Missing churn risk quantification.",
      "gaps": [
        {
          "title": "Missing churn risk quantification",
          "proof_of_work": "Reflection states churn risk was not modeled.",
          "severity": "medium",
          "suggested_repair": "Add probability-weighted revenue loss to ROI table."
        }
      ],
      "next_steps": {
        "directions": ["Build a repeatable churn model habit before pricing talks"],
        "events": ["Run 3 simulated procurement scenarios with churn math"]
      }
    },
    "suggestions": ["Practice live role-play with procurement pushback"],
    "confidence": "emerging"
  },
  "proof_of_work_summary": {
    "blocks": 1,
    "proof_of_work_artifacts": 2,
    "linked_sessions": 0,
    "workspace_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "One primary score per call — not a multi-vertical unified scorecard.",
      "First call with empty file_ids uploads a workspace performance JSON summary + up to 19 artifact files to xAI.",
      "If no proof of work exists, returns 200 with an empty-data score template.",
    ],
  },
  {
    id: "optimization-score",
    method: "POST",
    path: "/api/v3/eval/workspaces/{workspace_id}/optimization-score",
    scope: "workspaces:read",
    summary: 'Learning optimization score toward workspace_goal (0–100) + spider markers, analysis, and next actions.',
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional: scope analysis to one block." },
      { name: "style_prompt", type: "string", description: "Optional voice/tone for narrative fields." },
      { name: "file_ids", type: "string[]", description: "Optional xAI file IDs from a prior score call. Empty → rebuild context bundle." },
    ],
    requestExample: `{ "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae" }`,
    responseBody: [
      { name: "mode", type: '"score"', description: "Always score for this endpoint." },
      { name: "vertical", type: "string", description: "verification | augmentation | optimization" },
      { name: "evaluation_mode", type: "string", description: "semantic | opaque" },
      { name: "privacy", type: "object", description: "Opaque workspaces: semantic_inference, plaintext_lint, stored_prompt." },
      { name: "protocol_report", type: "object", description: "Opaque: protocol_compliance_score, phase_coverage, trace_integrity, structural_gaps." },
      { name: "workspace_goal", type: "string", description: "Inferred or owner-set workspace goal." },
      { name: "workspace_goal_source", type: "string", description: "workspace | inferred | opaque_ref" },
      { name: "report", type: "object", description: "Vertical score report payload." },
      { name: "report.score", type: "integer", description: "0–100 primary score for this vertical." },
      { name: "report.vertical", type: "string", description: "Matches the endpoint vertical." },
      { name: "report.workspace_goal", type: "string", description: "Same as top-level workspace_goal when finalized." },
      {
        name: "report.marker_scores",
        type: "array",
        description: "Spider/radar competency axes: id, label, score (0–100), rationale, optional block_id.",
      },
      { name: "report.summary", type: "string", description: "Executive analysis." },
      { name: "report.strengths", type: "string[]", description: "Demonstrated strengths." },
      { name: "report.growth_areas", type: "string[]", description: "Areas needing development." },
      { name: "report.gap_analysis.summary", type: "string", description: "Gap analysis overview." },
      { name: "report.gap_analysis.gaps", type: "array", description: "title, proof_of_work, severity (low|medium|high), suggested_repair." },
      { name: "report.gap_analysis.next_steps", type: "object", description: "directions (string[]) and events (string[]) for domain next actions." },
      { name: "report.suggestions", type: "string[]", description: "Additional recommendations." },
      { name: "report.confidence", type: "string", description: "emerging | developing | clear | well-connected" },
      { name: "proof_of_work_summary", type: "object | null", description: "Counts used in context." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs for follow-up calls." },
    ],
    responseExample: `{
  "mode": "score",
  "vertical": "optimization",
  "workspace_goal": "Trial-to-paid subscription activation",
  "workspace_goal_source": "workspace",
  "report": {
    "vertical": "optimization",
    "score": 68,
    "optimization_score": 68,
    "workspace_goal": "Trial-to-paid subscription activation",
    "marker_scores": [
      {
        "id": "negotiation_prep",
        "label": "Negotiation Preparation",
        "score": 74,
        "rationale": "Used CRM and ROI table before price discussion."
      }
    ],
    "summary": "Learner prepared for renewal negotiation using simulated tool traces.",
    "strengths": ["Used CRM and ROI table before price discussion"],
    "growth_areas": ["Did not quantify churn risk"],
    "gap_analysis": {
      "summary": "Missing churn risk quantification.",
      "gaps": [
        {
          "title": "Missing churn risk quantification",
          "proof_of_work": "Reflection states churn risk was not modeled.",
          "severity": "medium",
          "suggested_repair": "Add probability-weighted revenue loss to ROI table."
        }
      ],
      "next_steps": {
        "directions": ["Build a repeatable churn model habit before pricing talks"],
        "events": ["Run 3 simulated procurement scenarios with churn math"]
      }
    },
    "suggestions": ["Practice live role-play with procurement pushback"],
    "confidence": "emerging"
  },
  "proof_of_work_summary": {
    "blocks": 1,
    "proof_of_work_artifacts": 2,
    "linked_sessions": 0,
    "workspace_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "One primary score per call — not a multi-vertical unified scorecard.",
      "First call with empty file_ids uploads a workspace performance JSON summary + up to 19 artifact files to xAI.",
      "If no proof of work exists, returns 200 with an empty-data score template.",
    ],
  },
  {
    id: "create-tap-link",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/tap-links",
    scope: "tap:write",
    summary: "Create a private Think Aloud Protocol (TAP) link for the workspace (or a block via body/path).",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional. When set, scopes the TAP session to that block. Omit for full-workspace scope." },
      { name: "minutes", type: "integer", description: "1–120; default 15." },
      { name: "guest_user_id", type: "uuid", description: "Org admin only: assign link to a guest by ID." },
      { name: "guest_email", type: "string", description: "Org admin only: assign link to a guest by email." },
      { name: "participant_type", type: "string", description: "anonymous | guest | user." },
      { name: "user_id", type: "uuid", description: "Member user id when participant_type=user." },
      { name: "post_session", type: "string", description: "redirect_workspace | show_results | redirect_url." },
      { name: "redirect_url", type: "string", description: "Required when post_session=redirect_url." },
    ],
    requestExample: `{
  "minutes": 15,
  "participant_type": "anonymous"
}`,
    responseBody: [
      { name: "tap_link.id", type: "uuid", description: "TAP link / session row ID." },
      { name: "tap_link.workspace_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_link.block_id", type: "uuid | null", description: "Block ID when scoped; null for full workspace." },
      { name: "tap_link.status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_link.requested_duration_seconds", type: "integer", description: "Requested duration in seconds." },
      { name: "tap_link.focus_block_ids", type: "uuid[]", description: "Focused block IDs (empty = full workspace)." },
      { name: "tap_link.created_at", type: "ISO-8601", description: "Link creation time." },
      { name: "tap_link.private_url", type: "string", description: "Bearer URL: /tap/session/{token}. No login required." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption (see Predictive interruptions)." },
    ],
    responseExample: `{
  "tap_link": {
    "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
    "workspace_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
    "block_id": null,
    "status": "pending",
    "requested_duration_seconds": 900,
    "focus_block_ids": [],
    "created_at": "2026-06-23T01:29:03.861663+00:00",
    "private_url": "https://uncertain.systems/tap/session/E8-ouJ9lErgDEmteyKc4tJ39meJ91vzZFNUiuRauHvw"
  }
}`,
    notes: [
      "Also available as POST .../blocks/{block_id}/tap-links for block-scoped links (same body fields).",
      "Guest keys auto-attach the link to their guest identity.",
      "Org admins may set guest_user_id or guest_email to assign the link (404 guest_not_found if missing).",
      "Learner completes session at private_url without an API key.",
    ],
  },
  {
    id: "list-tap-links",
    method: "GET",
    path: "/api/v3/pow/workspaces/{workspace_id}/tap-links",
    scope: "tap:read",
    summary: "List TAP links for a workspace (filtered by caller role).",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    responseBody: [
      { name: "tap_links", type: "array", description: "Sessions ordered by created_at descending." },
      { name: "tap_links[].id", type: "uuid", description: "Link ID." },
      { name: "tap_links[].workspace_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_links[].block_id", type: "uuid | null", description: "Block ID when scoped; null for full workspace." },
      { name: "tap_links[].status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_links[].requested_duration_seconds", type: "integer", description: "Requested duration." },
      { name: "tap_links[].duration_seconds", type: "integer", description: "Actual duration (0 until completed)." },
      { name: "tap_links[].focus_block_ids", type: "uuid[]", description: "Focused blocks." },
      { name: "tap_links[].verification_score", type: "integer | null", description: "Score when completed." },
      { name: "tap_links[].created_at", type: "ISO-8601", description: "Created at." },
      { name: "tap_links[].started_at", type: "ISO-8601 | null", description: "Started at." },
      { name: "tap_links[].completed_at", type: "ISO-8601 | null", description: "Completed at." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption." },
    ],
    responseExample: `{
  "tap_links": [
    {
      "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
      "workspace_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
      "block_id": "88a43ad8-62f8-4252-a847-2cbc0b754a57",
      "status": "completed",
      "requested_duration_seconds": 900,
      "duration_seconds": 120,
      "focus_block_ids": ["88a43ad8-62f8-4252-a847-2cbc0b754a57"],
      "verification_score": 72,
      "created_at": "2026-06-23T01:29:03.861663+00:00",
      "started_at": "2026-06-23T01:30:00+00:00",
      "completed_at": "2026-06-23T01:32:21.492+00:00"
    }
  ]
}`,
    notes: [
      "Guests see only their own links.",
      "Non-admin members see only links they created.",
      "Org admins see all links on org workspaces.",

    ],
  },
  {
    id: "create-guest",
    method: "POST",
    path: "/api/v3/pow/org/guests",
    scope: "org:write",
    summary: "Create or look up a guest by email and issue a new guest API key (gsk_).",
    status: "201 Created (new guest) or 200 OK (existing guest)",
    requestBody: [
      { name: "email", type: "string", required: true, description: "Guest email address (normalized to lowercase)." },
    ],
    requestExample: `{ "email": "learner@example.com" }`,
    responseBody: [
      { name: "guest_user.id", type: "uuid", description: "organization_guest_users.id" },
      { name: "guest_user.organization_id", type: "uuid", description: "Org the guest belongs to." },
      { name: "guest_user.email", type: "string", description: "Guest email." },
      { name: "guest_user.status", type: "string", description: "active | claimed | revoked" },
      { name: "guest_user.claimed_by_user_id", type: "uuid | null", description: "Set when guest signs up with same email." },
      { name: "guest_user.claimed_at", type: "ISO-8601 | null", description: "Claim timestamp." },
      { name: "guest_user.created_at", type: "ISO-8601", description: "Guest record created at." },
      { name: "api_key", type: "string", description: "Raw gsk_ key — shown once; store securely." },
      { name: "key.id", type: "uuid", description: "agent_api_keys.id" },
      { name: "key.key_prefix", type: "string", description: "First 13 chars of key for identification." },
      { name: "key.scopes", type: "string[]", description: "workspaces:read, workspaces:write, tap:read, tap:write" },
      { name: "key.rate_limit", type: "integer", description: "Requests per minute (default 120)." },
      { name: "key.created_at", type: "ISO-8601", description: "Key creation time." },
    ],
    responseExample: `{
  "guest_user": {
    "id": "f8b2c1d0-1234-5678-9abc-def012345678",
    "organization_id": "64cc093b-31c1-4a7e-aead-e2e9378ecaf4",
    "email": "learner@example.com",
    "status": "active",
    "claimed_by_user_id": null,
    "claimed_at": null,
    "created_at": "2026-06-23T13:00:00+00:00"
  },
  "api_key": "gsk_a1b2c3d4e5f6789012345678abcdef",
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "key_prefix": "gsk_a1b2c3d4",
    "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
    "rate_limit": 120,
    "created_at": "2026-06-23T13:00:01+00:00"
  }
}`,
    notes: [
      "Caller must be organization admin with org:write on their sk_ key.",
      "Re-calling for the same email mints another key; prior keys may remain active.",
      "409 if email belongs to a real user in another organization.",
    ],
  },
  {
    id: "list-keys",
    method: "GET",
    path: "/api/v3/pow/keys",
    scope: "browser session",
    summary: "List API keys for the signed-in dashboard user. Uses Supabase session cookies — not Bearer API key auth.",
    status: "200 OK",
    responseBody: [
      { name: "keys", type: "array", description: "All agent_api_keys for the authenticated user, newest first." },
      { name: "keys[].id", type: "uuid", description: "Key ID." },
      { name: "keys[].label", type: "string | null", description: "Optional label set at creation." },
      { name: "keys[].key_prefix", type: "string", description: "First 12 characters of sk_ key (identification only)." },
      { name: "keys[].scopes", type: "string[]", description: "Assigned scopes." },
      { name: "keys[].rate_limit", type: "integer", description: "Requests per minute (default 120)." },
      { name: "keys[].is_active", type: "boolean", description: "False after revocation." },
      { name: "keys[].created_at", type: "ISO-8601", description: "Creation timestamp." },
      { name: "keys[].last_used_at", type: "ISO-8601 | null", description: "Last successful API call." },
      { name: "keys[].expires_at", type: "ISO-8601 | null", description: "Expiry if set at creation." },
    ],
    responseExample: `{
  "keys": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "label": "Production agent",
      "key_prefix": "sk_a1b2c3d4e5",
      "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
      "rate_limit": 120,
      "is_active": true,
      "created_at": "2026-06-23T12:00:00+00:00",
      "last_used_at": "2026-06-23T13:05:00+00:00",
      "expires_at": null
    }
  ]
}`,
    notes: ["Also available from Dashboard → Usage & API. Max 10 active keys per user."],
  },
  {
    id: "create-key",
    method: "POST",
    path: "/api/v3/pow/keys",
    scope: "browser session",
    summary: "Create a new sk_ API key for the signed-in user. Raw key returned once.",
    status: "201 Created",
    requestBody: [
      { name: "label", type: "string", description: "Optional label, max 128 characters." },
      {
        name: "scopes",
        type: "string[]",
        description: "Optional. Default: workspaces:read, workspaces:write, tap:read, tap:write. org:read/org:write require org admin.",
      },
      { name: "expires_in_days", type: "integer", description: "Optional expiry: 1–365 days." },
    ],
    requestExample: `{
  "label": "CI pipeline",
  "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write", "org:write"],
  "expires_in_days": 90
}`,
    responseBody: [
      { name: "key.id", type: "uuid", description: "agent_api_keys.id" },
      { name: "key.label", type: "string | null", description: "Label if provided." },
      { name: "key.key_prefix", type: "string", description: "First 12 chars of sk_ key." },
      { name: "key.scopes", type: "string[]", description: "Assigned scopes." },
      { name: "key.rate_limit", type: "integer", description: "Default 120." },
      { name: "key.created_at", type: "ISO-8601", description: "Creation time." },
      { name: "key.expires_at", type: "ISO-8601 | null", description: "Expiry if set." },
      { name: "api_key", type: "string", description: "Full sk_ key — shown once; store securely." },
    ],
    responseExample: `{
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "label": "CI pipeline",
    "key_prefix": "sk_a1b2c3d4e5",
    "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write", "org:write"],
    "rate_limit": 120,
    "created_at": "2026-06-23T12:00:00+00:00",
    "expires_at": "2026-09-21T12:00:00+00:00"
  },
  "api_key": "sk_7f3a9b2c1d4e5f6789012345678abcdef"
}`,
    notes: [
      "Requires Teams tier (403 teams_required).",
      "Valid scopes: *, workspaces:read, workspaces:write, tap:read, tap:write, org:read, org:write.",
      "403 if more than 10 active keys or if non-admin requests org scopes.",
    ],
  },
  {
    id: "revoke-key",
    method: "DELETE",
    path: "/api/v3/pow/keys/{key_id}",
    scope: "browser session",
    summary: "Revoke (soft-delete) an API key owned by the signed-in user.",
    status: "200 OK",
    pathParams: [
      { name: "key_id", type: "uuid", required: true, description: "agent_api_keys.id from list or create." },
    ],
    responseBody: [
      { name: "deleted", type: "boolean", description: "True on success." },
      { name: "key_id", type: "uuid", description: "Revoked key ID." },
    ],
    responseExample: `{
  "deleted": true,
  "key_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}`,
    notes: ["404 not_found if key does not belong to user. 400 if already revoked."],
  },
  {
    id: "update-key-scopes",
    method: "PATCH",
    path: "/api/v3/pow/keys/{key_id}/scopes",
    scope: "browser session",
    summary: "Replace scopes on an active API key.",
    status: "200 OK",
    pathParams: [
      { name: "key_id", type: "uuid", required: true, description: "agent_api_keys.id." },
    ],
    requestBody: [
      { name: "scopes", type: "string[]", required: true, description: "Non-empty array of valid scope strings." },
    ],
    requestExample: `{
  "scopes": ["workspaces:read", "tap:read"]
}`,
    responseBody: [
      { name: "key.id", type: "uuid", description: "Updated key ID." },
      { name: "key.scopes", type: "string[]", description: "New scope list." },
      { name: "key.updated_at", type: "ISO-8601", description: "Update timestamp." },
    ],
    responseExample: `{
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "scopes": ["workspaces:read", "tap:read"],
    "updated_at": "2026-06-23T13:10:00+00:00"
  }
}`,
    notes: ["Cannot update revoked keys. org:read/org:write require organization admin."],
  },
];

function FieldTable({ title, fields }: { title: string; fields: FieldSpec[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-neutral-300">{title}</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th className="py-2 pr-4 font-medium">Field</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Required</th>
              <th className="py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.name} className="border-b border-neutral-800/60 align-top">
                <td className="py-2 pr-4 font-mono text-neutral-200">{field.name}</td>
                <td className="py-2 pr-4 text-neutral-400">{field.type}</td>
                <td className="py-2 pr-4 text-neutral-500">{field.required ? "yes" : "—"}</td>
                <td className="py-2 text-neutral-400">{field.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointDoc({ spec }: { spec: EndpointSpec }) {
  return (
    <section id={spec.id} className={`${sectionClass} scroll-mt-24`}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-300">
          {spec.method}
        </span>
        <code className="break-all text-sm text-neutral-200">{spec.path}</code>
        <span className="rounded-sm border border-neutral-800 bg-black/40 px-2 py-1 font-mono text-[10px] text-neutral-500">
          {spec.scope}
        </span>
        <span className="rounded-sm border border-cyan-400/20 bg-cyan-950/20 px-2 py-1 font-mono text-[10px] text-cyan-200/90">
          {spec.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">{spec.summary}</p>

      {spec.pathParams && <FieldTable title="Path parameters" fields={spec.pathParams} />}
      {spec.queryParams && <FieldTable title="Query parameters" fields={spec.queryParams} />}
      {spec.requestBody && <FieldTable title="Request body (JSON)" fields={spec.requestBody} />}

      {spec.requestExample && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-300">Request example</h4>
          <pre className={codeBlockClass}>
            <code>{spec.requestExample}</code>
          </pre>
        </div>
      )}

      {spec.responseBody && <FieldTable title="Response body" fields={spec.responseBody} />}

      {spec.responseExample && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-300">Response example</h4>
          <pre className={codeBlockClass}>
            <code>{spec.responseExample}</code>
          </pre>
        </div>
      )}

      {spec.notes && spec.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-500">
          {spec.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AgenticV2DocsPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.88), rgba(10,10,10,0.92)), url(${DOCS_BACKGROUND})`,
      }}
    >
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className={`${sectionClass} mb-8`}>
          <p className={labelClass}>Uncertain Systems Proof-of-Work API</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Workspace API Reference
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Full request and response specifications for every Proof-of-Work API endpoint: workspaces, proof-of-work schema
            generation, integration skill generation, proof-of-work upload, performance analysis, TAP links, ILE practice, guest
            provisioning, and dashboard key management. Bearer endpoints use base path{" "}
            <code className="text-neutral-300">/api/v3/pow</code> and require active{" "}
            <code className="text-neutral-300">pro_teams</code>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/skill.md"
              className="inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Agent skill file →
            </Link>
            <Link
              href="/dashboard?tab=usage"
              className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
            >
              Get API key
            </Link>
          </div>
        </header>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Authentication</h2>
          <pre className={codeBlockClass}>
            <code>{`Authorization: Bearer <api_key>
Content-Type: application/json`}</code>
          </pre>
          <FieldTable
            title="Key types"
            fields={[
              { name: "sk_", type: "string prefix", description: "Organization member key from dashboard or POST /api/v3/pow/keys (browser session)." },
              { name: "gsk_", type: "string prefix", description: "Guest key from POST /api/v3/pow/org/guests." },
            ]}
          />
          <div className="mt-4">
            <h4 className="text-sm font-medium text-neutral-300">Error response</h4>
            <pre className={codeBlockClass}>
              <code>{`{
  "error": {
    "code": "forbidden",
    "message": "Human-readable explanation",
    "details": {}
  }
}`}</code>
            </pre>
            <p className="mt-2 text-sm text-neutral-500">
              Common codes: unauthorized, key_revoked, key_expired, forbidden, teams_required, validation_error,
              workspace_not_found, block_not_found, tap_link_not_found, guest_not_found, not_found, rate_limit_exceeded
              (429).
            </p>
          </div>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Evaluation modes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Workspaces use <code className="text-neutral-300">evaluation_mode</code> to choose between full semantic
            verification and privacy-preserving opaque protocol verification.
          </p>
          <FieldTable
            title="Modes"
            fields={[
              {
                name: "semantic",
                type: "default",
                description:
                  "Create with initial_prompt. Schema uses definition. Performance returns semantic gap_analysis.",
              },
              {
                name: "opaque",
                type: "privacy mode",
                description:
                  "Create with protocol (protocol_id, goal_ref). Schema uses definition_ref + contract.event_verbs. Performance returns protocol_report; partner refs are stored but not semantically inferred.",
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-500">
            Canonical opaque protocol <code className="text-neutral-400">agent-trace-v3</code>: enumerate → fingerprint →
            aggregate → emit → validate. Upload metadata is allowlisted; tool payloads are plaintext-linted in opaque mode.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Scopes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Each Bearer-authenticated endpoint requires one scope. The wildcard <code className="text-neutral-300">*</code>{" "}
            grants all scopes.
          </p>
          <FieldTable
            title="Scope reference"
            fields={[
              { name: "workspaces:read", type: "scope", description: "List blocks; generate proof-of-work schemas and integration skills; call verification-score / augmentation-score / optimization-score." },
              { name: "workspaces:write", type: "scope", description: "Upload proof of work (workspace create is UI-only)." },
              { name: "tap:read", type: "scope", description: "List TAP links and poll completion status (score via POST .../verification-score)." },
              { name: "tap:write", type: "scope", description: "Create Think Aloud Protocol (TAP) links for blocks." },
              { name: "org:read", type: "scope", description: "Reserved for org admin keys (future org read endpoints)." },
              { name: "org:write", type: "scope", description: "Create guest users and issue gsk_ keys." },
              { name: "*", type: "scope", description: "All scopes. Org admins only when assigning to sk_ keys." },
            ]}
          />
          <p className="mt-3 text-sm text-neutral-500">
            Default sk_ key scopes: workspaces:read, workspaces:write, tap:read, tap:write. Guest gsk_ keys receive the
            same four scopes automatically.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Rate limits</h2>
          <p className="mt-2 text-sm text-neutral-400">
            API keys default to <strong className="font-medium text-neutral-300">120 requests per minute</strong> per key.
            Exceeding the limit returns 429 with code <code className="text-neutral-300">rate_limit_exceeded</code>.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Endpoint index</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ENDPOINT_SPECS.map((spec) => (
              <li key={spec.id}>
                <a href={`#${spec.id}`} className="text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-white">
                  <span className="font-mono text-neutral-300">{spec.method}</span> {spec.path}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {ENDPOINT_SPECS.map((spec) => (
            <EndpointDoc key={spec.id} spec={spec} />
          ))}
        </div>

        <section className={`${sectionClass} mt-6`}>
          <h2 className="text-lg font-medium text-white">TAP session completion (learner-facing)</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Learners open <code className="text-neutral-300">private_url</code> without an API key. Completion uses web
            APIs (not Proof-of-Work API):
          </p>
          <FieldTable
            title="POST /api/workspace-tap-score/chat"
            fields={[
              { name: "privateToken", type: "string", required: true, description: "Token from private_url path." },
              { name: "thought", type: "string", required: true, description: "Learner thought fragment." },
              { name: "messages", type: "array", description: "Optional prior chat messages." },
            ]}
          />
          <FieldTable
            title="POST /api/workspace-tap-score/complete"
            fields={[
              { name: "privateToken", type: "string", required: true, description: "Token from private_url path." },
              { name: "transcript", type: "array", required: true, description: "Session transcript entries with role and text." },
              { name: "durationSeconds", type: "integer", description: "Elapsed session seconds." },
            ]}
          />
        </section>

        <section className={`${sectionClass} mt-6 border-white/10`}>
          <p className={labelClass}>For agents</p>
          <h2 className="mt-2 text-lg font-medium text-white">Machine-readable spec</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Agents should also load{" "}
            <Link href="/skill.md" className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
              /skill.md
            </Link>{" "}
            for integration checklists, guest responsibilities, and MCP transport. Generate a custom skill per
            workspace via{" "}
            <code className="text-neutral-300">POST .../integration-skill</code>, or add the PumaDoc policy snippets:{" "}
            <Link
              href="/customer-agent-uncertain-systems-policy.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              Customer Agent policy
            </Link>
            ,{" "}
            <Link
              href="/pumaclaw-mentor-uncertain-systems-policy.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              PumaClaw Mentor policy
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}