# 🌐 OpenLesson Agentic API v2 Reference Guide

This guide details the complete surface area for interacting with the openLesson tutoring platform via its dedicated V2 API endpoints (`/api/v2/agent/*`). This is the master reference for all client-side and plugin integrations.

## 🚀 Core Concepts
*   **Goal:** The system moves beyond simple Q&A to create structured, verifiable learning paths.
*   **Learning Plans (The "Why"):** Learning is now guided by a formal `Plan` object, which structures topics into sequential nodes.
*   **Proof of Work:** Every critical action creates a **cryptographic proof** (SHA-256 fingerprint) and these proofs can be batched into Merkle Trees and optionally anchored on Solana for verifiability.
*   **Multimodal Analysis:** The `analyze` endpoint is the primary point of interaction, accepting audio, text, *and* images simultaneously to assess understanding in real-time.

## 🗺️ API Endpoints Summary

### I. Learning Plans (`/plans`)
| Method | Endpoint | Description | Key Inputs / Outputs |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v2/agent/plans` | **Create Plan:** Generates a full, directed curriculum from a topic. | Requires `topic`, optional `duration_days`. Returns `plan` object. |
| `POST` | `/api/v2/agent/plans/from-video` | Creates plan from external video source. | Requires `youtube_url`. |
| `PATCH` | `/api/v2/agent/plans/{id}/adapt` | **Plan Adaptation:** Modifies the existing curriculum structure using natural language instructions. | Requires `instruction`, `plan_id`. Preserves completed nodes. |

### II. Session Management (`/sessions`)
| Method | Endpoint | Description | Key Inputs / Outputs |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v2/agent/sessions` | **Start Session:** Begins tutoring. Can be standalone or tied to a specific Plan Node. | Requires `topic`, optionally `plan_id`/`plan_node_id`. |
| `POST` | `/api/v2/agent/sessions/{id}/analyze` | **Heartbeat Analysis:** Submits current input for assessment (audio, text, images). | Accepts complex JSON array of inputs. Returns critical metrics like `gap_score`. |
| `GET` | `/api/v2/agent/sessions/{id}` | Retrieves full session context, including plan and active probes. | Used to check state before action. |
| `POST` | `/api/v2/agent/sessions/{id}/pause` / `/resume` | Allows the user or agent to pause/resume learning with full context retention. | Requires a `reason` or `continuation_context`. |
| `POST` | `/api/v2/agent/sessions/{id}/end` | Finalizes session, generating summary and final proof package. | Returns detailed report & batch proof. |

### III. Assistant & Analytics
*   **Helios Chat:** `POST /sessions/{id}/ask` - Use this when the user gets stuck on a specific concept *during* an active session. Forwards the question to Helios (Socratic, concise) with full conversation history.
*   **Analytics:** `GET /analytics/user` - High-level overview of lifetime progress and achievements across all plans/sessions.

## 🔑 Best Practices for Agents (Implementation Guide)
1.  **State Flow is Crucial:** Always follow this pattern: **Plan $\to$ Start $\to$ Analyze ($\dots$ loop) $\to$ End**.
2.  **Error Handling:** The API returns standardized error JSON (`code`, `message`) upon failure, rather than just HTTP status codes, making programmatic handling robust.

***This guide is the authoritative source for all v2 integrations.***
