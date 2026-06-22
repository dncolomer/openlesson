# OpenLesson Agentic API Skill

Use this skill when an agent needs to interact with the OpenLesson Agentic API.

## Scope

The API supports only this workflow:

1. Create a Performance Workspace with an initial prompt and optional files.
2. List available blocks in that workspace.
3. Request a private GHL link for a block. This opens the GHL Score session page.
4. List existing GHL links and completion status.
5. Request completed GHL link results.

Do not use or describe blockchain tracking, proof anchoring, tool-usage tracking, tutoring session control, analytics, or plan adaptation as Agentic API features.

## Authentication

Send API keys with:

```http
Authorization: Bearer <api_key>
```

Valid scopes are `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`, and `*`.

Organization scopes are `org:read` and `org:write`. Organization and guest-user APIs require the Teams tier.

## Endpoints

`POST /api/v2/agent/workspaces`

Create a Performance Workspace.

```json
{
  "initial_prompt": "I need to demonstrate mastery of recursion.",
  "files": [
    {
      "name": "brief.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-file"
    }
  ]
}
```

`GET /api/v2/agent/workspaces/{workspace_id}/blocks`

List the blocks available for assessment in the workspace. Organization members and active organization guests can access organization-owned workspaces.

`POST /api/organization`

Create an organization from the regular authenticated web API and make the current user its admin. Requires Teams tier.

```json
{
  "name": "Acme Enablement"
}
```

`POST /api/v2/agent/org/guests`

Organization admins can create guest users programmatically by email. Requires an org admin API key with `org:write`. The response includes an individual guest API key.

```json
{
  "email": "learner@example.com"
}
```

Response:

```json
{
  "guest_user": {
    "id": "guest-id",
    "organization_id": "org-id",
    "email": "learner@example.com",
    "status": "active"
  },
  "api_key": "gsk_...",
  "key": {
    "scopes": ["workspaces:read", "ghl:read", "ghl:write"]
  }
}
```

`POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links`

Create a private GHL link for a block.

```json
{
  "minutes": 15,
  "guest_user_id": "optional-guest-id",
  "guest_email": "optional-guest-email"
}
```

Only `15` and `30` minute sessions are supported. Any other value defaults to `15`.
Org admins may assign a GHL link to a guest by `guest_user_id` or `guest_email`. Guest API keys create GHL links for their own guest identity automatically.

When a guest later signs up with the same email through the regular interface, the real user inherits the guest's organization membership, GHL sessions, and guest API keys.

## GHL Session Behavior

GHL sessions should follow a Socratic style. The facilitator asks one concise question at a time, builds follow-ups from the learner's own words, and avoids explaining answers unless the learner explicitly asks for help.

Normal workspace routes use `/workspace/{workspace_id}/ghl-score`; private links use `/ghl-score/session/{token}`. The internal API route for the live flow is `/api/workspace-ghl-score`.

Private GHL links are bearer links. Opening `/ghl-score/session/{token}` authenticates the GHL session directly with the token; the learner does not need an OpenLesson login or an Agentic API key to complete that GHL session. Treat the URL as sensitive.

Hotkeys in the live GHL UI:

1. `1`, `2`, `3` sends the corresponding active thought.
2. `Ctrl/Cmd + 1`, `Ctrl/Cmd + 2`, `Ctrl/Cmd + 3` toggles that thought into the multi-select set.
3. `S` sends selected thoughts.
4. `Esc` skips the current thought into the side Thought Memory panel.
5. There is no connecting-thought chain feature.

`GET /api/v2/agent/workspaces/{workspace_id}/ghl-links`

List GHL links and their statuses.

`GET /api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results`

Fetch score results. Results are populated only after the GHL session is completed.

Completed result shape:

```json
{
  "ghl_result": {
    "id": "link-id",
    "workspace_id": "workspace-id",
    "block_id": "block-id-or-null",
    "status": "completed",
    "completed": true,
    "overall_score": 82,
    "marker_scores": [
      {
        "id": "conceptual_clarity",
        "label": "Conceptual Clarity",
        "score": 85,
        "rationale": "Clear definitions with minor imprecision."
      }
    ],
    "gap_analysis": {
      "summary": "Concise summary of remaining learning gaps.",
      "gaps": [
        {
          "title": "Gap title",
          "evidence": "What in the demonstration showed the gap.",
          "severity": "medium",
          "suggested_repair": "How to repair the gap."
        }
      ],
      "next_practice": ["Concrete practice prompt"]
    },
    "analysis": {
      "overall_score": 82,
      "markers": [],
      "gap_analysis": {},
      "overall_reflection": "Short learner-facing reflection.",
      "strengths": [],
      "growth_areas": [],
      "follow_up_prompts": [],
      "confidence": "developing"
    }
  }
}
```
