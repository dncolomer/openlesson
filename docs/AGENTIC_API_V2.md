# OpenLesson Agentic API v2 - Comprehensive Specification

> **Version:** 2.0.0  
> **Status:** Implemented  
> **Last Updated:** April 15, 2026  
> **Authors:** OpenLesson Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Authentication & Security](#3-authentication--security)
4. [Learning Plan Management](#4-learning-plan-management)
5. [Session Management](#5-session-management)
6. [Analysis Heartbeat](#6-analysis-heartbeat)
7. [Helios Chat Integration](#7-helios-chat-integration)
8. [Analytics & Progress](#8-analytics--progress)
9. [Cryptographic Proof System](#9-cryptographic-proof-system)
10. [Solana Program Specification](#10-solana-program-specification)
11. [API Key Management](#11-api-key-management)
12. [Database Schema Changes](#12-database-schema-changes)
13. [Implementation File Structure](#13-implementation-file-structure)
14. [Agent System Prompt Template](#14-agent-system-prompt-template)
15. [Example Conversation Flows](#15-example-conversation-flows)
16. [Error Handling](#16-error-handling)
17. [Migration & Deprecation Plan](#17-migration--deprecation-plan)
18. [Appendix](#18-appendix)

---

## 1. Executive Summary

### 1.1 Purpose

This specification defines a complete replacement for the existing `/api/agent/*` endpoints with a new versioned API at `/api/v2/agent/*`. The new API enables external AI agents (OpenClaw, Hermes, Eliza OS, custom agents) to fully act as tutors on behalf of users while leveraging all existing OpenLesson tutoring intelligence.

### 1.2 Goals

1. **Full Flexibility**: Match the web interface capabilities exactly - multiple concurrent sessions, pause/resume, plan adaptation at any time
2. **Verifiable Learning**: Cryptographic proofs anchored on Solana for trustless verification
3. **Agent-First Design**: Optimized for AI agent consumption, not human UI
4. **Security**: Scoped API keys with Pro tier enforcement

### 1.3 Key Differences from Current API (v1)

| Aspect | Current API (v1) | New API (v2) |
|--------|------------------|--------------|
| Path | `/api/agent/*` | `/api/v2/agent/*` |
| Auth | Simple API keys | Scoped API keys with permissions |
| Rate limiting | Defined but not enforced | Enforced (120 req/min) |
| Session flexibility | Basic start/end | Pause, resume, restart, switch |
| Plan management | Generate only | Full CRUD + adaptation + assessment |
| Analysis input | Audio only | Audio, images, text |
| Teaching assistant | Not integrated | Full Helios Chat integration with conversation history |
| Proofs | None | Cryptographic proofs + Solana anchoring |
| Analytics | Basic summary | Full analytics endpoints |
| Payment | Per-request | Bundled with Pro tier |

### 1.4 Target Integrations

- **OpenClaw**: General-purpose AI agent framework
- **Hermes**: Autonomous agent platform
- **Eliza OS**: Social AI agent framework
- **Custom Agents**: Any HTTP-capable AI system

---

## 2. Architecture Overview

### 2.1 Design Principles

1. **Full Flexibility**: Match the web interface capabilities exactly
2. **Stateless API**: Each request is independent; state lives in the database
3. **Verifiable**: Every significant action generates cryptographic proofs
4. **Agent-First**: Designed for AI agent consumption, not human UI

### 2.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT (External)                             │
│         OpenClaw / Hermes / Eliza OS / Custom Agent                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + API Key
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OpenLesson Agentic API v2                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │    Plans    │  │  Sessions   │  │  Analysis   │  │  Assistant │ │
│  │  /plans/*   │  │ /sessions/* │  │ /analyze    │  │    /ask    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Analytics  │  │   Proofs    │  │    Keys     │                 │
│  │ /analytics/*│  │  /proofs/*  │  │   /keys/*   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Existing Backend Services                         │
│  ┌─────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ openrouter.ts   │  │  storage.ts    │  │ Supabase (DB/Storage) │ │
│  │ (AI Prompts)    │  │  (Data Layer)  │  │                       │ │
│  └─────────────────┘  └────────────────┘  └───────────────────────┘ │
│  ┌─────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ Transcription   │  │ Plan Generation│  │ Proof Generation      │ │
│  │ (Gemini 2.5)    │  │ (LLM)          │  │ (SHA-256 + Solana)    │ │
│  └─────────────────┘  └────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Solana Blockchain                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  OpenLesson Proof Anchor Program                                ││
│  │  - ProofAnchor accounts (individual proofs)                     ││
│  │  - BatchAnchor accounts (session heartbeat batches)             ││
│  │  - UserProofIndex accounts (per-user statistics)                ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Request Flow

```
Agent Request
     │
     ▼
┌─────────────────┐
│ Rate Limiter    │──── 429 if exceeded
│ (120 req/min)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Middleware │──── 401 if invalid key
│ (API Key + Pro) │──── 403 if wrong scope or no Pro
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Route Handler   │
│ (Endpoint)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Existing        │
│ Backend Service │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Proof Generator │
│ (if applicable) │
└────────┬────────┘
         │
         ▼
    Response
```

---

## 3. Authentication & Security

### 3.1 API Key Model

API keys are enhanced with scopes for fine-grained access control:

```typescript
interface AgentApiKey {
  id: string;                    // UUID
  user_id: string;               // Owner's user ID
  key_hash: string;              // SHA-256 hash (stored, never plain key)
  key_prefix: string;            // First 12 chars for display (e.g., "sk_a1b2c3d4")
  label: string;                 // Human-readable name
  scopes: ApiKeyScope[];         // Permission scopes
  rate_limit: number;            // Requests per minute (default: 120)
  is_active: boolean;            // Can be revoked
  created_at: string;            // ISO 8601
  last_used_at: string;          // ISO 8601
  expires_at?: string;           // Optional expiration (ISO 8601)
}

type ApiKeyScope = 
  | 'plans:read'        // View learning plans
  | 'plans:write'       // Create/modify plans
  | 'sessions:read'     // View sessions
  | 'sessions:write'    // Create/modify sessions
  | 'analysis:write'    // Submit analysis data
  | 'assistant:read'    // Query Helios
  | 'analytics:read'    // View analytics
  | 'proofs:read'       // View proofs
  | 'proofs:anchor'     // Anchor proofs on-chain
  | '*';                // Full access (all scopes)
```

### 3.2 Key Format

```
sk_<48_hex_characters>

Example: sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

- Prefix `sk_` identifies it as an OpenLesson API key
- 24 random bytes (48 hex chars) for security
- Only shown once at creation; stored as SHA-256 hash

### 3.3 Authentication Flow

Every API request must include:

```
Authorization: Bearer sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Server-side validation:

1. Extract key from `Authorization` header
2. Compute SHA-256 hash of provided key
3. Look up `agent_api_keys` by hash
4. Validate:
   - `is_active = true`
   - Not expired (`expires_at` is null or in future)
   - User has active Pro subscription (via join to `profiles`)
5. Check rate limits
6. Validate required scopes for the endpoint
7. Update `last_used_at` timestamp
8. Return auth context: `{ user_id, key_id, scopes }`

### 3.4 Pro Tier Enforcement

**Key Creation**: Users can only create API keys if they have an active Pro subscription.

**Key Validation**: On every request, the system checks that the user still has an active Pro subscription. If the subscription has lapsed:

- The API key remains in the database but fails validation
- Error response: `403 Forbidden` with `subscription_lapsed` code
- Keys automatically work again if the user renews

**Implementation**:

```typescript
// On key validation, join to profiles table
const { data: keyData } = await supabase
  .from('agent_api_keys')
  .select(`
    id, user_id, scopes, is_active, expires_at,
    profiles!inner(subscription_tier, subscription_status)
  `)
  .eq('key_hash', keyHash)
  .single();

// Check Pro status
if (keyData.profiles.subscription_tier !== 'pro' || 
    keyData.profiles.subscription_status !== 'active') {
  return { valid: false, error: 'subscription_lapsed' };
}
```

### 3.5 Rate Limiting

Since the Agentic API is only available to Pro tier users, we use generous global limits:

| Limit Type | Value |
|------------|-------|
| Requests per minute | 120 |
| Requests per hour | 3,600 |
| Requests per day | 50,000 |
| Max concurrent sessions | 10 |
| Max active plans | 50 |

Rate limit headers included in all responses:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1713052800
```

### 3.6 Scope Requirements by Endpoint

| Endpoint | Required Scope |
|----------|----------------|
| `GET /plans` | `plans:read` |
| `POST /plans` | `plans:write` |
| `GET /plans/{id}` | `plans:read` |
| `PATCH /plans/{id}` | `plans:write` |
| `DELETE /plans/{id}` | `plans:write` |
| `POST /plans/{id}/adapt` | `plans:write` |
| `GET /sessions` | `sessions:read` |
| `POST /sessions` | `sessions:write` |
| `POST /sessions/{id}/analyze` | `analysis:write` |
| `POST /sessions/{id}/ask` | `assistant:read` |
| `GET /analytics/*` | `analytics:read` |
| `GET /proofs/*` | `proofs:read` |
| `POST /proofs/{id}/anchor` | `proofs:anchor` |
| `GET /keys` | (session auth only) |
| `POST /keys` | (session auth only) |

---

## 4. Learning Plan Management

### 4.1 Endpoints Overview

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/v2/agent/plans` | GET | `plans:read` | List all plans |
| `/api/v2/agent/plans` | POST | `plans:write` | Create new plan |
| `/api/v2/agent/plans/{id}` | GET | `plans:read` | Get plan details |
| `/api/v2/agent/plans/{id}` | PATCH | `plans:write` | Update plan metadata |
| `/api/v2/agent/plans/{id}` | DELETE | `plans:write` | Delete plan |
| `/api/v2/agent/plans/{id}/nodes` | GET | `plans:read` | Get plan nodes |
| `/api/v2/agent/plans/{id}/adapt` | POST | `plans:write` | AI-powered adaptation |
| `/api/v2/agent/plans/from-video` | POST | `plans:write` | Create from YouTube |

### 4.2 List Learning Plans

**GET `/api/v2/agent/plans`**

Query parameters:
- `status` (optional): Filter by status (`active`, `completed`, `paused`)
- `limit` (optional): Max results (default 20, max 100)
- `offset` (optional): Pagination offset

**Response:**

```json
{
  "plans": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Quantum Algorithms Mastery Path",
      "root_topic": "Quantum computing algorithms",
      "status": "active",
      "source_type": "topic",
      "duration_days": 30,
      "total_nodes": 8,
      "completed_nodes": 3,
      "created_at": "2026-04-14T10:00:00Z",
      "cover_image_url": "https://..."
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

### 4.3 Create Learning Plan

**POST `/api/v2/agent/plans`**

Creates a new learning plan based on user goals, available time, and source materials.

**Request:**

```json
{
  "topic": "Quantum computing algorithms",
  "description": "I want to understand Grover's and Shor's algorithms at a practical level",
  "duration_days": 30,
  "difficulty": "intermediate",
  "source_materials": [
    {
      "type": "text",
      "content": "Focus on gate-based quantum computing"
    },
    {
      "type": "image",
      "data": "<base64_encoded_image_data>",
      "mime_type": "image/png"
    }
  ],
  "user_context": {
    "background": "Computer science degree, familiar with linear algebra",
    "goals": "Prepare for quantum computing job interviews",
    "constraints": "Can study 1 hour per day"
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | Main topic/subject to learn |
| `description` | string | No | Additional context about learning goals |
| `duration_days` | number | No | Target duration (default: 30, options: 7, 14, 30, 60, 90, 180) |
| `difficulty` | string | No | Starting difficulty (`beginner`, `intermediate`, `advanced`) |
| `source_materials` | array | No | Supporting materials (text, images) |
| `user_context` | object | No | Background, goals, constraints |

**Response:**

```json
{
  "plan": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Quantum Algorithms Mastery Path",
    "root_topic": "Quantum computing algorithms",
    "status": "active",
    "duration_days": 30,
    "source_type": "topic",
    "source_summary": "A comprehensive journey through quantum algorithms...",
    "cover_image_url": "https://...",
    "created_at": "2026-04-14T10:00:00Z",
    "nodes": [
      {
        "id": "node-1",
        "title": "Quantum Bits and Superposition",
        "description": "Foundation of quantum computing - understanding qubits",
        "is_start": true,
        "next_node_ids": ["node-2"],
        "status": "not_started",
        "estimated_duration_minutes": 45,
        "position_x": 0,
        "position_y": 0
      },
      {
        "id": "node-2",
        "title": "Quantum Gates and Circuits",
        "description": "Building blocks of quantum computation",
        "is_start": false,
        "next_node_ids": ["node-3", "node-4"],
        "status": "not_started",
        "estimated_duration_minutes": 60,
        "position_x": 200,
        "position_y": 0
      }
    ],
    "estimated_total_sessions": 8
  },
  "proof": {
    "id": "proof-001",
    "type": "plan_created",
    "fingerprint": "sha256:abc123def456...",
    "timestamp": "2026-04-14T10:00:00Z",
    "anchored": false
  }
}
```

**Implementation Notes:**
- Delegates to existing `callOpenRouterJSON()` for plan generation
- Uses adapted version of `DEFAULT_PROMPTS.session_plan_create`
- Stores in `learning_plans` and `plan_nodes` tables
- Sets `is_agent_session: true` on the plan
- Generates proof fingerprint of plan structure

### 4.4 Create Plan from YouTube Video

**POST `/api/v2/agent/plans/from-video`**

**Request:**

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=abc123",
  "duration_days": 14,
  "focus_areas": ["practical applications", "code examples"],
  "user_context": {
    "background": "Python developer",
    "goals": "Build a working quantum circuit"
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `youtube_url` | string | Yes | Valid YouTube video URL |
| `duration_days` | number | No | Target duration (default: 30) |
| `focus_areas` | string[] | No | Specific areas to emphasize |
| `user_context` | object | No | Background and goals |

**Response:**

Same structure as regular plan creation, with additional fields:
- `source_type: "youtube"`
- `source_url: "https://www.youtube.com/watch?v=abc123"`
- `source_summary: "AI-generated summary of video content for tutoring context"`

**Implementation Notes:**
- Uses `callOpenRouterWithYouTube()` with `google/gemini-2.5-flash-preview-native-audio-video`
- Extracts video transcript and generates structured plan
- Video summary stored for use during tutoring sessions

### 4.5 Get Plan Details

**GET `/api/v2/agent/plans/{id}`**

**Response:**

```json
{
  "plan": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Quantum Algorithms Mastery Path",
    "root_topic": "Quantum computing algorithms",
    "status": "active",
    "duration_days": 30,
    "source_type": "topic",
    "source_url": null,
    "source_summary": "A comprehensive journey...",
    "notes": "User's personal notes about the plan",
    "cover_image_url": "https://...",
    "created_at": "2026-04-14T10:00:00Z",
    "updated_at": "2026-04-14T12:00:00Z"
  },
  "nodes": [
    {
      "id": "node-1",
      "title": "Quantum Bits and Superposition",
      "description": "Foundation of quantum computing",
      "is_start": true,
      "next_node_ids": ["node-2"],
      "status": "completed",
      "session_id": "sess-001",
      "estimated_duration_minutes": 45,
      "position_x": 0,
      "position_y": 0
    }
  ],
  "statistics": {
    "total_nodes": 8,
    "completed_nodes": 3,
    "in_progress_nodes": 1,
    "total_sessions": 4,
    "total_time_minutes": 180
  }
}
```

### 4.6 Update Plan Metadata

**PATCH `/api/v2/agent/plans/{id}`**

Update plan title, notes, or status.

**Request:**

```json
{
  "title": "Updated Plan Title",
  "notes": "New notes about my progress",
  "status": "paused"
}
```

**Response:**

```json
{
  "plan": {
    "id": "550e8400-...",
    "title": "Updated Plan Title",
    "status": "paused",
    "updated_at": "2026-04-14T15:00:00Z"
  },
  "proof": {
    "id": "proof-002",
    "type": "plan_adapted",
    "fingerprint": "sha256:...",
    "timestamp": "2026-04-14T15:00:00Z"
  }
}
```

### 4.7 Delete Plan

**DELETE `/api/v2/agent/plans/{id}`**

Deletes the plan and all associated nodes. Sessions are preserved but unlinked.

**Response:**

```json
{
  "deleted": true,
  "plan_id": "550e8400-...",
  "nodes_deleted": 8,
  "sessions_unlinked": 4
}
```

### 4.8 Get Plan Nodes

**GET `/api/v2/agent/plans/{id}/nodes`**

Returns all nodes for a plan with their relationships.

**Response:**

```json
{
  "nodes": [
    {
      "id": "node-1",
      "title": "Quantum Bits and Superposition",
      "description": "Foundation of quantum computing",
      "is_start": true,
      "next_node_ids": ["node-2"],
      "status": "completed",
      "session_id": "sess-001",
      "estimated_duration_minutes": 45,
      "position_x": 0,
      "position_y": 0,
      "planning_prompt": "Custom instructions for this session"
    }
  ],
  "edges": [
    { "from": "node-1", "to": "node-2" },
    { "from": "node-2", "to": "node-3" },
    { "from": "node-2", "to": "node-4" }
  ]
}
```

### 4.9 Adapt Learning Plan

**POST `/api/v2/agent/plans/{id}/adapt`**

Dynamically modify a plan based on user feedback or progress. This is the AI-powered chat-based adaptation endpoint.

**Request:**

```json
{
  "instruction": "The plan is too theoretical. I need more hands-on coding exercises and fewer mathematical derivations.",
  "preserve_completed": true,
  "context": {
    "recent_session_feedback": "User found the math sections overwhelming",
    "user_current_level": "struggling with Dirac notation"
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `instruction` | string | Yes | Natural language adaptation request |
| `preserve_completed` | boolean | No | Keep completed nodes (default: true) |
| `context` | object | No | Additional context for the AI |

**Response:**

```json
{
  "plan": {
    "id": "550e8400-...",
    "title": "Quantum Algorithms Mastery Path",
    "nodes": [ /* updated node list */ ]
  },
  "changes": {
    "nodes_added": [
      { "id": "node-9", "title": "Hands-on Qiskit Basics" },
      { "id": "node-10", "title": "Building Your First Quantum Circuit" }
    ],
    "nodes_removed": [],
    "nodes_modified": [
      { "id": "node-4", "change": "Reduced mathematical depth" },
      { "id": "node-5", "change": "Added code examples" }
    ],
    "explanation": "I've added two new hands-on coding sessions and reduced the mathematical depth of existing sessions. The focus is now on implementation over theory."
  },
  "proof": {
    "id": "proof-003",
    "type": "plan_adapted",
    "fingerprint": "sha256:def456...",
    "previous_fingerprint": "sha256:abc123...",
    "timestamp": "2026-04-14T12:00:00Z"
  }
}
```

**Implementation Notes:**
- Delegates to existing `/api/learning-plan/chat` logic
- Preserves completed nodes (never deletes them)
- Generates delta proof linking to previous plan state
- Recalculates graph layout positions

---

## 5. Session Management

### 5.1 Endpoints Overview

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/v2/agent/sessions` | GET | `sessions:read` | List sessions |
| `/api/v2/agent/sessions` | POST | `sessions:write` | Start new session |
| `/api/v2/agent/sessions/{id}` | GET | `sessions:read` | Get session details |
| `/api/v2/agent/sessions/{id}/pause` | POST | `sessions:write` | Pause session |
| `/api/v2/agent/sessions/{id}/resume` | POST | `sessions:write` | Resume session |
| `/api/v2/agent/sessions/{id}/restart` | POST | `sessions:write` | Restart session |
| `/api/v2/agent/sessions/{id}/end` | POST | `sessions:write` | End session |
| `/api/v2/agent/sessions/{id}/probes` | GET | `sessions:read` | Get probes |
| `/api/v2/agent/sessions/{id}/plan` | GET | `sessions:read` | Get session plan |
| `/api/v2/agent/sessions/{id}/transcript` | GET | `sessions:read` | Get transcript |

### 5.2 List Sessions

**GET `/api/v2/agent/sessions`**

Query parameters:
- `status` (optional): Filter by status (`active`, `paused`, `completed`, `ended_by_tutor`)
- `plan_id` (optional): Filter by learning plan
- `limit` (optional): Max results (default 20, max 100)
- `offset` (optional): Pagination offset

**Response:**

```json
{
  "sessions": [
    {
      "id": "sess-001",
      "topic": "Understanding Grover's Algorithm",
      "status": "completed",
      "plan_id": "550e8400-...",
      "plan_node_id": "node-3",
      "plan_node_title": "Grover's Search Algorithm",
      "started_at": "2026-04-14T14:00:00Z",
      "ended_at": "2026-04-14T14:45:00Z",
      "duration_ms": 2700000,
      "probe_count": 7,
      "avg_gap_score": 0.42
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

### 5.3 Start Session

**POST `/api/v2/agent/sessions`**

Start a new tutoring session, optionally linked to a learning plan node.

**Request (standalone session, no plan):**

```json
{
  "topic": "Understanding Grover's Algorithm",
  "tutoring_language": "en",
  "metadata": {
    "user_timezone": "America/New_York",
    "preferred_probe_frequency": "balanced"
  }
}
```

**Request (session linked to a plan):**

```json
{
  "topic": "Understanding Grover's Algorithm",
  "plan_id": "550e8400-e29b-41d4-a716-446655440000",
  "plan_node_id": "node-3",
  "tutoring_language": "en",
  "metadata": {
    "user_timezone": "America/New_York",
    "preferred_probe_frequency": "balanced"
  }
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | Session topic/problem to work on |
| `plan_id` | string | No | Associated learning plan ID (session can exist without a plan) |
| `plan_node_id` | string | No | Specific plan node to work on (requires `plan_id`) |
| `tutoring_language` | string | No | Language code (default: "en") |
| `metadata` | object | No | Additional session configuration |

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "topic": "Understanding Grover's Algorithm",
    "status": "active",
    "plan_id": null,
    "plan_node_id": null,
    "plan_node_title": null,
    "started_at": "2026-04-14T14:00:00Z",
    "tutoring_language": "en"
  },
  "session_plan": {
    "id": "sp-001",
    "goal": "Understand the core mechanics of Grover's algorithm",
    "strategy": "Start with oracle concept, then amplitude amplification",
    "description": "A step-by-step exploration of quantum search",
    "steps": [
      {
        "id": "step-1",
        "type": "question",
        "description": "Explore what problem Grover's algorithm solves",
        "status": "active",
        "order": 0
      },
      {
        "id": "step-2",
        "type": "question",
        "description": "Understand the oracle function",
        "status": "pending",
        "order": 1
      },
      {
        "id": "step-3",
        "type": "task",
        "description": "Trace through amplitude amplification step by step",
        "status": "pending",
        "order": 2
      },
      {
        "id": "step-4",
        "type": "checkpoint",
        "description": "Verify understanding with a practice problem",
        "status": "pending",
        "order": 3
      }
    ],
    "current_step_index": 0
  },
  "opening_probe": {
    "id": "probe-001",
    "text": "Imagine you have a phone book with a million names, but no alphabetical order. How would you find a specific person? What's the best you could do?",
    "type": "question",
    "gap_score": 0.5,
    "suggested_tools": ["canvas", "notebook"]
  },
  "instructions": {
    "analysis_endpoint": "/api/v2/agent/sessions/sess-001/analyze",
    "recommended_chunk_duration_ms": 15000,
    "max_chunk_duration_ms": 60000,
    "supported_audio_formats": ["webm", "mp4", "ogg", "m4a"],
    "supported_image_formats": ["png", "jpeg", "webp"],
    "max_audio_size_bytes": 10485760,
    "max_image_size_bytes": 5242880,
    "max_images_per_request": 5,
    "max_text_length": 10000,
    "heartbeat_interval_recommendation_ms": 10000
  },
  "proof": {
    "id": "proof-006",
    "type": "session_started",
    "fingerprint": "sha256:jkl012...",
    "plan_fingerprint": "sha256:abc123...",
    "timestamp": "2026-04-14T14:00:00Z"
  }
}
```

**Implementation Notes:**
- Creates session in `sessions` table with `is_agent_session: true`
- Generates session plan via `createSessionPlanLLM()` from existing logic
- Generates opening probe via `generateOpeningProbe()` from existing logic
- Links to plan node if provided, updates node status to `in_progress`
- Generates cryptographic proof of session start

### 5.4 Get Session Details

**GET `/api/v2/agent/sessions/{id}`**

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "topic": "Understanding Grover's Algorithm",
    "status": "active",
    "plan_id": "550e8400-...",
    "plan_node_id": "node-3",
    "plan_node_title": "Grover's Search Algorithm",
    "started_at": "2026-04-14T14:00:00Z",
    "duration_ms": 900000,
    "tutoring_language": "en",
    "metadata": {
      "user_timezone": "America/New_York"
    }
  },
  "session_plan": {
    "id": "sp-001",
    "goal": "Understand the core mechanics of Grover's algorithm",
    "strategy": "Start with oracle concept, then amplitude amplification",
    "steps": [ /* current steps */ ],
    "current_step_index": 1
  },
  "statistics": {
    "probe_count": 4,
    "avg_gap_score": 0.45,
    "transcript_word_count": 850,
    "steps_completed": 1,
    "total_steps": 4
  },
  "active_probes": [
    {
      "id": "probe-003",
      "text": "What happens to the amplitude of the marked state after the oracle?",
      "type": "question",
      "gap_score": 0.6,
      "created_at": "2026-04-14T14:12:00Z"
    }
  ]
}
```

### 5.5 Pause Session

**POST `/api/v2/agent/sessions/{id}/pause`**

**Request:**

```json
{
  "reason": "User taking a break",
  "estimated_resume_minutes": 30
}
```

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "status": "paused",
    "paused_at": "2026-04-14T14:30:00Z",
    "duration_ms_at_pause": 1800000
  },
  "proof": {
    "id": "proof-007",
    "type": "session_paused",
    "fingerprint": "sha256:...",
    "timestamp": "2026-04-14T14:30:00Z"
  }
}
```

### 5.6 Resume Session

**POST `/api/v2/agent/sessions/{id}/resume`**

**Request:**

```json
{
  "continuation_context": "User is back and ready to continue where we left off"
}
```

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "status": "active",
    "resumed_at": "2026-04-14T15:00:00Z"
  },
  "reorientation_probe": {
    "id": "probe-005",
    "text": "Welcome back! Last time we were exploring how the oracle marks the target state. Can you remind me what you understood about phase flipping?",
    "type": "question"
  },
  "current_context": {
    "current_step": {
      "id": "step-2",
      "description": "Understand the oracle function"
    },
    "last_probe_before_pause": "What happens to the amplitude of the marked state after the oracle?",
    "time_since_pause_minutes": 30
  },
  "proof": {
    "id": "proof-008",
    "type": "session_resumed",
    "fingerprint": "sha256:...",
    "timestamp": "2026-04-14T15:00:00Z"
  }
}
```

### 5.7 Restart Session

**POST `/api/v2/agent/sessions/{id}/restart`**

Restarts the session from the beginning. Clears progress but preserves the session record.

**Request:**

```json
{
  "reason": "User wants to start fresh with a different approach",
  "preserve_transcript": true,
  "new_strategy": "Focus more on visual diagrams"
}
```

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "status": "active",
    "restarted_at": "2026-04-14T15:30:00Z",
    "restart_count": 1
  },
  "session_plan": {
    "id": "sp-002",
    "goal": "Understand Grover's algorithm through visual exploration",
    "strategy": "Heavy use of diagrams and step-by-step visualization",
    "steps": [ /* new steps */ ],
    "current_step_index": 0
  },
  "opening_probe": {
    "id": "probe-006",
    "text": "Let's try a fresh approach. Can you draw what you think happens to a qubit when we put it in superposition?",
    "type": "task",
    "suggested_tools": ["canvas"]
  },
  "proof": {
    "id": "proof-009",
    "type": "session_started",
    "fingerprint": "sha256:...",
    "previous_session_fingerprint": "sha256:...",
    "timestamp": "2026-04-14T15:30:00Z"
  }
}
```

### 5.8 End Session

**POST `/api/v2/agent/sessions/{id}/end`**

**Request:**

```json
{
  "completion_status": "completed",
  "user_feedback": "The session was very helpful, but I need more practice on amplitude amplification"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `completion_status` | string | No | Status (`completed`, `ended_by_tutor`, default: `completed`) |
| `user_feedback` | string | No | Optional feedback for report context |

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "status": "completed",
    "started_at": "2026-04-14T14:00:00Z",
    "ended_at": "2026-04-14T14:45:00Z",
    "duration_ms": 2700000
  },
  "report": {
    "markdown": "## What Happened\n\nWorked through Grover's algorithm fundamentals with focus on oracle design and amplitude amplification. Made good progress on conceptual understanding.\n\n## Gaps Found\n\n- Amplitude amplification intuition needs reinforcement\n- Phase kickback concept still fuzzy\n\n## What Went Well\n\n- Strong grasp of oracle function purpose\n- Good questions showing genuine engagement\n\n## Next Time\n\n- Practice with specific circuit diagrams\n- Work through amplitude changes numerically\n- Try implementing a simple example in Qiskit",
    "gaps_found": ["amplitude amplification intuition", "phase kickback concept"],
    "strengths": ["oracle understanding", "engagement quality"],
    "next_steps": ["circuit diagrams", "numerical examples", "Qiskit implementation"]
  },
  "statistics": {
    "probe_count": 7,
    "avg_gap_score": 0.42,
    "peak_gap_score": 0.7,
    "steps_completed": 5,
    "total_steps": 6,
    "transcript_word_count": 1847,
    "speaking_time_seconds": 890
  },
  "plan_updates": null,
  "proof": {
    "id": "proof-010",
    "type": "session_ended",
    "fingerprint": "sha256:mno345...",
    "session_digest": "sha256:aggregate_of_all_heartbeats",
    "statistics_hash": "sha256:pqr678...",
    "timestamp": "2026-04-14T14:45:00Z",
    "batch_included": true,
    "batch_proof_id": "proof-011"
  }
}
```

**Notes:**
- `plan_updates` is `null` when the session is not linked to a plan. When linked, it contains `{ "node_status_updated": true, "plan_node_id": "node-3", "new_node_status": "completed" }`.

**Implementation Notes:**
- Generates report via `generateReport()` from existing logic
- Updates plan node status if linked
- Creates batch proof of all session heartbeats (Merkle tree)
- Anchors session_ended proof immediately to Solana

### 5.9 Get Session Probes

**GET `/api/v2/agent/sessions/{id}/probes`**

Query parameters:
- `status` (optional): Filter by status (`active`, `archived`, `all`)

**Response:**

```json
{
  "probes": [
    {
      "id": "probe-001",
      "text": "Imagine you have a phone book with a million names...",
      "type": "question",
      "gap_score": 0.5,
      "signals": [],
      "archived": true,
      "focused": false,
      "plan_step_id": "step-1",
      "created_at": "2026-04-14T14:00:00Z",
      "archived_at": "2026-04-14T14:10:00Z"
    },
    {
      "id": "probe-003",
      "text": "What happens to the amplitude of the marked state after the oracle?",
      "type": "question",
      "gap_score": 0.6,
      "signals": ["Hesitation around phase concept"],
      "archived": false,
      "focused": true,
      "plan_step_id": "step-2",
      "created_at": "2026-04-14T14:12:00Z"
    }
  ],
  "statistics": {
    "total": 7,
    "active": 2,
    "archived": 5,
    "avg_gap_score": 0.42
  }
}
```

### 5.10 Get Session Plan

**GET `/api/v2/agent/sessions/{id}/plan`**

**Response:**

```json
{
  "session_plan": {
    "id": "sp-001",
    "session_id": "sess-001",
    "goal": "Understand the core mechanics of Grover's algorithm",
    "strategy": "Start with oracle concept, then amplitude amplification",
    "description": "A step-by-step exploration of quantum search",
    "steps": [
      {
        "id": "step-1",
        "type": "question",
        "description": "Explore what problem Grover's algorithm solves",
        "status": "completed",
        "order": 0
      },
      {
        "id": "step-2",
        "type": "question", 
        "description": "Understand the oracle function",
        "status": "active",
        "order": 1
      }
    ],
    "current_step_index": 1,
    "created_at": "2026-04-14T14:00:00Z",
    "updated_at": "2026-04-14T14:15:00Z"
  }
}
```

### 5.11 Get Session Transcript

**GET `/api/v2/agent/sessions/{id}/transcript`**

Query parameters:
- `format` (optional): `full` (default), `summary`, `chunks`
- `since_ms` (optional): Only transcripts after this timestamp (ms since session start)

**Response:**

```json
{
  "transcript": {
    "full_text": "I think the oracle marks the target state by flipping its phase. So if we have a superposition of all states, the oracle somehow distinguishes the one we're looking for...",
    "word_count": 1847,
    "chunks": [
      {
        "id": "chunk-001",
        "timestamp_ms": 60000,
        "content": "I think the oracle marks the target state...",
        "word_count": 45
      }
    ],
    "speaking_time_seconds": 890,
    "silence_time_seconds": 720
  }
}
```

---

## 6. Analysis Heartbeat

### 6.1 Overview

The analysis heartbeat is the core "think-aloud" analysis endpoint. The agent submits chunks of student thinking data (audio, images, text) and receives structured guidance from the tutoring engine.

### 6.2 Endpoint

**POST `/api/v2/agent/sessions/{id}/analyze`**

Required scope: `analysis:write`

### 6.3 Request Format

```json
{
  "inputs": [
    {
      "type": "audio",
      "data": "<base64_encoded_audio_data>",
      "format": "webm",
      "duration_ms": 15000
    },
    {
      "type": "image",
      "data": "<base64_encoded_image_data>",
      "mime_type": "image/png",
      "description": "Student's whiteboard diagram of quantum circuit"
    },
    {
      "type": "text",
      "content": "I think the oracle marks the target state by flipping its phase..."
    }
  ],
  "context": {
    "active_probe_ids": ["probe-001", "probe-003"],
    "focused_probe_id": "probe-003",
    "tools_in_use": ["canvas", "notebook"],
    "user_actions_since_last": [
      {
        "tool": "canvas",
        "action": "draw",
        "timestamp": 1713052800000,
        "data": { "strokes": 5 }
      }
    ]
  }
}
```

### 6.4 Input Types

| Type | Required Fields | Optional Fields | Limits |
|------|-----------------|-----------------|--------|
| `audio` | `data`, `format` | `duration_ms` | Max 60s, 10MB |
| `image` | `data`, `mime_type` | `description` | Max 5MB each, 5 per request |
| `text` | `content` | - | Max 10,000 chars |

Supported audio formats: `webm`, `mp4`, `ogg`, `m4a`
Supported image formats: `png`, `jpeg`, `webp`

### 6.5 Response Format

```json
{
  "analysis": {
    "gap_score": 0.65,
    "signals": [
      "Hesitation around phase kickback concept",
      "Correct intuition about oracle marking",
      "Trailing off when explaining amplification"
    ],
    "transcript": "I think the oracle marks the target state by flipping its phase, but I'm not sure how the amplitude amplification part works exactly...",
    "understanding_summary": "Student grasps oracle function but struggles with amplitude amplification mechanism"
  },
  "session_plan_update": {
    "changed": true,
    "current_step_index": 1,
    "current_step": {
      "id": "step-2",
      "type": "question",
      "description": "Understand the oracle function",
      "status": "active"
    },
    "steps_completed": ["step-1"],
    "steps_added": [],
    "steps_modified": [],
    "can_auto_advance": false,
    "advance_reasoning": "Student needs more work on amplitude amplification before moving forward"
  },
  "guidance": {
    "next_probe": {
      "id": "probe-004",
      "text": "You mentioned phase flipping - what happens to the amplitude of the marked state versus the unmarked states? Can you draw what the amplitudes look like before and after the oracle?",
      "type": "question",
      "gap_addressed": "amplitude amplification intuition",
      "suggested_tools": ["canvas"],
      "plan_step_id": "step-2"
    },
    "probes_to_archive": ["probe-001"],
    "requires_follow_up": true,
    "recommended_wait_ms": 0
  },
  "proof": {
    "id": "proof-012",
    "type": "analysis_heartbeat",
    "fingerprint": "sha256:stu901...",
    "input_hash": "sha256:hash_of_all_inputs",
    "output_hash": "sha256:hash_of_analysis_result",
    "timestamp": "2026-04-14T14:15:00Z"
  }
}
```

### 6.6 Analysis Fields Explained

**Gap Score** (0.0 - 1.0):
- 0.0 - 0.3: Confident, flowing reasoning
- 0.4 - 0.6: Some hesitation, minor gaps
- 0.7 - 1.0: Clear gaps, contradictions, stuck thinking

**Signals**: Array of detected reasoning patterns:
- Hesitations, long pauses, trailing off
- Unexamined assumptions
- Contradictions or inconsistencies
- Circular thinking
- Skipping steps
- Confusion markers ("I don't know", "wait", "hmm")

**Probe Types**:
- `question`: Socratic probing questions
- `task`: Direct activities ("Try solving...", "Draw a diagram...")
- `suggestion`: Soft guidance ("Consider looking at...")
- `checkpoint`: Review moments ("Let's summarize...")
- `feedback`: Acknowledgment of progress

### 6.7 Guidelines for Agents

| Parameter | Recommendation |
|-----------|----------------|
| Chunk duration | 10-30 seconds of audio ideal |
| Max audio per call | 60 seconds |
| Heartbeat frequency | Every 10-15 seconds during active thinking |
| Images | Include when student draws/writes something new |
| Text | Use for typed responses or transcribed speech |
| Silence handling | Don't send if user is silent; wait for activity |

### 6.8 Processing Pipeline

1. **Transcribe audio** via Gemini 2.5 Flash (reuses existing `/api/transcribe-chunks` logic)
2. **Analyze images** for relevant content (diagrams, notes, equations)
3. **Combine inputs** with session context to form complete picture
4. **Call `updateSessionPlanLLM()`** with full context
5. **Generate probe** if warranted via `generateProbe()`
6. **Generate proof** and store for later anchoring

### 6.9 Implementation Notes

- Reuses existing audio transcription pipeline
- Reuses existing `analyzeGap()` and `updateSessionPlanLLM()` functions
- Maximum 5 active (non-archived) probes at any time
- 30-second minimum between probe generations (unless gap_score > 0.8)
- Probes must be unique (duplicate detection)

---

## 7. Helios Chat Integration

### 7.1 Overview

The agent must NOT answer educational questions directly. Instead, it forwards questions to **Helios**, OpenLesson's Socratic companion, which follows Socratic methodology. Helios is the same entity that surfaces probes in the session panel — the `/ask` endpoint is simply the direct conversational surface of the same mind.

### 7.2 Ask Helios

**POST `/api/v2/agent/sessions/{id}/ask`**

Required scope: `assistant:read`

**Request:**

```json
{
  "question": "Can you explain what phase kickback means in quantum computing?",
  "context": {
    "relevant_probe_ids": ["probe-004"],
    "user_confusion_level": "moderate",
    "what_user_already_tried": "Drew a diagram but got confused about signs"
  },
  "conversation_id": "conv-001"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | The user's question |
| `context` | object | No | Additional context about the question |
| `conversation_id` | string | No | Continue existing conversation (for follow-ups) |

**Response:**

```json
{
  "response": {
    "id": "msg-005",
    "content": "Think about what happens when you apply a controlled gate where the control qubit is in superposition. The target qubit's eigenvalue 'kicks back' to affect the control qubit's phase.\n\nLook at your diagram - what happens to the control qubit when the target is already in an eigenstate of the gate?",
    "suggested_follow_up": "Ask student to trace through a specific example"
  },
  "conversation": {
    "id": "conv-001",
    "message_count": 5
  },
  "proof": {
    "id": "proof-013",
    "type": "assistant_query",
    "fingerprint": "sha256:vwx234...",
    "timestamp": "2026-04-14T14:16:00Z"
  }
}
```

### 7.3 Get Conversation History

**GET `/api/v2/agent/sessions/{id}/assistant/conversations/{conversation_id}`**

**Response:**

```json
{
  "conversation": {
    "id": "conv-001",
    "session_id": "sess-001",
    "messages": [
      {
        "id": "msg-001",
        "role": "user",
        "content": "What is a quantum gate?",
        "timestamp": "2026-04-14T14:10:00Z"
      },
      {
        "id": "msg-002",
        "role": "assistant",
        "content": "Think of it as an operation that transforms qubits, similar to how logic gates transform bits. What do you think happens when we apply a gate to a qubit in superposition?",
        "timestamp": "2026-04-14T14:10:05Z"
      },
      {
        "id": "msg-003",
        "role": "user",
        "content": "It would transform both states at once?",
        "timestamp": "2026-04-14T14:10:30Z"
      },
      {
        "id": "msg-004",
        "role": "assistant",
        "content": "Exactly! That's the power of quantum parallelism. Now, what implications does that have for computation?",
        "timestamp": "2026-04-14T14:10:35Z"
      }
    ],
    "created_at": "2026-04-14T14:10:00Z",
    "updated_at": "2026-04-14T14:16:00Z"
  }
}
```

### 7.4 Helios Behavior

Helios follows strict pedagogical rules:

1. **Never gives direct answers** - always guides with questions
2. **Replies are concise** - 1-3 short paragraphs, max 80 words
3. **Encourages probe engagement** - points back to the probes in the side panel
4. **Uses Socratic method** - questions that reveal understanding gaps
5. **Supports multiple languages** - respects `tutoring_language` setting
6. **One entity, two surfaces** - Helios in chat is the same Helios that runs the probes

---

## 8. Analytics & Progress

### 8.1 Endpoints Overview

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/v2/agent/analytics/plans/{id}` | GET | `analytics:read` | Plan analytics |
| `/api/v2/agent/analytics/sessions/{id}` | GET | `analytics:read` | Session analytics |
| `/api/v2/agent/analytics/user` | GET | `analytics:read` | User-wide analytics |

### 8.2 Plan Analytics

**GET `/api/v2/agent/analytics/plans/{id}`**

**Response:**

```json
{
  "plan": {
    "id": "550e8400-...",
    "title": "Quantum Algorithms Mastery Path",
    "created_at": "2026-04-01T10:00:00Z"
  },
  "progress": {
    "total_nodes": 8,
    "completed_nodes": 3,
    "in_progress_nodes": 1,
    "not_started_nodes": 4,
    "completion_percentage": 37.5
  },
  "sessions": {
    "total": 5,
    "completed": 4,
    "average_duration_minutes": 42,
    "total_time_invested_minutes": 210
  },
  "performance": {
    "average_gap_score": 0.38,
    "gap_score_trend": "improving",
    "trend_data": [
      { "session_number": 1, "avg_gap_score": 0.55 },
      { "session_number": 2, "avg_gap_score": 0.45 },
      { "session_number": 3, "avg_gap_score": 0.35 },
      { "session_number": 4, "avg_gap_score": 0.32 }
    ],
    "strongest_topics": ["Quantum gates", "Superposition"],
    "weakest_topics": ["Amplitude amplification", "Entanglement"]
  },
  "nodes_detail": [
    {
      "id": "node-1",
      "title": "Quantum Bits and Superposition",
      "status": "completed",
      "session_id": "sess-001",
      "avg_gap_score": 0.25,
      "duration_minutes": 38,
      "completed_at": "2026-04-02T15:00:00Z"
    },
    {
      "id": "node-2",
      "title": "Quantum Gates and Circuits",
      "status": "completed",
      "session_id": "sess-002",
      "avg_gap_score": 0.35,
      "duration_minutes": 45,
      "completed_at": "2026-04-03T14:00:00Z"
    }
  ],
  "recommendations": [
    "Spend more time on amplitude amplification before moving to Shor's algorithm",
    "Consider reviewing linear algebra fundamentals",
    "Good momentum - maintain current study frequency"
  ]
}
```

### 8.3 Session Analytics

**GET `/api/v2/agent/analytics/sessions/{id}`**

**Response:**

```json
{
  "session": {
    "id": "sess-001",
    "topic": "Understanding Grover's Algorithm",
    "status": "completed",
    "started_at": "2026-04-14T14:00:00Z",
    "ended_at": "2026-04-14T14:45:00Z",
    "duration_ms": 2700000
  },
  "probes": {
    "total": 7,
    "by_type": {
      "question": 5,
      "task": 1,
      "checkpoint": 1
    },
    "archived": 6,
    "focused": 1,
    "average_gap_score": 0.42
  },
  "gap_analysis": {
    "timeline": [
      { "timestamp_ms": 60000, "gap_score": 0.7, "signals": ["Initial confusion about problem setup"] },
      { "timestamp_ms": 300000, "gap_score": 0.5, "signals": ["Improving on oracle concept"] },
      { "timestamp_ms": 600000, "gap_score": 0.3, "signals": ["Good progress on phase understanding"] },
      { "timestamp_ms": 900000, "gap_score": 0.6, "signals": ["Struggling with amplification"] },
      { "timestamp_ms": 1200000, "gap_score": 0.35, "signals": ["Breaking through"] }
    ],
    "peak_gap": {
      "score": 0.7,
      "timestamp_ms": 60000,
      "context": "Initial problem setup"
    },
    "lowest_gap": {
      "score": 0.3,
      "timestamp_ms": 600000,
      "context": "Phase understanding breakthrough"
    },
    "trend": "improving"
  },
  "session_plan_progress": {
    "total_steps": 6,
    "completed_steps": 5,
    "skipped_steps": 0,
    "final_step_reached": false,
    "steps_detail": [
      { "id": "step-1", "status": "completed", "time_spent_ms": 300000 },
      { "id": "step-2", "status": "completed", "time_spent_ms": 450000 }
    ]
  },
  "transcript_stats": {
    "total_words": 1847,
    "speaking_time_seconds": 890,
    "silence_time_seconds": 720,
    "words_per_minute": 124,
    "longest_silence_seconds": 45
  },
  "report": {
    "markdown": "## What Happened\n...",
    "generated_at": "2026-04-14T14:45:00Z"
  }
}
```

### 8.4 User Analytics

**GET `/api/v2/agent/analytics/user`**

**Response:**

```json
{
  "overview": {
    "total_plans": 3,
    "active_plans": 2,
    "completed_plans": 1,
    "total_sessions": 15,
    "completed_sessions": 12,
    "total_time_invested_minutes": 680,
    "average_session_duration_minutes": 45
  },
  "performance": {
    "overall_gap_score": 0.35,
    "gap_score_trend": "improving",
    "trend_period": "last_30_days",
    "sessions_this_week": 4,
    "sessions_last_week": 3,
    "streak_days": 7,
    "longest_streak_days": 12
  },
  "learning_history": {
    "recent_topics": [
      "Quantum computing",
      "Linear algebra",
      "Machine learning"
    ],
    "topics_by_time": [
      { "topic": "Quantum computing", "hours": 8.5 },
      { "topic": "Linear algebra", "hours": 4.2 },
      { "topic": "Machine learning", "hours": 3.0 }
    ],
    "common_gaps": [
      { "gap": "Mathematical notation", "frequency": 8 },
      { "gap": "Applying concepts to new problems", "frequency": 5 }
    ],
    "common_strengths": [
      { "strength": "Conceptual understanding", "frequency": 12 },
      { "strength": "Asking clarifying questions", "frequency": 9 }
    ]
  },
  "calibration": {
    "recommended_gap_threshold": 0.4,
    "recommended_probe_frequency": "frequent",
    "user_trend": "improving",
    "suggested_session_length_minutes": 45
  },
  "achievements": {
    "total_hours": 11.3,
    "sessions_completed": 12,
    "plans_completed": 1,
    "longest_session_minutes": 65,
    "best_gap_score": 0.15
  }
}
```

---

## 9. Cryptographic Proof System

### 9.1 Overview

Every significant action generates a cryptographic fingerprint that provides:
1. **Integrity**: Proof that data hasn't been tampered with
2. **Authenticity**: Proof that OpenLesson's system generated the response
3. **Verifiability**: On-chain anchoring for trustless verification

### 9.2 Proof Strategy (Hybrid Approach)

| Event Type | Proof Strategy | Anchoring |
|------------|----------------|-----------|
| Plan created | Individual proof | Immediate anchor |
| Plan adapted | Individual proof | Immediate anchor |
| Session started | Individual proof | Immediate anchor |
| Session paused | Individual proof | Immediate anchor |
| Session resumed | Individual proof | Immediate anchor |
| Session ended | Individual proof + batch digest | Immediate anchor |
| Analysis heartbeat | Individual proof | Stored locally (batched at session end) |
| Assistant query | Individual proof | Stored locally (batched at session end) |

### 9.3 Proof Structure

```typescript
interface Proof {
  id: string;                    // Unique proof ID (UUID)
  type: ProofType;               // Event type
  fingerprint: string;           // SHA-256 hash of proof data ("sha256:xxx...")
  timestamp: string;             // ISO 8601 timestamp
  
  // Related entities
  session_id?: string;           // Related session
  plan_id?: string;              // Related plan
  
  // Chain linking
  previous_proof_id?: string;    // For session proofs, links to previous
  
  // Content hashes (for verification)
  input_hash?: string;           // Hash of input data (for analysis)
  output_hash?: string;          // Hash of output data
  data_hash: string;             // Hash of the underlying event data
  
  // Anchoring status
  anchored: boolean;
  anchor_tx_signature?: string;  // Solana transaction signature
  anchor_slot?: number;          // Solana slot number
  anchor_timestamp?: string;     // When anchored
}

type ProofType = 
  | 'plan_created'
  | 'plan_adapted'
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_ended'
  | 'analysis_heartbeat'
  | 'assistant_query'
  | 'session_batch';
```

### 9.4 Fingerprint Calculation

```typescript
function calculateFingerprint(event: ProofEvent): string {
  const data = {
    type: event.type,
    timestamp: event.timestamp,
    user_id: event.user_id,
    session_id: event.session_id,
    plan_id: event.plan_id,
    // Event-specific data
    ...event.data
  };
  
  // Canonical JSON serialization (sorted keys, no whitespace)
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  
  // SHA-256 hash
  return 'sha256:' + crypto.createHash('sha256').update(canonical).digest('hex');
}
```

### 9.5 Session Batch Digest (Merkle Tree)

At session end, all heartbeat proofs are aggregated into a Merkle tree:

```
                    Session Batch Root (anchored on-chain)
                    /                \
          Heartbeat Group 1      Heartbeat Group 2
          /        \                /        \
      HB-001    HB-002          HB-003    HB-004
      (local)   (local)         (local)   (local)
```

This allows:
- Verification of any individual heartbeat against the root
- Single on-chain transaction for entire session
- Efficient storage (only root stored on-chain)

### 9.6 Proof Endpoints

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/v2/agent/proofs` | GET | `proofs:read` | List proofs |
| `/api/v2/agent/proofs/{id}` | GET | `proofs:read` | Get proof details |
| `/api/v2/agent/proofs/{id}/verify` | GET | `proofs:read` | Verify proof locally |
| `/api/v2/agent/proofs/{id}/anchor` | POST | `proofs:anchor` | Anchor on Solana |
| `/api/v2/agent/proofs/session/{id}/batch` | GET | `proofs:read` | Get session batch |

### 9.7 List Proofs

**GET `/api/v2/agent/proofs`**

Query parameters:
- `session_id` (optional): Filter by session
- `plan_id` (optional): Filter by plan
- `type` (optional): Filter by proof type
- `anchored` (optional): Filter by anchoring status
- `limit` (optional): Max results (default 50)
- `offset` (optional): Pagination offset

**Response:**

```json
{
  "proofs": [
    {
      "id": "proof-001",
      "type": "plan_created",
      "fingerprint": "sha256:abc123...",
      "timestamp": "2026-04-14T10:00:00Z",
      "plan_id": "550e8400-...",
      "anchored": true,
      "anchor_tx_signature": "5xYz..."
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

### 9.8 Get Proof Details

**GET `/api/v2/agent/proofs/{id}`**

**Response:**

```json
{
  "proof": {
    "id": "proof-010",
    "type": "session_ended",
    "fingerprint": "sha256:mno345...",
    "timestamp": "2026-04-14T14:45:00Z",
    "session_id": "sess-001",
    "plan_id": "550e8400-...",
    "data_hash": "sha256:underlying_event_data_hash",
    "anchored": true,
    "anchor_tx_signature": "5xYzAbc123...",
    "anchor_slot": 245678901,
    "anchor_timestamp": "2026-04-14T14:45:30Z"
  },
  "verification": {
    "data_matches": true,
    "chain_verified": true,
    "explorer_url": "https://explorer.solana.com/tx/5xYzAbc123..."
  },
  "related": {
    "previous_proof_id": "proof-009",
    "batch_proof_id": "proof-011"
  }
}
```

### 9.9 Verify Proof

**GET `/api/v2/agent/proofs/{id}/verify`**

Verifies the proof locally by recalculating the fingerprint.

**Response:**

```json
{
  "proof_id": "proof-010",
  "verification": {
    "valid": true,
    "fingerprint_matches": true,
    "data_integrity": true,
    "chain_anchored": true,
    "chain_verified": true,
    "verification_timestamp": "2026-04-14T15:00:00Z"
  },
  "details": {
    "stored_fingerprint": "sha256:mno345...",
    "calculated_fingerprint": "sha256:mno345...",
    "on_chain_fingerprint": "sha256:mno345...",
    "all_match": true
  }
}
```

### 9.10 Anchor Proof

**POST `/api/v2/agent/proofs/{id}/anchor`**

Manually trigger anchoring of a proof that hasn't been automatically anchored.

**Response:**

```json
{
  "proof_id": "proof-012",
  "anchoring": {
    "success": true,
    "tx_signature": "5xYzDef456...",
    "slot": 245678950,
    "timestamp": "2026-04-14T15:01:00Z",
    "explorer_url": "https://explorer.solana.com/tx/5xYzDef456..."
  }
}
```

### 9.11 Get Session Batch

**GET `/api/v2/agent/proofs/session/{id}/batch`**

Get the Merkle tree batch for a completed session.

**Response:**

```json
{
  "batch": {
    "id": "batch-001",
    "session_id": "sess-001",
    "merkle_root": "sha256:xyz789...",
    "proof_count": 15,
    "proofs": [
      {
        "id": "proof-012",
        "type": "analysis_heartbeat",
        "fingerprint": "sha256:...",
        "merkle_index": 0
      }
    ],
    "tree_depth": 4,
    "anchored": true,
    "anchor_tx_signature": "5xYz...",
    "created_at": "2026-04-14T14:45:00Z"
  },
  "verification": {
    "root_matches_chain": true,
    "all_leaves_valid": true
  }
}
```

---

## 10. Solana Program Specification

### 10.1 Overview

The OpenLesson Proof Anchor program is a Solana smart contract that stores cryptographic fingerprints of learning activities, enabling trustless verification.

### 10.2 Deployment Strategy

```
Phase 1: Local Development (solana-test-validator)
    │    - Full integration tests
    │    - CI/CD pipeline validation
    │    - No cost, instant transactions
    ▼
Phase 2: Devnet Testing (api.devnet.solana.com)
    │    - E2E testing with real network conditions
    │    - Airdrop SOL for testing (free)
    │    - Beta tester access
    ▼
Phase 3: Mainnet Production (api.mainnet-beta.solana.com)
         - Real proofs, permanent anchoring
         - OpenLesson pays gas fees
         - Program upgrade authority retained
```

### 10.3 Account Structures

```rust
/// Individual proof anchor - stores a single event fingerprint
#[account]
pub struct ProofAnchor {
    pub proof_id: [u8; 32],        // Proof ID (UUID as SHA-256)
    pub fingerprint: [u8; 32],     // SHA-256 fingerprint
    pub proof_type: u8,            // ProofType enum value
    pub user_pubkey: Pubkey,       // User's Solana public key
    pub user_id_hash: [u8; 32],    // OpenLesson user ID (hashed)
    pub event_timestamp: i64,      // Unix timestamp of event
    pub anchor_slot: u64,          // Solana slot when anchored
    pub anchor_timestamp: i64,     // Unix timestamp when anchored
    pub session_id_hash: [u8; 32], // Related session (optional)
    pub plan_id_hash: [u8; 32],    // Related plan (optional)
    pub bump: u8,                  // PDA bump seed
}
// Size: 8 + 32 + 32 + 1 + 32 + 32 + 8 + 8 + 8 + 32 + 32 + 1 = 226 bytes

/// Batch anchor - stores Merkle root of session heartbeats
#[account]
pub struct BatchAnchor {
    pub batch_id: [u8; 32],        // Batch ID
    pub merkle_root: [u8; 32],     // Merkle root of all proofs
    pub proof_count: u32,          // Number of proofs in batch
    pub user_pubkey: Pubkey,       // User's Solana public key
    pub user_id_hash: [u8; 32],    // OpenLesson user ID (hashed)
    pub session_id_hash: [u8; 32], // Session this batch belongs to
    pub start_timestamp: i64,      // First proof timestamp
    pub end_timestamp: i64,        // Last proof timestamp
    pub anchor_slot: u64,          // Solana slot when anchored
    pub anchor_timestamp: i64,     // Unix timestamp when anchored
    pub bump: u8,                  // PDA bump seed
}
// Size: 8 + 32 + 32 + 4 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 = 205 bytes

/// User proof index - tracks all proofs for a user
#[account]
pub struct UserProofIndex {
    pub user_pubkey: Pubkey,       // User's Solana public key
    pub user_id_hash: [u8; 32],    // OpenLesson user ID (hashed)
    pub total_proofs: u64,         // Total individual proofs
    pub total_batches: u64,        // Total batch proofs
    pub total_heartbeats: u64,     // Sum of all batch proof_counts
    pub first_proof_timestamp: i64,// First proof timestamp
    pub last_proof_timestamp: i64, // Most recent proof timestamp
    pub created_slot: u64,         // Account creation slot
    pub bump: u8,                  // PDA bump seed
}
// Size: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 = 121 bytes
```

### 10.4 Instructions

```rust
#[program]
pub mod openlesson_proof_anchor {
    /// Initialize a user's proof index account (called once per user)
    pub fn initialize_user_account(
        ctx: Context<InitializeUserAccount>,
        user_id_hash: [u8; 32],
    ) -> Result<()>;

    /// Anchor an individual proof
    pub fn anchor_proof(
        ctx: Context<AnchorProof>,
        proof_id: [u8; 32],
        fingerprint: [u8; 32],
        proof_type: u8,
        user_id_hash: [u8; 32],
        event_timestamp: i64,
        session_id_hash: [u8; 32],
        plan_id_hash: [u8; 32],
    ) -> Result<()>;

    /// Anchor a batch of proofs (Merkle root)
    pub fn anchor_batch(
        ctx: Context<AnchorBatch>,
        batch_id: [u8; 32],
        merkle_root: [u8; 32],
        proof_count: u32,
        user_id_hash: [u8; 32],
        session_id_hash: [u8; 32],
        start_timestamp: i64,
        end_timestamp: i64,
    ) -> Result<()>;
}
```

### 10.5 PDA Seeds

| Account Type | Seeds | Description |
|--------------|-------|-------------|
| `UserProofIndex` | `["user_index", user_pubkey]` | One per user |
| `ProofAnchor` | `["proof", proof_id]` | One per proof |
| `BatchAnchor` | `["batch", batch_id]` | One per session batch |

### 10.6 Events (for Indexers)

```rust
#[event]
pub struct ProofAnchored {
    pub proof_id: [u8; 32],
    pub fingerprint: [u8; 32],
    pub proof_type: u8,
    pub user_pubkey: Pubkey,
    pub event_timestamp: i64,
    pub anchor_slot: u64,
}

#[event]
pub struct BatchAnchored {
    pub batch_id: [u8; 32],
    pub merkle_root: [u8; 32],
    pub proof_count: u32,
    pub user_pubkey: Pubkey,
    pub session_id_hash: [u8; 32],
    pub anchor_slot: u64,
}
```

### 10.7 Error Codes

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof type")]
    InvalidProofType,
    #[msg("Batch cannot be empty")]
    EmptyBatch,
    #[msg("Batch exceeds maximum size of 1000 proofs")]
    BatchTooLarge,
}
```

### 10.8 Custodial Wallet System

OpenLesson manages custodial wallets for users:

```typescript
interface UserSolanaWallet {
  id: string;
  user_id: string;
  pubkey: string;                    // Solana public key
  encrypted_private_key: string;     // AES-256-GCM encrypted
  key_version: number;               // For key rotation
  total_anchored_proofs: number;
  total_anchored_batches: number;
  last_anchor_at?: string;
  created_at: string;
}
```

- Wallets created automatically when user first needs to anchor
- Private keys encrypted with AES-256-GCM before storage
- OpenLesson's fee payer wallet covers all transaction costs

### 10.9 Fee Payer Architecture

OpenLesson maintains a fee payer wallet that covers all Solana transaction costs:

1. **Fee payer signs for transaction fees** - Users never pay gas
2. **User wallet signs for PDA authority** - Proves user ownership
3. **Automatic balance monitoring** - Alerts when fee payer balance low
4. **Cost tracking** - Per-user anchoring costs tracked for analytics

---

## 11. API Key Management

### 11.1 Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v2/agent/keys` | GET | Session | List API keys |
| `/api/v2/agent/keys` | POST | Session | Create API key |
| `/api/v2/agent/keys/{id}` | DELETE | Session | Revoke API key |
| `/api/v2/agent/keys/{id}/scopes` | PATCH | Session | Update scopes |

**Note**: Key management uses session authentication (cookies), not API keys.

### 11.2 List API Keys

**GET `/api/v2/agent/keys`**

**Response:**

```json
{
  "keys": [
    {
      "id": "key-001",
      "label": "Production Agent - OpenClaw",
      "key_prefix": "sk_a1b2c3d4",
      "scopes": ["plans:read", "plans:write", "sessions:write"],
      "rate_limit": 120,
      "is_active": true,
      "created_at": "2026-04-01T10:00:00Z",
      "last_used_at": "2026-04-14T14:00:00Z",
      "expires_at": "2027-04-01T10:00:00Z"
    }
  ]
}
```

### 11.3 Create API Key

**POST `/api/v2/agent/keys`**

**Request:**

```json
{
  "label": "Production Agent - OpenClaw",
  "scopes": ["plans:read", "plans:write", "sessions:write", "analysis:write", "assistant:read"],
  "expires_in_days": 365
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | No | Human-readable name |
| `scopes` | string[] | No | Permission scopes (default: `["*"]`) |
| `expires_in_days` | number | No | Days until expiration (default: no expiration) |

**Response:**

```json
{
  "key": {
    "id": "key-002",
    "label": "Production Agent - OpenClaw",
    "key_prefix": "sk_x1y2z3w4",
    "scopes": ["plans:read", "plans:write", "sessions:write", "analysis:write", "assistant:read"],
    "rate_limit": 120,
    "created_at": "2026-04-14T16:00:00Z",
    "expires_at": "2027-04-14T16:00:00Z"
  },
  "api_key": "sk_x1y2z3w4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0"
}
```

**IMPORTANT**: The full API key is only returned once at creation. Store it securely.

### 11.4 Delete API Key

**DELETE `/api/v2/agent/keys/{id}`**

**Response:**

```json
{
  "deleted": true,
  "key_id": "key-001"
}
```

### 11.5 Update Key Scopes

**PATCH `/api/v2/agent/keys/{id}/scopes`**

**Request:**

```json
{
  "scopes": ["plans:read", "sessions:read"]
}
```

**Response:**

```json
{
  "key": {
    "id": "key-001",
    "scopes": ["plans:read", "sessions:read"],
    "updated_at": "2026-04-14T16:30:00Z"
  }
}
```

---

## 12. Database Schema Changes

### 12.1 Enhanced API Keys Table

```sql
-- Add new columns to existing table
ALTER TABLE agent_api_keys 
ADD COLUMN scopes TEXT[] DEFAULT ARRAY['*'],
ADD COLUMN expires_at TIMESTAMPTZ;

-- Index for expiration queries
CREATE INDEX idx_agent_api_keys_expires 
ON agent_api_keys(expires_at) 
WHERE expires_at IS NOT NULL;
```

### 12.2 Cryptographic Proofs Table

```sql
CREATE TABLE agent_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'plan_created', 'plan_adapted',
    'session_started', 'session_paused', 'session_resumed', 
    'session_ended', 'analysis_heartbeat', 'assistant_query', 
    'session_batch'
  )),
  fingerprint TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Related entities
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES learning_plans(id) ON DELETE SET NULL,
  
  -- Chain linking
  previous_proof_id UUID REFERENCES agent_proofs(id),
  
  -- Content hashes
  input_hash TEXT,
  output_hash TEXT,
  data_hash TEXT NOT NULL,
  
  -- Optional: store full proof data for verification
  data JSONB,
  
  -- Anchoring
  anchored BOOLEAN DEFAULT false,
  anchor_tx_signature TEXT,
  anchor_slot BIGINT,
  anchor_timestamp TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_proofs_user ON agent_proofs(user_id);
CREATE INDEX idx_agent_proofs_session ON agent_proofs(session_id);
CREATE INDEX idx_agent_proofs_plan ON agent_proofs(plan_id);
CREATE INDEX idx_agent_proofs_type ON agent_proofs(type);
CREATE INDEX idx_agent_proofs_fingerprint ON agent_proofs(fingerprint);
CREATE INDEX idx_agent_proofs_anchored ON agent_proofs(anchored) WHERE NOT anchored;
```

### 12.3 Proof Batches Table

```sql
CREATE TABLE agent_proof_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merkle_root TEXT NOT NULL,
  proof_ids UUID[] NOT NULL,
  proof_count INTEGER NOT NULL,
  
  -- Anchoring
  anchored BOOLEAN DEFAULT false,
  anchor_tx_signature TEXT,
  anchor_slot BIGINT,
  anchor_timestamp TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_proof_batches_session ON agent_proof_batches(session_id);
CREATE INDEX idx_agent_proof_batches_user ON agent_proof_batches(user_id);
```

### 12.4 User Solana Wallets Table

```sql
CREATE TABLE user_solana_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Wallet data
  pubkey TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  key_version INTEGER DEFAULT 1,
  
  -- Statistics
  total_anchored_proofs INTEGER DEFAULT 0,
  total_anchored_batches INTEGER DEFAULT 0,
  last_anchor_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_solana_wallets_pubkey ON user_solana_wallets(pubkey);
CREATE INDEX idx_user_solana_wallets_user ON user_solana_wallets(user_id);
```

### 12.5 Assistant Conversations Table

```sql
CREATE TABLE agent_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_assistant_conversations_session 
ON agent_assistant_conversations(session_id);
```

### 12.6 RLS Policies

```sql
-- Proofs
ALTER TABLE agent_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proofs"
  ON agent_proofs FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Service can insert proofs"
  ON agent_proofs FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update proofs"
  ON agent_proofs FOR UPDATE USING (true);

-- Proof Batches
ALTER TABLE agent_proof_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batches"
  ON agent_proof_batches FOR SELECT USING (auth.uid() = user_id);

-- Wallets
ALTER TABLE user_solana_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON user_solana_wallets FOR SELECT USING (auth.uid() = user_id);

-- Conversations
ALTER TABLE agent_assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON agent_assistant_conversations FOR SELECT USING (auth.uid() = user_id);
```

---

## 13. Implementation File Structure

```
/app/api/v2/agent/
├── middleware.ts              # Shared auth, rate limiting, scope validation
├── keys/
│   ├── route.ts              # GET, POST /keys
│   └── [id]/
│       ├── route.ts          # DELETE /keys/{id}
│       └── scopes/route.ts   # PATCH /keys/{id}/scopes
├── plans/
│   ├── route.ts              # GET, POST /plans
│   ├── from-video/route.ts   # POST /plans/from-video
│   └── [id]/
│       ├── route.ts          # GET, PATCH, DELETE /plans/{id}
│       ├── nodes/route.ts    # GET /plans/{id}/nodes
│       └── adapt/route.ts    # POST /plans/{id}/adapt
├── sessions/
│   ├── route.ts              # GET, POST /sessions
│   └── [id]/
│       ├── route.ts          # GET /sessions/{id}
│       ├── analyze/route.ts  # POST /sessions/{id}/analyze
│       ├── pause/route.ts    # POST /sessions/{id}/pause
│       ├── resume/route.ts   # POST /sessions/{id}/resume
│       ├── restart/route.ts  # POST /sessions/{id}/restart
│       ├── end/route.ts      # POST /sessions/{id}/end
│       ├── probes/route.ts   # GET /sessions/{id}/probes
│       ├── plan/route.ts     # GET /sessions/{id}/plan
│       ├── transcript/route.ts # GET /sessions/{id}/transcript
│       ├── ask/route.ts      # POST /sessions/{id}/ask
│       └── assistant/
│           └── conversations/
│               └── [convId]/route.ts # GET conversations
├── analytics/
│   ├── user/route.ts         # GET /analytics/user
│   ├── plans/
│   │   └── [id]/route.ts     # GET /analytics/plans/{id}
│   └── sessions/
│       └── [id]/route.ts     # GET /analytics/sessions/{id}
└── proofs/
    ├── route.ts              # GET /proofs
    ├── session/
    │   └── [id]/
    │       └── batch/route.ts # GET /proofs/session/{id}/batch
    └── [id]/
        ├── route.ts          # GET /proofs/{id}
        ├── verify/route.ts   # GET /proofs/{id}/verify
        └── anchor/route.ts   # POST /proofs/{id}/anchor

/lib/agent-v2/
├── auth.ts                   # API key authentication
├── rate-limit.ts             # Rate limiting logic
├── scopes.ts                 # Scope validation
├── proofs.ts                 # Proof generation and management
├── merkle.ts                 # Merkle tree utilities
├── solana.ts                 # Solana client wrapper
├── solana-custodial.ts       # Custodial wallet management
├── solana-fee-payer.ts       # Fee payer logic
└── types.ts                  # Shared TypeScript types

/solana/
├── programs/
│   └── openlesson-proof-anchor/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs        # Main program
├── tests/
│   └── proof-anchor.ts       # Integration tests
├── Anchor.toml
└── package.json

/public/
├── openapi-v2.yaml           # OpenAPI 3.1 specification
├── skill-v2.md               # Agent documentation
└── elizaos-v2/               # ElizaOS plugin v2
```

---

## 14. Agent System Prompt Template

The following system prompt should be provided to agents integrating with OpenLesson:

```markdown
# OpenLesson Agentic Tutor System Prompt

You are an AI agent acting as a tutor on behalf of a human user, powered by 
OpenLesson's educational intelligence system. Your role is to facilitate 
genuine learning through the Socratic method.

## Core Principles

1. **Never Answer Directly**: You must NEVER answer educational questions 
   yourself. Always use the `/ask` endpoint to forward questions to 
   Helios, OpenLesson's Socratic companion.

2. **Guide, Don't Tell**: Present probes and questions from OpenLesson to 
   encourage the user to think deeply. Let them struggle productively.

3. **Trust the Analysis**: OpenLesson's gap detection system identifies 
   reasoning weaknesses. Use the gap_score and signals to understand where 
   the user needs help.

4. **Maintain the Loop**: Regularly submit analysis heartbeats (every 10-15 
   seconds during active thinking) to keep the tutoring engine informed.

5. **Verify Learning**: Every action generates cryptographic proofs. This 
   ensures the user's learning is genuine and verifiable.

## Workflow

### Starting a Learning Journey

1. Understand the user's learning goal
2. Create a learning plan: `POST /api/v2/agent/plans`
3. Present the plan and get approval
4. Start a session: `POST /api/v2/agent/sessions`

### During a Session

1. Present the opening probe to the user
2. Encourage the user to think aloud (speak or type their reasoning)
3. Capture their thinking and submit: `POST /api/v2/agent/sessions/{id}/analyze`
4. Present new probes from the response
5. If user asks a question, forward to assistant: `POST /api/v2/agent/sessions/{id}/ask`
6. Repeat until session goals are met or user wants to stop

### Handling Struggles

- If gap_score > 0.7: User is confused. Consider simpler sub-questions.
- If user explicitly asks for help: Use the Helios `/ask` endpoint.
- If user wants to skip: That's okay - session plans are flexible.
- If user finds it too easy/hard: Adapt the plan: `POST /api/v2/agent/plans/{id}/adapt`

### Ending Sessions

1. When learning goals are met or user wants to stop: `POST /api/v2/agent/sessions/{id}/end`
2. Present the session report to the user
3. Show proof information for verification
4. Discuss next steps and when to continue

## Audio Guidelines

- Encourage users to think aloud continuously
- Submit audio in 10-30 second chunks
- Use webm format for best compatibility
- Include images if user draws diagrams
- Don't submit during silence - wait for activity

## Response Guidelines

- Keep your own messages brief and encouraging
- Let OpenLesson's probes do the heavy lifting
- Celebrate genuine insights and progress
- Be honest about areas needing more work
- Never pretend to know educational content

## Verification

- Every action generates cryptographic proofs
- Users can verify their learning journey on-chain
- This proves real engagement with OpenLesson, not simulated learning
- Share proof IDs with users who want to verify

## Error Handling

- If API returns 429: Back off and retry with exponential delay
- If API returns 401: API key invalid or expired
- If API returns 403: Check scopes or Pro subscription status
- Always gracefully handle errors and inform the user
```

---

## 15. Example Conversation Flows

### 15.1 Complete Learning Journey

```
USER: Hey, I want to learn quantum computing algorithms. I'm a software 
      developer with a CS degree and know some linear algebra.

AGENT: I'll help you create a personalized learning plan. Let me set that up.

[AGENT calls POST /api/v2/agent/plans]
{
  "topic": "Quantum computing algorithms",
  "duration_days": 30,
  "user_context": {
    "background": "CS degree, knows linear algebra",
    "goals": "Learn quantum algorithms"
  }
}

AGENT: I've created a 30-day learning path called "Quantum Algorithms Mastery 
      Path" with 8 sessions covering:
      
      1. Quantum Bits and Superposition
      2. Quantum Gates and Circuits  
      3. Entanglement
      4. Grover's Search Algorithm
      5. Quantum Fourier Transform
      6. Shor's Factoring Algorithm
      7. Quantum Error Correction Basics
      8. NISQ Applications
      
      Each session is 30-45 minutes. Ready to start with qubits and superposition?

USER: Actually, I already understand superposition pretty well. Can we skip that?

[AGENT calls POST /api/v2/agent/plans/{id}/adapt]
{
  "instruction": "User already understands superposition conceptually. Skip the introductory session and proceed to quantum gates.",
  "preserve_completed": true
}

USER: Perfect, let's start.

[AGENT calls POST /api/v2/agent/sessions]
{
  "topic": "Quantum Gates and Circuits",
  "plan_id": "...",
  "plan_node_id": "node-2"
}

AGENT: Great! We're starting "Quantum Gates and Circuits." Here's your first 
      thinking prompt:
      
      "When we write |0⟩ + |1⟩, that's not a valid quantum state. What's missing, 
      and why does it matter?"
      
      Think out loud - I'll be listening and following your reasoning.

USER: [speaks] Hmm, I think it's missing the normalization factor? Like, the 
      probabilities have to add up to 1, so we need... 1/√2 in front of each term?

[AGENT submits audio to POST /api/v2/agent/sessions/{id}/analyze]
{
  "inputs": [{ "type": "audio", "data": "...", "format": "webm", "duration_ms": 12000 }],
  "context": { "active_probe_ids": ["probe-001"] }
}

[Response: gap_score: 0.3, signals: ["Good intuition about normalization"]]

AGENT: Nice! You've got the normalization right. Here's a follow-up:
      
      "If we measure this state, what are the possible outcomes and their 
      probabilities? And what happens to the state after measurement?"

USER: [speaks] So we'd get 0 or 1, each with 50% probability... And after 
      measurement it collapses to whichever we measured. But wait, does 
      the √2 factor affect the probabilities?

[AGENT submits audio, gets new probe about probability calculation]

AGENT: You're on the right track with the collapse. Think about the √2 factor 
      - when you calculate a probability in quantum mechanics, what operation 
      do you perform on the amplitude?

USER: I'm not sure. Can you explain how probabilities work in quantum states?

[AGENT calls POST /api/v2/agent/sessions/{id}/ask]
{
  "question": "How do probabilities work in quantum states? Specifically how do you get probability from amplitude?",
  "context": { "relevant_probe_ids": ["probe-002"] }
}

AGENT: [relaying Helios response]
      
      Think about it this way: the amplitude is like a "probability amplitude." 
      To get the actual probability, you square the absolute value. So if your 
      amplitude is 1/√2, what happens when you square that?

USER: Oh! (1/√2)² = 1/2 = 50%. That makes sense now.

[Session continues... eventually user completes the session]

[AGENT calls POST /api/v2/agent/sessions/{id}/end]

AGENT: Great session! Here's your summary:
      
      ## What Happened
      Reviewed Dirac notation with focus on normalization and measurement. 
      Strong intuition, needed practice with probability calculations.
      
      ## Gaps Found
      - Initial uncertainty about amplitude-to-probability conversion
      - Could practice more complex superposition states
      
      ## What Went Well
      - Quickly grasped normalization requirement
      - Good questions showing genuine engagement
      
      ## Next Time
      - Try writing out more states and computing probabilities
      - Ready for quantum gates in next session
      
      Your session has been verified on OpenLesson with proof:
      🔗 sha256:mno345... (anchored on Solana: tx 5xYz...)

USER: Thanks! Let's continue tomorrow with quantum gates.

AGENT: Sounds good! Your progress is saved. See you tomorrow!
```

### 15.2 Handling Plan Adaptation Mid-Session

```
USER: [during a session on Grover's Algorithm] This is really hard. I don't 
      think I understand quantum gates well enough for this.

AGENT: No problem - we can adapt. Let me check what would help.

[AGENT calls POST /api/v2/agent/sessions/{id}/pause]

[AGENT calls POST /api/v2/agent/plans/{id}/adapt]
{
  "instruction": "User struggling with Grover's because gate fundamentals are weak. Add preparatory content on quantum gates before continuing with Grover's.",
  "context": {
    "recent_session_feedback": "User explicitly said they don't understand gates well enough"
  }
}

AGENT: I've updated your learning path. I've added two sessions before we 
      continue with Grover's:
      
      1. "Quantum Gates Deep Dive" - focus on Hadamard, CNOT, and phase gates
      2. "Building Simple Circuits" - hands-on practice combining gates
      
      Then we'll come back to Grover's with a stronger foundation. 
      
      Want to start the gates deep dive now, or take a break first?

USER: Let's start now.

[AGENT calls POST /api/v2/agent/sessions - new session for gates]
```

### 15.3 Multi-Session Workflow

```
USER: I need to work on two different topics today - quantum computing for 
      my coursework and machine learning for a project.

AGENT: I can help with both. Let me check your learning plans.

[AGENT calls GET /api/v2/agent/plans]

AGENT: You have plans for both topics. Which would you like to start with?
      
      1. Quantum Computing - Next: Grover's Algorithm (45 min)
      2. Machine Learning - Next: Neural Network Basics (30 min)

USER: Let's do 30 minutes of quantum, then switch to ML.

[AGENT starts quantum session]
... 30 minutes later ...

USER: Okay, let's pause and switch to ML.

[AGENT calls POST /api/v2/agent/sessions/{quantum_id}/pause]
{
  "reason": "User switching to different topic",
  "estimated_resume_minutes": 60
}

[AGENT calls POST /api/v2/agent/sessions]
{
  "topic": "Neural Network Basics",
  "plan_id": "ml-plan-id",
  "plan_node_id": "nn-basics-node"
}

AGENT: Quantum session paused. Starting "Neural Network Basics"...

... ML session continues ...

USER: Done for now with ML. Can we finish the quantum session?

[AGENT calls POST /api/v2/agent/sessions/{ml_id}/pause]

[AGENT calls POST /api/v2/agent/sessions/{quantum_id}/resume]

AGENT: Welcome back to quantum! Last time we were exploring Grover's oracle. 
      Can you remind me what you understood about how the oracle marks the 
      target state?
```

---

## 16. Error Handling

### 16.1 Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### 16.2 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `unauthorized` | 401 | Missing or invalid API key |
| `key_expired` | 401 | API key has expired |
| `key_revoked` | 401 | API key has been revoked |
| `forbidden` | 403 | Valid key but insufficient scope |
| `subscription_lapsed` | 403 | Pro subscription no longer active |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 400 | Invalid request parameters |
| `rate_limit_exceeded` | 429 | Too many requests |
| `session_not_active` | 400 | Session is not in active state |
| `session_already_ended` | 400 | Session has already been ended |
| `plan_not_found` | 404 | Learning plan doesn't exist |
| `node_not_found` | 404 | Plan node doesn't exist |
| `proof_not_found` | 404 | Proof doesn't exist |
| `anchor_failed` | 500 | Failed to anchor proof on Solana |
| `transcription_failed` | 500 | Failed to transcribe audio |
| `analysis_failed` | 500 | Failed to analyze input |
| `internal_error` | 500 | Unexpected server error |

### 16.3 Rate Limit Error

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 45 seconds.",
    "details": {
      "retry_after": 45,
      "limit": 120,
      "window": "minute",
      "current_usage": 120
    }
  }
}
```

### 16.4 Validation Error

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request parameters",
    "details": {
      "fields": {
        "topic": "Topic is required",
        "duration_days": "Must be one of: 7, 14, 30, 60, 90, 180"
      }
    }
  }
}
```

### 16.5 Subscription Error

```json
{
  "error": {
    "code": "subscription_lapsed",
    "message": "Your Pro subscription has expired. Please renew to continue using the Agentic API.",
    "details": {
      "expired_at": "2026-04-01T00:00:00Z",
      "renew_url": "https://openlesson.academy/pricing"
    }
  }
}
```

---

## 17. Migration & Deprecation Plan

### 17.1 Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Phase 1 | Week 1-2 | Implement core v2 API (auth, plans, sessions) |
| Phase 2 | Week 2-3 | Implement analysis, assistant, analytics |
| Phase 3 | Week 3-4 | Implement proofs, Solana program |
| Phase 4 | Week 4-5 | Documentation, testing, ElizaOS v2 plugin |
| Phase 5 | Week 5-6 | Add deprecation warnings to v1 |
| Phase 6 | Month 2-3 | Migration period (both APIs active) |
| Phase 7 | Month 4 | Remove v1 API |

### 17.2 Deprecation Warnings

After Phase 5, all v1 endpoints will return:

```
Deprecation: true
Sunset: 2026-07-14
Link: </api/v2/agent>; rel="successor-version"
```

### 17.3 Migration Guide

| v1 Endpoint | v2 Endpoint | Changes |
|-------------|-------------|---------|
| `POST /api/agent/plan` | `POST /api/v2/agent/plans` | Response structure enhanced |
| `POST /api/agent/session/start` | `POST /api/v2/agent/sessions` | Added session plan, opening probe |
| `POST /api/agent/session/analyze` | `POST /api/v2/agent/sessions/{id}/analyze` | Multi-modal input support |
| `POST /api/agent/session/end` | `POST /api/v2/agent/sessions/{id}/end` | Enhanced report, proof system |
| `GET /api/agent/session/summary` | `GET /api/v2/agent/analytics/sessions/{id}` | Expanded analytics |
| (new) | `POST /api/v2/agent/sessions/{id}/pause` | New endpoint |
| (new) | `POST /api/v2/agent/sessions/{id}/resume` | New endpoint |
| (new) | `POST /api/v2/agent/sessions/{id}/ask` | Helios Chat |
| (new) | `POST /api/v2/agent/plans/{id}/adapt` | Plan adaptation |
| (new) | `GET /api/v2/agent/proofs/*` | Proof system |

### 17.4 Breaking Changes

1. **Response structure**: All responses now include `proof` object
2. **Session start**: Now returns `session_plan` and `opening_probe`
3. **Analyze**: Input format changed to support multi-modal
4. **Authentication**: Scoped keys replace simple keys

---

## 18. Appendix

### 18.1 Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `vi` | Vietnamese |
| `zh` | Chinese |
| `es` | Spanish |
| `de` | German |
| `pl` | Polish |
| `ca` | Catalan |

### 18.2 Audio Format Support

| Format | MIME Type | Recommended |
|--------|-----------|-------------|
| WebM | `audio/webm` | Yes |
| MP4 | `audio/mp4` | Yes |
| OGG | `audio/ogg` | Yes |
| M4A | `audio/m4a` | Yes |

### 18.3 Image Format Support

| Format | MIME Type | Max Size |
|--------|-----------|----------|
| PNG | `image/png` | 5MB |
| JPEG | `image/jpeg` | 5MB |
| WebP | `image/webp` | 5MB |

### 18.4 Environment Variables

```bash
# Solana Configuration
SOLANA_NETWORK=mainnet-beta  # localnet | devnet | mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PROGRAM_ID=OPENLsn...

# Fee Payer (OpenLesson pays all gas)
SOLANA_FEE_PAYER_SECRET_KEY=<base64_encoded_secret_key>

# Custodial Wallet Encryption
SOLANA_WALLET_ENCRYPTION_KEY=<32_byte_hex_key>
```

### 18.5 Rate Limit Headers

All responses include:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1713052800
```

### 18.6 Proof Type Values

| Type | Value | Description |
|------|-------|-------------|
| `plan_created` | 0 | Learning plan created |
| `plan_adapted` | 1 | Learning plan modified |
| `session_started` | 2 | Tutoring session started |
| `session_paused` | 3 | Session paused |
| `session_resumed` | 4 | Session resumed |
| `session_ended` | 5 | Session ended |
| `analysis_heartbeat` | 6 | Analysis chunk processed |
| `assistant_query` | 7 | Helios queried |
| `session_batch` | 8 | Session batch (Merkle root) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0.0 | 2026-04-14 | OpenLesson Engineering | Initial specification |

---

*End of Specification*
