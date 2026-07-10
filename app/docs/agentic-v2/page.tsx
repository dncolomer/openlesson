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
    path: "/api/v2/agent/workspaces",
    scope: "workspaces:write",
    summary: "Create a Verification Workspace from an initial prompt and optional seed files.",
    status: "201 Created",
    requestBody: [
      { name: "initial_prompt", type: "string", required: true, description: "Task or learning goal used to generate workspace title and blocks." },
      {
        name: "files",
        type: "array<object>",
        description: "Optional seed files (max 5). Each item: name (string), mime_type (string), data (base64 string).",
      },
      { name: "files[].name", type: "string", required: true, description: "Filename including extension." },
      { name: "files[].mime_type", type: "string", required: true, description: "application/pdf, text/plain, text/markdown, image/jpeg, image/png, image/webp." },
      { name: "files[].data", type: "string (base64)", required: true, description: "File bytes, max 10 MB per file." },
    ],
    requestExample: `{
  "initial_prompt": "Prepare a CSM to handle enterprise renewal negotiations.",
  "files": [
    {
      "name": "brief.md",
      "mime_type": "text/markdown",
      "data": "<base64>"
    }
  ]
}`,
    responseBody: [
      { name: "workspace.id", type: "uuid", description: "Workspace ID (learning_plans.id)." },
      { name: "workspace.title", type: "string", description: "Generated workspace title." },
      { name: "workspace.root_topic", type: "string", description: "Truncated prompt summary." },
      { name: "workspace.status", type: "string", description: "active" },
      { name: "workspace.notes", type: "string", description: "Full initial prompt stored as notes." },
      { name: "workspace.created_at", type: "ISO-8601", description: "Creation timestamp." },
      { name: "workspace.updated_at", type: "ISO-8601", description: "Last update timestamp." },
      { name: "blocks", type: "array", description: "Generated assessable blocks (3–8)." },
      { name: "blocks[].id", type: "uuid", description: "Block ID (plan_nodes.id)." },
      { name: "blocks[].title", type: "string", description: "Block title." },
      { name: "blocks[].description", type: "string", description: "What the learner should demonstrate." },
      { name: "blocks[].is_start", type: "boolean", description: "True for the entry block." },
      { name: "blocks[].next_node_ids", type: "uuid[]", description: "Linked next blocks in the graph." },
      { name: "blocks[].status", type: "string", description: "available" },
      { name: "blocks[].created_at", type: "ISO-8601", description: "Block creation timestamp." },
      { name: "files", type: "array", description: "Uploaded plan_files records (empty if none)." },
      { name: "files[].id", type: "uuid", description: "plan_files.id" },
      { name: "files[].file_name", type: "string", description: "Original filename." },
      { name: "files[].file_size", type: "integer", description: "Bytes." },
      { name: "files[].mime_type", type: "string", description: "MIME type." },
      { name: "files[].created_at", type: "ISO-8601", description: "Upload timestamp." },
    ],
    responseExample: `{
  "workspace": {
    "id": "a3090aa0-3498-4be8-aa87-32a1a6591641",
    "title": "Enterprise Renewal Negotiation Prep",
    "root_topic": "Prepare a CSM to handle enterprise renewal negotiations.",
    "status": "active",
    "notes": "Prepare a CSM to handle enterprise renewal negotiations.",
    "created_at": "2026-06-23T13:01:32.64659+00:00",
    "updated_at": "2026-06-23T13:01:32.64659+00:00"
  },
  "blocks": [
    {
      "id": "e57844a6-1b69-465c-9120-d0812d6339ae",
      "title": "Context & Procurement Tactics",
      "description": "Demonstrate knowledge of renewal cycles and procurement pushback.",
      "is_start": true,
      "next_node_ids": ["b454f31a-3045-4c23-a60e-820b43d0e9ce"],
      "status": "available",
      "created_at": "2026-06-23T13:01:32.691293+00:00"
    }
  ],
  "files": []
}`,
    notes: [
      "Guest keys (gsk_) may create workspaces; workspace is org-owned and tagged with guest_user_id.",
      "Requires Teams tier (403 teams_required otherwise).",
    ],
  },
  {
    id: "list-blocks",
    method: "GET",
    path: "/api/v2/agent/workspaces/{workspace_id}/blocks",
    scope: "workspaces:read",
    summary: "List assessable blocks in a workspace.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    responseBody: [
      { name: "blocks", type: "array", description: "All plan_nodes for the workspace, ordered by created_at ascending." },
      { name: "blocks[].id", type: "uuid", description: "Block ID." },
      { name: "blocks[].title", type: "string", description: "Block title." },
      { name: "blocks[].description", type: "string", description: "Demonstration objective." },
      { name: "blocks[].is_start", type: "boolean", description: "Entry block flag." },
      { name: "blocks[].next_node_ids", type: "uuid[]", description: "Next block IDs." },
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
      "next_node_ids": ["b454f31a-3045-4c23-a60e-820b43d0e9ce"],
      "status": "available",
      "created_at": "2026-06-23T13:01:32.691293+00:00"
    }
  ]
}`,
    notes: ["404 workspace_not_found if the key cannot access the workspace."],
  },
  {
    id: "evidence-schema",
    method: "POST",
    path: "/api/v2/agent/workspaces/{workspace_id}/evidence-schema",
    scope: "workspaces:read",
    summary:
      "Given workspace context (blocks, plan files on xAI, evidence metadata) plus an evaluation definition, Grok returns a JSON Schema for the ideal tool evidence payload.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    requestBody: [
      {
        name: "definition",
        type: "string",
        required: true,
        description: "What to evaluate — rubric text, competency description, or full eval spec from your agent.",
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
    requestExample: `{
  "definition": "Evaluate whether the learner can articulate a crisp ICP with segment rationale and validation plan",
  "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae",
  "integration_hints": {
    "tool_name": "pumadoc",
    "partner_agent": "PumaDoc Customer Agent",
    "event_verbs": ["run_simulation", "edit_field", "publish_artifact"],
    "goals": ["simulation_completed", "artifact_published"]
  }
}`,
    responseBody: [
      { name: "schema", type: "object", description: "JSON Schema (draft-07 style) for the ideal tool evidence payload inside the upload data field." },
      { name: "schema_name", type: "string", description: "Snake_case identifier, typically prefixed eval_input_." },
      { name: "rationale", type: "string", description: "Why these fields capture optimal eval signal for this workspace." },
      { name: "example_payload", type: "object", description: "Example JSON matching the schema conceptually." },
      { name: "recommended_mime_type", type: "string", description: "Usually application/json for tool evidence." },
      { name: "recommended_evidence_type", type: "string", description: "tool | screen | video | eeg" },
      { name: "required_fields", type: "string[]", description: "Top-level field names integrators should always include." },
      { name: "optional_fields", type: "string[]", description: "Enrichment fields (reflections, media refs, etc.)." },
      { name: "collection_guidance", type: "string", description: "When and how often to upload evidence for this definition." },
      {
        name: "performance_report_contract",
        type: "object",
        description:
          "Formal contract for POST .../performance report mode: overall_score, marker_scores (spider_radar), gap_analysis.gaps, and example_report.",
      },
      { name: "workspace_id", type: "uuid", description: "Echo of path workspace_id." },
      { name: "block_id", type: "uuid | null", description: "Echo of request block_id." },
      { name: "definition", type: "string", description: "Echo of request definition." },
      { name: "workspace_summary", type: "object", description: "id, title, root_topic." },
      { name: "context_counts", type: "object", description: "blocks, tap_sessions, evidence_artifacts, linked_sessions, plan_files." },
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
  "recommended_evidence_type": "tool",
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
    "evidence_artifacts": 0,
    "linked_sessions": 0,
    "plan_files": 2
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "Use before POST .../evidence when you want a concrete JSON contract for what your agent should serialize.",
      "Builds the same workspace context bundle as performance (JSON summary + up to 19 xAI artifact refs).",
      "404 block_not_found if block_id is not in this workspace.",
      "Grok-generated; may take up to ~120s on large workspaces.",
    ],
  },
  {
    id: "integration-skill",
    method: "POST",
    path: "/api/v2/agent/workspaces/{workspace_id}/integration-skill",
    scope: "workspaces:read",
    summary:
      "Generate a workspace-specific skill.md integration guide (like /pumadoc-evidence-performance-skill.md) for a custom partner agent.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    requestBody: [
      { name: "integration_name", type: "string", required: true, description: "Partner integration slug or display name (e.g. acme-sales-copilot)." },
      { name: "partner_description", type: "string", description: "What the external agent does; Grok uses this to tailor examples." },
      { name: "block_id", type: "uuid", description: "Optional: focus the skill on one block." },
      { name: "base_url", type: "string", description: "Origin for example URLs; default https://openlesson.academy." },
      {
        name: "include_sections",
        type: "string[]",
        description: "Sections to include. Default: purpose, design_principles, auth, endpoints, evidence_payload, performance, checklist.",
      },
    ],
    requestExample: `{
  "integration_name": "acme-sales-copilot",
  "partner_description": "Guides reps through discovery calls and objection handling",
  "base_url": "https://openlesson.academy",
  "include_sections": ["purpose", "auth", "endpoints", "evidence_payload", "performance", "checklist"]
}`,
    responseBody: [
      { name: "skill_md", type: "string", description: "Full markdown document with YAML frontmatter (name, description)." },
      { name: "skill_name", type: "string", description: "Derived frontmatter name, e.g. acme-sales-copilot-openlesson-evidence-performance." },
      { name: "suggested_share_path", type: "string", description: "Suggested public path, e.g. /acme-sales-copilot-skill.md." },
      { name: "workspace_summary", type: "object", description: "id, title, root_topic, block_count." },
      { name: "context_counts", type: "object | null", description: "Workspace context counts used during generation." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs attached during generation." },
    ],
    responseExample: `{
  "skill_md": "---\\nname: acme-sales-copilot-openlesson-evidence-performance\\ndescription: Acme Sales Copilot integration skill for OpenLesson evidence upload and performance analysis.\\n---\\n\\n# Acme Sales Copilot — OpenLesson Evidence & Performance\\n\\n...",
  "skill_name": "acme-sales-copilot-openlesson-evidence-performance",
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
    "evidence_artifacts": 0,
    "linked_sessions": 0,
    "plan_files": 1
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "Host skill_md at suggested_share_path or inject directly into your agent's skill system.",
      "References canonical /skill.md and /docs/agentic-v2; includes workspace-specific block mapping and payload examples.",
      "404 block_not_found if block_id is not in this workspace.",
      "Grok-generated markdown; may take up to ~120s.",
    ],
  },
  {
    id: "upload-evidence",
    method: "POST",
    path: "/api/v2/agent/workspaces/{workspace_id}/evidence",
    scope: "workspaces:write",
    summary: "Upload tool usage, screenshots, video, or EEG to xAI Files and link to workspace/block/session.",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    requestBody: [
      { name: "type", type: "string", required: true, description: "tool | screen | screenshot | video | eeg (screenshot aliases to screen)." },
      { name: "mime_type", type: "string", required: true, description: "Must match type (see MIME table below)." },
      { name: "data", type: "string (base64)", required: true, description: "Artifact bytes, max 10 MB." },
      { name: "file_name", type: "string", description: "Optional filename; default derived from type." },
      { name: "block_id", type: "uuid", description: "Optional block to scope evidence." },
      { name: "session_id", type: "uuid", description: "Optional linked session ID." },
      { name: "timestamp_ms", type: "integer", description: "Client timestamp; defaults to server time." },
      { name: "chunk_index", type: "integer", description: "Chunk sequence for streaming artifacts; default 0." },
      { name: "metadata", type: "object", description: "Arbitrary JSON metadata stored on the evidence row." },
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
      { name: "evidence.id", type: "uuid", description: "workspace_evidence.id" },
      { name: "evidence.workspace_id", type: "uuid", description: "Same as plan_id." },
      { name: "evidence.block_id", type: "uuid | null", description: "plan_node_id if scoped." },
      { name: "evidence.session_id", type: "uuid | null", description: "Optional session link." },
      { name: "evidence.type", type: "string", description: "tool | screen | video | eeg" },
      { name: "evidence.file_name", type: "string", description: "Stored filename." },
      { name: "evidence.mime_type", type: "string", description: "MIME type." },
      { name: "evidence.file_size", type: "integer", description: "Decoded byte length." },
      { name: "evidence.xai_file_id", type: "string", description: "xAI Files API file_id." },
      { name: "evidence.timestamp_ms", type: "integer", description: "Client or server timestamp." },
      { name: "evidence.chunk_index", type: "integer", description: "Chunk index." },
      { name: "evidence.metadata", type: "object", description: "Stored metadata JSON." },
      { name: "evidence.tool_name", type: "string | null", description: "Tool name when type=tool." },
      { name: "evidence.tool_action", type: "string | null", description: "Tool action when type=tool." },
      { name: "evidence.device_name", type: "string | null", description: "EEG device when type=eeg." },
      { name: "evidence.sample_count", type: "integer | null", description: "EEG samples when type=eeg." },
      { name: "evidence.created_at", type: "ISO-8601", description: "Upload timestamp." },
    ],
    responseExample: `{
  "evidence": {
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
      "404 block_not_found if block_id is not in this workspace.",
    ],
  },
  {
    id: "performance",
    method: "POST",
    path: "/api/v2/agent/workspaces/{workspace_id}/performance",
    scope: "workspaces:read",
    summary: "Analyze workspace evidence, TAP (Think Aloud Protocol) results, ILE practice traces, sessions, and plan files. Report mode (no prompt) or chat mode (with prompt).",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    requestBody: [
      { name: "prompt", type: "string", description: "If non-empty → chat mode (markdown response). If omitted or empty → report mode (structured JSON)." },
      { name: "block_id", type: "uuid", description: "Optional: scope analysis to one block." },
      { name: "conversation_history", type: "array", description: "Chat mode only. Up to 12 prior turns: { role: user|assistant, content: string }." },
      { name: "file_ids", type: "string[]", description: "Optional xAI file IDs from a prior performance call. Empty → rebuild context bundle." },
    ],
    requestExample: `// Report mode
{ "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae" }

// Chat mode
{
  "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae",
  "prompt": "What is the single biggest readiness gap?",
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    responseBody: [
      { name: "mode", type: "report | chat", description: "Which response shape is populated." },
      { name: "report", type: "object | null", description: "Present when mode=report." },
      { name: "report.overall_score", type: "integer", description: "0–100 readiness score synthesized from evidence." },
      {
        name: "report.marker_scores",
        type: "array",
        description: "Spider/radar competency axes: id, label, score (0–100), rationale, optional block_id.",
      },
      { name: "report.summary", type: "string", description: "Executive summary." },
      { name: "report.strengths", type: "string[]", description: "Demonstrated strengths." },
      { name: "report.growth_areas", type: "string[]", description: "Areas needing development." },
      { name: "report.gap_analysis.summary", type: "string", description: "Gap analysis overview." },
      { name: "report.gap_analysis.gaps", type: "array", description: "title, evidence, severity (low|medium|high), suggested_repair." },
      { name: "report.gap_analysis.next_practice", type: "string[]", description: "Recommended practice actions." },
      { name: "report.suggestions", type: "string[]", description: "Additional recommendations." },
      { name: "report.confidence", type: "string", description: "emerging | developing | clear | well-connected" },
      { name: "response", type: "string | null", description: "Markdown answer when mode=chat." },
      { name: "evidence_summary", type: "object | null", description: "Counts used in context (blocks, tap_sessions, evidence_artifacts, linked_sessions, plan_files)." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs for follow-up calls; pass back as file_ids." },
    ],
    responseExample: `{
  "mode": "report",
  "report": {
    "overall_score": 68,
    "marker_scores": [
      {
        "id": "negotiation_prep",
        "label": "Negotiation Preparation",
        "score": 74,
        "rationale": "Used CRM and ROI table before price discussion."
      },
      {
        "id": "risk_quantification",
        "label": "Risk Quantification",
        "score": 52,
        "rationale": "Churn risk was discussed but never modeled numerically."
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
          "evidence": "Reflection states churn risk was not modeled.",
          "severity": "medium",
          "suggested_repair": "Add probability-weighted revenue loss to ROI table."
        }
      ],
      "next_practice": ["Run 3 simulated procurement scenarios with churn math"]
    },
    "suggestions": ["Practice live role-play with procurement pushback"],
    "confidence": "emerging"
  },
  "evidence_summary": {
    "blocks": 1,
    "tap_sessions": 0,
    "evidence_artifacts": 2,
    "linked_sessions": 0,
    "plan_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}

// Chat mode response
{
  "mode": "chat",
  "response": "The biggest readiness gap is **churn risk quantification** — the learner discussed renewal value but never modeled probability-weighted revenue loss.",
  "evidence_summary": {
    "blocks": 1,
    "tap_sessions": 0,
    "evidence_artifacts": 2,
    "linked_sessions": 0,
    "plan_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "First call with empty file_ids uploads a workspace performance JSON summary + up to 19 artifact files to xAI.",
      "If no evidence exists, both modes still return 200 with an empty-data template (report object or chat message).",
      "Chat mode: pass returned file_ids on follow-up calls to avoid re-uploading the context bundle.",
    ],
  },
  {
    id: "create-tap-link",
    method: "POST",
    path: "/api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/tap-links",
    scope: "tap:write",
    summary: "Create a private Think Aloud Protocol (TAP) link for a block (15 or 30 minutes).",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
      { name: "block_id", type: "uuid", required: true, description: "Target block ID." },
    ],
    requestBody: [
      { name: "minutes", type: "integer", description: "15 or 30 only; any other value defaults to 15." },
      { name: "guest_user_id", type: "uuid", description: "Org admin only: assign link to a guest by ID." },
      { name: "guest_email", type: "string", description: "Org admin only: assign link to a guest by email." },
    ],
    requestExample: `{
  "minutes": 15,
  "guest_email": "learner@example.com"
}`,
    responseBody: [
      { name: "tap_link.id", type: "uuid", description: "TAP link / session row ID." },
      { name: "tap_link.plan_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_link.plan_node_id", type: "uuid", description: "Block ID." },
      { name: "tap_link.status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_link.requested_duration_seconds", type: "integer", description: "900 (15 min) or 1800 (30 min)." },
      { name: "tap_link.focus_node_ids", type: "uuid[]", description: "Focused block IDs (usually the target block)." },
      { name: "tap_link.created_at", type: "ISO-8601", description: "Link creation time." },
      { name: "tap_link.private_url", type: "string", description: "Bearer URL: /ghl-score/session/{token}. No login required." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption (see Predictive interruptions)." },
    ],
    responseExample: `{
  "tap_link": {
    "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
    "plan_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
    "plan_node_id": "88a43ad8-62f8-4252-a847-2cbc0b754a57",
    "status": "pending",
    "requested_duration_seconds": 900,
    "focus_node_ids": ["88a43ad8-62f8-4252-a847-2cbc0b754a57"],
    "created_at": "2026-06-23T01:29:03.861663+00:00",
    "private_url": "https://openlesson.academy/ghl-score/session/E8-ouJ9lErgDEmteyKc4tJ39meJ91vzZFNUiuRauHvw"
  }
}`,
    notes: [
      "Legacy alias: POST .../blocks/{block_id}/ghl-links (same behavior).",
      "Guest keys auto-attach the link to their guest identity.",
      "Org admins may set guest_user_id or guest_email to assign the link (404 guest_not_found if missing).",
      "Learner completes session at private_url without an API key.",
    ],
  },
  {
    id: "list-tap-links",
    method: "GET",
    path: "/api/v2/agent/workspaces/{workspace_id}/tap-links",
    scope: "tap:read",
    summary: "List TAP links for a workspace (filtered by caller role).",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
    ],
    responseBody: [
      { name: "tap_links", type: "array", description: "Sessions ordered by created_at descending." },
      { name: "tap_links[].id", type: "uuid", description: "Link ID." },
      { name: "tap_links[].plan_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_links[].plan_node_id", type: "uuid", description: "Block ID." },
      { name: "tap_links[].status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_links[].requested_duration_seconds", type: "integer", description: "Requested duration." },
      { name: "tap_links[].duration_seconds", type: "integer", description: "Actual duration (0 until completed)." },
      { name: "tap_links[].focus_node_ids", type: "uuid[]", description: "Focused blocks." },
      { name: "tap_links[].overall_score", type: "integer | null", description: "Score when completed." },
      { name: "tap_links[].created_at", type: "ISO-8601", description: "Created at." },
      { name: "tap_links[].started_at", type: "ISO-8601 | null", description: "Started at." },
      { name: "tap_links[].completed_at", type: "ISO-8601 | null", description: "Completed at." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption." },
    ],
    responseExample: `{
  "tap_links": [
    {
      "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
      "plan_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
      "plan_node_id": "88a43ad8-62f8-4252-a847-2cbc0b754a57",
      "status": "completed",
      "requested_duration_seconds": 900,
      "duration_seconds": 120,
      "focus_node_ids": ["88a43ad8-62f8-4252-a847-2cbc0b754a57"],
      "overall_score": 72,
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
      "Legacy alias: GET .../ghl-links (same behavior).",
    ],
  },
  {
    id: "tap-results",
    method: "GET",
    path: "/api/v2/agent/workspaces/{workspace_id}/tap-links/{link_id}/results",
    scope: "tap:read",
    summary: "Poll TAP link completion and read scores, markers, and gap analysis.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Verification Workspace ID." },
      { name: "link_id", type: "uuid", required: true, description: "TAP link ID from create or list." },
    ],
    responseBody: [
      { name: "tap_result.id", type: "uuid", description: "Link ID." },
      { name: "tap_result.workspace_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_result.block_id", type: "uuid", description: "Block ID." },
      { name: "tap_result.xai_file_id", type: "string | null", description: "xAI artifact file when completed." },
      { name: "tap_result.status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_result.completed", type: "boolean", description: "True when status=completed." },
      { name: "tap_result.duration_seconds", type: "integer", description: "Actual session duration." },
      { name: "tap_result.requested_duration_seconds", type: "integer", description: "Requested duration." },
      { name: "tap_result.focus_block_ids", type: "uuid[]", description: "Focused blocks." },
      { name: "tap_result.summary", type: "string | null", description: "Overall reflection when completed." },
      { name: "tap_result.overall_score", type: "integer | null", description: "0–100 when completed." },
      { name: "tap_result.marker_scores", type: "array | null", description: "id, label, score, rationale per marker when completed." },
      { name: "tap_result.gap_analysis", type: "object | null", description: "summary, gaps[], next_practice[] when completed." },
      { name: "tap_result.analysis", type: "object | null", description: "Full analysis JSON when completed." },
      { name: "tap_result.created_at", type: "ISO-8601", description: "Created at." },
      { name: "tap_result.started_at", type: "ISO-8601 | null", description: "Started at." },
      { name: "tap_result.completed_at", type: "ISO-8601 | null", description: "Completed at." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption." },
    ],
    responseExample: `{
  "tap_result": {
    "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
    "workspace_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
    "block_id": "88a43ad8-62f8-4252-a847-2cbc0b754a57",
    "xai_file_id": "file_1f27f79e-81c2-4ef9-9cb5-28c36a5227c4",
    "status": "completed",
    "completed": true,
    "duration_seconds": 120,
    "requested_duration_seconds": 900,
    "focus_block_ids": ["88a43ad8-62f8-4252-a847-2cbc0b754a57"],
    "summary": "Learner demonstrated basic RAG concepts with room to improve causal links.",
    "overall_score": 72,
    "marker_scores": [
      {
        "id": "conceptual_clarity",
        "label": "Conceptual Clarity",
        "score": 78,
        "rationale": "Defined retrieval and generation stages clearly."
      }
    ],
    "gap_analysis": {
      "summary": "Integration between retrieval quality and answer faithfulness needs work.",
      "gaps": [
        {
          "title": "Weak causal link retrieval→accuracy",
          "evidence": "Could not explain how bad retrieval causes hallucinations.",
          "severity": "medium",
          "suggested_repair": "Practice explaining failure modes with a concrete bad-retrieval example."
        }
      ],
      "next_practice": ["Define faithfulness vs fluency tradeoff"]
    },
    "analysis": { },
    "created_at": "2026-06-23T01:29:03.861663+00:00",
    "started_at": "2026-06-23T01:30:00+00:00",
    "completed_at": "2026-06-23T01:32:21.492+00:00"
  }
}`,
    notes: [
      "Pending/in_progress: summary, overall_score, marker_scores, gap_analysis, and analysis are null.",
      "Legacy alias: GET .../ghl-links/{link_id}/results (same behavior).",
      "404 tap_link_not_found if link does not exist or caller cannot access it.",
    ],
  },
  {
    id: "create-guest",
    method: "POST",
    path: "/api/v2/agent/org/guests",
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
    path: "/api/v2/agent/keys",
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
    path: "/api/v2/agent/keys",
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
      "Valid scopes: *, workspaces:read, workspaces:write, tap:read, tap:write, org:read, org:write. Legacy aliases ghl:read and ghl:write are accepted.",
      "403 if more than 10 active keys or if non-admin requests org scopes.",
    ],
  },
  {
    id: "revoke-key",
    method: "DELETE",
    path: "/api/v2/agent/keys/{key_id}",
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
    path: "/api/v2/agent/keys/{key_id}/scopes",
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
          <p className={labelClass}>OpenLesson Evidence API</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Verification Workspace API Reference
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Full request and response specifications for every Evidence API endpoint: workspaces, evidence schema
            generation, integration skill generation, evidence upload, performance analysis, TAP links, ILE practice, guest
            provisioning, and dashboard key management. Bearer endpoints use base path{" "}
            <code className="text-neutral-300">/api/v2/agent</code> and require active{" "}
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
              { name: "sk_", type: "string prefix", description: "Organization member key from dashboard or POST /api/v2/agent/keys (browser session)." },
              { name: "gsk_", type: "string prefix", description: "Guest key from POST /api/v2/agent/org/guests." },
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
          <h2 className="text-lg font-medium text-white">Scopes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Each Bearer-authenticated endpoint requires one scope. The wildcard <code className="text-neutral-300">*</code>{" "}
            grants all scopes.
          </p>
          <FieldTable
            title="Scope reference"
            fields={[
              { name: "workspaces:read", type: "scope", description: "List blocks; generate evidence schemas and integration skills; run performance analysis (report or chat)." },
              { name: "workspaces:write", type: "scope", description: "Create workspaces; upload evidence." },
              { name: "tap:read", type: "scope", description: "List TAP links; poll TAP results." },
              { name: "tap:write", type: "scope", description: "Create Think Aloud Protocol (TAP) links for blocks." },
              { name: "org:read", type: "scope", description: "Reserved for org admin keys (future org read endpoints)." },
              { name: "org:write", type: "scope", description: "Create guest users and issue gsk_ keys." },
              { name: "*", type: "scope", description: "All scopes. Org admins only when assigning to sk_ keys." },
            ]}
          />
          <p className="mt-3 text-sm text-neutral-500">
            Default sk_ key scopes: workspaces:read, workspaces:write, tap:read, tap:write. Guest gsk_ keys receive the
            same four scopes automatically. Legacy scopes ghl:read and ghl:write remain accepted as aliases.
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
            APIs (not Evidence API):
          </p>
          <FieldTable
            title="POST /api/workspace-ghl-score/chat"
            fields={[
              { name: "privateToken", type: "string", required: true, description: "Token from private_url path." },
              { name: "thought", type: "string", required: true, description: "Learner thought fragment." },
              { name: "messages", type: "array", description: "Optional prior chat messages." },
            ]}
          />
          <FieldTable
            title="POST /api/workspace-ghl-score/complete"
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
            <code className="text-neutral-300">POST .../integration-skill</code>, or use the PumaDoc examples:{" "}
            <Link
              href="/customer-agent-openlesson-skill.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              Customer Agent
            </Link>
            ,{" "}
            <Link
              href="/pumaclaw-mentor-openlesson-skill.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              PumaClaw Mentor
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}