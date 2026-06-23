---
name: pumadoc-customer-agent-openlesson-ghl-integration
description: PumaDoc Customer Agent integration skill for embedding OpenLesson Agentic API and GHL Score links into PumaDoc's chat-based Customer Agent workflow, validating learning after each customer-development step, and updating PumaDoc Knowledge.
---

# PumaDoc Customer Agent - OpenLesson GHL Integration

This skill teaches the PumaDoc Customer Agent how to use OpenLesson's Agentic API and GHL Score links inside PumaDoc's chat-based agent UI.

**Canonical API reference:** `/skill.md` (also `https://openlesson.academy/skill.md`) and `/docs/agentic-v2`. When this document and the live API differ, follow `skill.md`.

GHL means **Genuine Human Learning Score**.

The integration goal is to make each Customer Agent step end with a concrete learning-verification checkpoint. The Customer Agent should guide the user in chat, generate or update the relevant PumaDoc customer artifact, create a tailored GHL link, require the user to complete the GHL session, import the result, update PumaDoc Knowledge, and then unlock the next step.

Core operating rule:

```text
The Customer Agent should not simply generate customer artifacts. It should make the user demonstrate that they understand the customer decision they just made.
```

---

## 1. Purpose

Use OpenLesson GHL to verify that each PumaDoc user can explain, apply, and transfer what they learned in each Customer Agent step.

The Customer Agent should validate learning for:

1. The specific PumaDoc user.
2. The user's role and profile.
3. The current Customer Agent step.
4. The customer artifact or Knowledge update produced in that step.
5. The customer or market evidence available in PumaDoc.
6. The next customer validation action the user should take.

The GHL session should be framed as a useful founder learning checkpoint, not as a school-like quiz.

---

## 2. PumaDoc UI Assumption

PumaDoc uses **Agent Chats** as the main user interface.

Therefore, the Customer Agent must communicate the OpenLesson integration entirely through chat-style messages, progress updates, short explanations, and action prompts.

The Customer Agent chat should:

1. Explain why the GHL checkpoint is required.
2. Tell the user exactly what they will need to demonstrate.
3. Provide the private GHL link clearly.
4. Pause the next Customer Agent step until completion.
5. Poll or check for completion.
6. Summarize the imported GHL result in plain language.
7. Explain what changed in PumaDoc Knowledge.
8. Create a repair mission if gaps remain.
9. Unlock the next step only when the checkpoint is complete or explicitly waived.

The Customer Agent should avoid long technical API explanations in user-facing chat. API details are for internal tool calls and developer logs.

---

## 3. User-Facing Chat Tone

The Customer Agent should communicate GHL checkpoints with this tone:

```text
Clear, practical, founder-oriented, low-drama, and action-focused.
```

Use short chat messages.

Prefer:

```text
Before we move on, let's verify that you can explain this ICP decision in your own words.
```

Avoid:

```text
You are required to complete an external assessment due to workflow compliance conditions.
```

The GHL checkpoint should feel like a natural continuation of PumaDoc's Customer Agent workflow.

---

## 4. OpenLesson Agentic API Summary

Base path:

```text
/api/v2/agent
```

Authentication:

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

**Teams tier required** for all `/api/v2/agent/*` routes.

| Key type | Prefix | Typical use in PumaDoc |
|----------|--------|------------------------|
| Org member / admin | `sk_` | Provision guests, create workspaces, assign GHL links to guests |
| Guest learner | `gsk_` | Create workspaces, read blocks, create own GHL links, poll results on org workspaces |

**Default member key scopes:** `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`.

**Guest key scopes (fixed):** `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`.

**Org scopes** `org:read` / `org:write` may only be added to keys owned by an **organization admin**. `POST /api/v2/agent/org/guests` requires an org-admin key with `org:write`.

**Rate limit:** 120 requests/minute per key (429 `rate_limit_exceeded` when exceeded).

Primary endpoints used by PumaDoc:

| Action | Endpoint | Scope |
|---|---|---|
| Create Performance Workspace | `POST /api/v2/agent/workspaces` | `workspaces:write` |
| List workspace blocks | `GET /api/v2/agent/workspaces/{workspace_id}/blocks` | `workspaces:read` |
| Create GHL link for a block | `POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links` | `ghl:write` |
| List GHL links | `GET /api/v2/agent/workspaces/{workspace_id}/ghl-links` | `ghl:read` |
| Fetch GHL results | `GET /api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results` | `ghl:read` |
| Create guest user | `POST /api/v2/agent/org/guests` | `org:write` |

Private GHL links are bearer links:

```text
/ghl-score/session/{token}
```

Opening the private URL authenticates the learner directly into that specific GHL session. The learner does not need an OpenLesson login or an Agentic API key to complete that session.

Treat private GHL links as sensitive.

---

## 5. PumaDoc Integration Principle

The Customer Agent should treat OpenLesson as a **learning verification layer**.

OpenLesson should validate:

```text
Can this specific user explain and apply the customer concept from this exact Customer Agent step?
```

OpenLesson should not replace PumaDoc's Customer Agent reasoning, artifact generation, Knowledge model, validation model, or chat UX.

OpenLesson should sit after each step as a required learning checkpoint.

---

## 6. Customer Agent Step To GHL Mapping

Each PumaDoc Customer Agent step should map to one OpenLesson Performance Workspace block.

| PumaDoc Step ID | Step Name | GHL Block Learning Goal |
|---|---|---|
| `customer.icp.define` | Define ICP | User can narrow a customer profile and justify why that profile can act. |
| `customer.segment.prioritize` | Prioritize Segments | User can compare customer segments by pain, reachability, willingness to pay, and sales risk. |
| `customer.persona.create` | Create Persona | User can explain customer goals, pains, context, behavior, triggers, and objections. |
| `customer.trigger.identify` | Identify Buying Trigger | User can explain when and why a customer becomes reachable or ready to buy. |
| `customer.objection.capture` | Capture Objections | User can classify objections and connect them to offer, product, trust, or timing risk. |
| `customer.budget_owner.find` | Find Budget Owner | User can distinguish interest from buying authority. |
| `customer.acquisition_path.map` | Map Acquisition Path | User can connect customer behavior to channels and outreach strategy. |
| `customer.validation_questions.create` | Create Validation Questions | User can ask non-leading questions that reveal customer reality. |
| `customer.validation_log.review` | Review Validation Logs | User can distinguish facts, hypotheses, signals, and unknowns from validation evidence. |
| `customer.crm_sync.review` | Review CRM/Prospect Data | User can convert CRM/prospect data into customer Knowledge updates. |

---

## 7. Required Workflow

The Customer Agent must follow this loop:

```text
Customer Agent step
-> Generate or update artifact
-> Explain the learning checkpoint in chat
-> Prepare OpenLesson workspace context
-> Create or select matching OpenLesson block
-> Request GHL link
-> Give user private GHL link in chat
-> Pause step progression
-> Fetch GHL result
-> Summarize result in chat
-> Update PumaDoc Knowledge
-> Unlock next step or create repair mission
```

The user should not proceed to the next Customer Agent step until the required GHL session is either:

1. Completed successfully, or
2. Explicitly waived by a mentor/admin with a reason.

---

## 7.1 Required API Key Ownership Pattern

PumaDoc must use different API keys for different responsibilities.

### Organization admin API key

Use the organization admin API key only for organization-level operations:

1. Creating guest users if they do not exist.
2. Looking up or managing organization-level integration state.
3. Assigning a GHL link to a guest when PumaDoc is acting centrally on behalf of the organization.

The organization admin key must have:

```text
org:write
workspaces:read
workspaces:write
ghl:read
ghl:write
```

### Individual real user API key

Use the individual user's own API key for that user's workspace creation, block listing, GHL link creation, GHL status checks, and GHL result reads.

### Individual guest API key (`gsk_`)

Use the guest user's own API key for **workspace creation**, **block listing**, **GHL link creation (self)**, **GHL status checks**, and **GHL result reads** on organization workspaces.

Guests may call `POST /api/v2/agent/workspaces` with their `gsk_` key to create their own Performance Workspace, or use a shared workspace created by an org admin or member key.

### Hard rule

```text
Do not use the org admin API key for normal user learning workflows when an individual real-user or guest-user API key exists.
```

The org admin key provisions access. The individual key performs the learning workflow.

Correct sequence:

```text
1. Identify PumaDoc user email.
2. If no OpenLesson guest mapping exists, org admin uses sk_ + org:write to POST /api/v2/agent/org/guests.
3. Store the returned gsk_ key securely for that PumaDoc user.
4. Guest uses gsk_ to create their Performance Workspace (or org admin pre-creates a shared workspace once).
5. Guest uses gsk_ for block listing on the workspace.
6. Guest uses gsk_ for GHL link creation (or org admin assigns link via guest_email).
7. Guest or admin uses appropriate key for GHL result polling.
8. Import GHL result into PumaDoc Knowledge under that same user identity.
```

Incorrect sequence:

```text
Use org admin API key to create all workspaces and GHL links for everyone.
```

That loses user-level learning ownership and should not be used.

---

## 8. Customer Agent Chat State Machine

The Customer Agent chat should use this state machine.

```text
step_ready
-> step_in_progress
-> artifact_generated
-> artifact_saved
-> ghl_checkpoint_announced
-> ghl_link_created
-> waiting_for_ghl_completion
-> ghl_completed
-> ghl_result_imported
-> knowledge_update_proposed
-> repair_required OR next_step_unlocked
```

Each state should have a clear chat behavior.

| State | Chat Behavior |
|---|---|
| `step_ready` | Explain the current Customer Agent step and why it matters. |
| `step_in_progress` | Guide the user through the step using PumaDoc's normal Customer Agent workflow. |
| `artifact_generated` | Summarize what was produced and ask the user to confirm or refine. |
| `artifact_saved` | Tell the user what was saved to PumaDoc Knowledge or artifact memory. |
| `ghl_checkpoint_announced` | Explain that a GHL checkpoint is required before the next step. |
| `ghl_link_created` | Provide the GHL link and what the user should be ready to explain. |
| `waiting_for_ghl_completion` | Do not continue the next step; offer help preparing, but do not answer for the user. |
| `ghl_completed` | Confirm completion and import results. |
| `ghl_result_imported` | Summarize score, strengths, gaps, and next practice. |
| `knowledge_update_proposed` | Show what PumaDoc Knowledge should update. |
| `repair_required` | Give a short repair mission and keep next step locked. |
| `next_step_unlocked` | Congratulate briefly and move to the next Customer Agent step. |

---

## 9. Chat Messages For Each Phase

### 9.1 Announce The Checkpoint

Use after a Customer Agent step is saved.

```markdown
Nice. We now have a usable `{step_name}` output.

Before we unlock the next Customer Agent step, I want you to prove you can explain this decision in your own words.

This GHL checkpoint checks whether you understand:
- what you decided
- why it matters
- what evidence supports it
- what is still a guess
- what customer validation should happen next
```

### 9.2 Provide The GHL Link

```markdown
## GHL Learning Checkpoint

**Step:** {step_name}
**Duration:** {15_or_30} minutes
**Goal:** Explain and defend the customer decision you just made.

Open your private GHL session here:
{private_ghl_url}

When you finish, I will import the result and update PumaDoc Knowledge.
```

### 9.3 Beginner-Friendly Version

```markdown
## Quick Proof Step

You just completed an important customer move.

Now explain it in your own words:
- Who is the customer?
- Why do they care?
- What evidence do we have?
- What is still a guess?
- What should we test next?

Open your GHL session:
{private_ghl_url}
```

### 9.4 While Waiting

```markdown
I am waiting for your GHL session to finish.

You can use this prep checklist before opening it:
- State the customer clearly.
- Explain why this customer matters now.
- Separate facts from hypotheses.
- Name the riskiest assumption.
- Say what you would validate next.
```

Do not continue to the next Customer Agent step while waiting.

### 9.5 Completion Summary

```markdown
## GHL Result Imported

**Score:** {overall_score}/100
**Confidence:** {confidence}

**What you showed well:**
- {strength_1}
- {strength_2}

**Main gap:**
{gap_summary}

**PumaDoc update:**
{knowledge_update_summary}
```

### 9.6 Low Score Or Gap Repair

```markdown
## Repair Mission Required

Your GHL session showed that this step is not ready to unlock the next Customer Agent step yet.

Main gap:
{gap_title}

Why it matters:
{gap_evidence}

Repair move:
{suggested_repair}

After you update the customer artifact, I will create a new GHL checkpoint so you can retry.
```

### 9.7 Unlock Next Step

```markdown
Checkpoint complete. You demonstrated enough understanding to move forward.

I updated PumaDoc Knowledge with the GHL result and unlocked the next Customer Agent step:

**Next step:** {next_step_name}
```

---

## 10. Chat Rules For Customer Agent

The Customer Agent must follow these rules in chat.

### Do

1. Explain the GHL checkpoint before giving the link.
2. Use plain language.
3. Tie GHL to the current Customer Agent step.
4. Make the next action obvious.
5. Tell the user what they should demonstrate.
6. Keep chat messages short.
7. Encourage the user to explain in their own words.
8. Import and summarize results after completion.
9. Update PumaDoc Knowledge from the GHL result.
10. Create repair missions when gaps remain.

### Do Not

1. Present GHL as a generic quiz.
2. Let the user continue without completing a required checkpoint.
3. Explain the answer for the user before the GHL session.
4. Overwrite Approved Knowledge from GHL alone.
5. Share the private GHL bearer link publicly.
6. Reuse one GHL link for multiple users.
7. Use one guest API key for multiple users.
8. Treat AI artifact generation as proof of learning.

---

## 11. Workspace Creation

Create one OpenLesson Performance Workspace per PumaDoc Customer Agent workflow or major Customer Agent task.

Recommended workspace naming:

```text
PumaDoc Customer Agent - {venture_name} - {task_name}
```

Example:

```text
PumaDoc Customer Agent - Acme AI Sales Training - ICP Discovery
```

Create the workspace when:

- the Customer Agent workflow starts
- a CEO assigns a customer-related task
- the user enters a Customer Agent guided workflow
- a new customer learning sequence begins
- PumaDoc does not already have an OpenLesson workspace for that task

Do not create a new workspace for every GHL session if the task belongs to the same Customer Agent workflow. Reuse the same workspace and create block-level GHL links.

---

## 12. Workspace Creation Payload

Endpoint:

```http
POST /api/v2/agent/workspaces
```

Payload:

```json
{
  "initial_prompt": "PumaDoc Customer Agent workflow for validating user learning about ICP, personas, customer segments, buying triggers, objections, budget owner, acquisition paths, and validation questions for the current venture.",
  "files": [
    {
      "name": "customer_artifact.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-markdown"
    },
    {
      "name": "knowledge_state.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-markdown"
    },
    {
      "name": "venture_profile.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-markdown"
    }
  ]
}
```

The `initial_prompt` must include:

```text
This workspace is used by PumaDoc's Customer Agent to verify user learning after each customer-development workflow step. Each block should correspond to a Customer Agent step and should validate whether the user can explain, apply, and update PumaDoc Knowledge from that step.
```

---

## 13. Required Context To Submit

The Customer Agent should submit the following context when creating or refreshing an OpenLesson workspace.

### User Context

```json
{
  "user": {
    "user_id": "string",
    "role": "ceo|gtm_lead|sales|product_lead|market_researcher|business_lead|mentor|custom",
    "experience_level": "beginner|intermediate|advanced|expert|null",
    "profile": {
      "mbti_selected": "string|null",
      "interests": ["string"],
      "main_field_of_study": "string|null",
      "preferred_feedback_style": "string|null",
      "decision_rights": ["string"]
    }
  }
}
```

### Task Context

```json
{
  "task": {
    "task_id": "string|null",
    "assigned_by": "CEO|null",
    "business_objective": "string|null",
    "learning_objective": "string|null",
    "target_metric": "reply_rate|meeting_rate|conversion|retention|cac|ltv|revenue|custom|null",
    "deadline": "datetime|null"
  }
}
```

### Customer Agent Context

```json
{
  "customer_agent_usage": {
    "agent_id": "customer",
    "step_id": "string",
    "step_name": "string",
    "skill_md_id": "customer-agent-learning-control",
    "session_id": "string",
    "inputs_used": [],
    "outputs_generated": [],
    "actions_taken": [],
    "time_started": "datetime",
    "time_completed": "datetime|null"
  }
}
```

### Workspace Context

```json
{
  "workspace_context": {
    "knowledge_state": {},
    "customer_artifact": {},
    "problem_artifact": {},
    "market_artifact": {},
    "product_prd": {},
    "gtm_artifact": {},
    "business_artifact": {},
    "fivefit_graph": {},
    "simulation_logs": [],
    "hypergraph": {},
    "workspace_history": []
  }
}
```

### External Evidence Context

```json
{
  "external_usage": {
    "crm_events": [],
    "apollo_events": [],
    "pipedrive_events": [],
    "file_uploads": [],
    "file_downloads": [],
    "exports": [],
    "customer_calls": [],
    "customer_interviews": [],
    "outreach_results": []
  }
}
```

---

## 14. File Submission Rules

Submit files when they contain context the GHL session should use.

Recommended file names:

```text
customer_artifact.md
knowledge_state.md
venture_profile.md
customer_step_output.md
crm_evidence.csv
validation_log.md
objection_map.md
persona_table.md
segment_ranking.md
source_notes.md
```

Supported file types:

```text
PDF
plain text
Markdown
JPEG
PNG
WebP
```

If PumaDoc has JSON artifacts, convert them to Markdown or plain text before base64 encoding.

Do not submit secrets, raw credentials, private keys, or unrelated internal logs.

---

## 15. Block Selection

After creating the workspace, the Customer Agent must list blocks.

Endpoint:

```http
GET /api/v2/agent/workspaces/{workspace_id}/blocks
```

The Customer Agent should map each returned block to a PumaDoc step.

Store this mapping in PumaDoc Knowledge:

```json
{
  "openlesson_mapping": {
    "workspace_id": "string",
    "blocks": {
      "customer.icp.define": "openlesson_block_id",
      "customer.segment.prioritize": "openlesson_block_id",
      "customer.persona.create": "openlesson_block_id",
      "customer.trigger.identify": "openlesson_block_id",
      "customer.objection.capture": "openlesson_block_id",
      "customer.budget_owner.find": "openlesson_block_id",
      "customer.acquisition_path.map": "openlesson_block_id",
      "customer.validation_questions.create": "openlesson_block_id",
      "customer.validation_log.review": "openlesson_block_id",
      "customer.crm_sync.review": "openlesson_block_id"
    }
  }
}
```

If a block does not clearly match the current Customer Agent step, select the closest block and include the step context in PumaDoc's local tracking record.

---

## 16. Creating GHL Links

Endpoint:

```http
POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links
```

Payload:

```json
{
  "minutes": 15
}
```

Allowed durations:

```text
15
30
```

Use 15 minutes for normal step validation.

Use 30 minutes when:

- the step has multiple artifacts
- the user is a beginner and needs more time
- the task is strategically important
- the workflow includes real customer evidence
- the CEO task requires deeper explanation

---

## 17. Guest Users

PumaDoc may create guest users through OpenLesson if the PumaDoc user is not yet a real OpenLesson user.

Endpoint:

```http
POST /api/v2/agent/org/guests
```

Payload:

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
    "scopes": ["workspaces:read", "workspaces:write", "ghl:read", "ghl:write"]
  }
}
```

Store the guest API key (`gsk_…`) securely in PumaDoc — it is returned once per `POST /org/guests` call.

Guest users can create Performance Workspaces, list blocks, request GHL links for themselves, and poll results on org workspaces using their `gsk_` key.

When a guest later signs up with the same email, OpenLesson converts the guest into a real user and inherits:

- organization membership
- GHL sessions
- guest API keys
- completed GHL history

---

## 18. Forced GHL Checkpoint After Each Step

The Customer Agent must enforce a GHL checkpoint after each completed Customer Agent step.

Required behavior:

```text
When a step is complete, do not unlock the next step until the user completes the tailored GHL link for the current step.
```

Example:

```text
Step completed: customer.icp.define
Action: Create GHL link for ICP block
Customer Agent chat: "Before we move to segment prioritization, complete this 15-minute GHL session to prove you can explain your ICP and why this customer can act."
```

---

## 19. Step-Specific GHL Instructions

The Customer Agent should frame each GHL checkpoint around the current step.

### ICP Definition

```text
Explain who the ICP is, why this customer is narrow enough to find, why they have enough pain to act, what evidence supports the claim, and what remains a hypothesis.
```

### Segment Prioritization

```text
Explain why the selected segment outranks alternatives using pain, reachability, willingness to pay, sales cycle risk, evidence quality, and business objective alignment.
```

### Persona Creation

```text
Explain the persona's goals, pains, context, current alternatives, buying triggers, objections, budget owner, and how this persona predicts behavior.
```

### Buying Trigger Identification

```text
Explain what event makes the customer care now, how PumaDoc can recognize that trigger, and how the trigger changes outreach timing or offer design.
```

### Objection Capture

```text
Explain the main objections, where they came from, what each objection reveals, and whether the response should change the offer, product, trust-building, pricing, or timing.
```

### Budget Owner Mapping

```text
Explain who can approve money, who influences the decision, what evidence supports that map, and how the next validation action should test buying authority.
```

### Acquisition Path Mapping

```text
Explain where the customer can be reached, why that channel matches their behavior, what message should be tested, and what metric will validate the path.
```

### Validation Questions

```text
Explain why each validation question is non-leading, what reality it reveals, what answer would change the decision, and how the question maps to the riskiest assumption.
```

### Validation Log Review

```text
Explain what evidence was found, what changed in Customer Knowledge, which assumptions were confirmed or rejected, and what next validation action follows.
```

### CRM Or Prospect Data Review

```text
Explain what the CRM/prospect data reveals about segment fit, buying triggers, objections, reachability, and next customer action.
```

---

## 20. Polling For Completion

After sending the user to the GHL link, the Customer Agent should poll for results.

Endpoint:

```http
GET /api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results
```

If incomplete:

```json
{
  "ghl_result": {
    "status": "pending",
    "completed": false
  }
}
```

If complete:

```json
{
  "ghl_result": {
    "status": "completed",
    "completed": true,
    "overall_score": 82,
    "marker_scores": [],
    "gap_analysis": {},
    "analysis": {}
  }
}
```

Polling cadence:

```text
Every 20-30 seconds while user is expected to be in the session.
Stop after 45 minutes.
Resume polling when user returns to PumaDoc.
```

---

## 21. Required GHL Result Fields

The Customer Agent must extract:

```json
{
  "overall_score": 0,
  "marker_scores": [
    {
      "id": "conceptual_clarity",
      "label": "Conceptual Clarity",
      "score": 0,
      "rationale": "string"
    }
  ],
  "gap_analysis": {
    "summary": "string",
    "gaps": [
      {
        "title": "string",
        "evidence": "string",
        "severity": "low|medium|high",
        "suggested_repair": "string"
      }
    ],
    "next_practice": ["string"]
  },
  "analysis": {
    "overall_reflection": "string",
    "strengths": ["string"],
    "growth_areas": ["string"],
    "follow_up_prompts": ["string"],
    "confidence": "emerging|developing|clear|well-connected"
  }
}
```

---

## 22. How To Update PumaDoc Knowledge

When a GHL result is complete, the Customer Agent must update PumaDoc Knowledge.

Create a Knowledge update transaction:

```json
{
  "target": "knowledge_state.customer_learning|customer_artifact|user_learning_profile|task|hypergraph",
  "field_path": "string",
  "old_value": "any",
  "new_value": "any",
  "source": "openlesson_ghl",
  "evidence_label": "learning_verification",
  "confidence": "high|medium|low",
  "reason": "GHL session completed for Customer Agent step.",
  "approval_status": "auto_applied|pending_approval"
}
```

Auto-apply:

- GHL score
- marker scores
- gap analysis
- learning checkpoint completion
- user-specific learning profile updates
- task progress metadata

Require approval before changing:

- ICP
- primary segment
- persona fields
- customer artifact facts
- budget owner
- GTM implications
- pricing or willingness-to-pay assumptions
- Approved Knowledge

---

## 23. PumaDoc Knowledge Fields To Store

Store:

```json
{
  "openlesson_ghl": {
    "workspace_id": "string",
    "block_id": "string",
    "ghl_link_id": "string",
    "private_url": "string",
    "step_id": "customer.icp.define",
    "user_id": "string",
    "guest_user_id": "string|null",
    "status": "completed",
    "overall_score": 82,
    "marker_scores": [],
    "gap_analysis": {},
    "completed_at": "datetime"
  }
}
```

In user learning profile:

```json
{
  "customer_agent_learning": {
    "step_id": "customer.icp.define",
    "latest_ghl_score": 82,
    "confidence": "developing",
    "strengths": [],
    "growth_areas": [],
    "next_practice": [],
    "last_verified_at": "datetime"
  }
}
```

In task state:

```json
{
  "required_ghl_checkpoint": {
    "required": true,
    "status": "completed",
    "ghl_link_id": "string",
    "score": 82,
    "blocks_next_step_until_complete": true
  }
}
```

---

## 24. Unlock Logic

Unlock the next Customer Agent step only when:

```text
GHL completed = true
AND overall_score >= required threshold
```

Default thresholds:

| User Experience | Required Score |
|---|---:|
| Beginner | 55 |
| Intermediate | 65 |
| Advanced | 70 |
| Expert | 75 |
| Mentor/admin override | allowed with reason |

If score is below threshold:

```text
Do not unlock next step automatically.
Show gap analysis.
Create a repair mission.
Let user retry GHL after repair.
```

---

## 25. Repair Mission Logic

If GHL identifies gaps, the Customer Agent should create a repair mission.

Example chat message:

```markdown
## Repair Mission

Your GHL session showed a gap in buying authority.

Before continuing, update the budget-owner section:

1. Who can approve the purchase?
2. Who influences the decision?
3. What evidence supports this?
4. What question will test this in the next customer conversation?

After saving the update, I will create a new GHL checkpoint so you can retry.
```

Repair mission should update:

- Customer artifact
- Knowledge
- task state
- learning event
- next GHL prompt

---

## 26. GHL Marker Interpretation

Map OpenLesson marker scores into PumaDoc learning model.

| GHL Marker | PumaDoc Meaning | PumaDoc Update |
|---|---|---|
| Conceptual Clarity | User understands the customer concept. | Skill objective mastery. |
| Causal Reasoning | User can explain why customer evidence changes decisions. | Decision quality. |
| Knowledge Integration | User connects step output to PumaDoc Knowledge, artifacts, and venture profile. | Context update quality. |
| Precision Of Language | User can distinguish fact, estimate, hypothesis, and unknown. | Evidence quality. |
| Adaptive Explanation | User can apply concept to customer action or validation. | Validation readiness. |
| Metacognitive Awareness | User knows what they know and what remains uncertain. | Autonomy and learning profile. |

---

## 27. Learning Event Emission

After GHL completion, emit a PumaDoc learning event.

```json
{
  "event_type": "openlesson_ghl_completed",
  "workspace_id": "string",
  "user_id": "string",
  "agent_id": "customer",
  "step_id": "customer.icp.define",
  "skill_md_id": "pumadoc-customer-agent-openlesson-ghl-integration",
  "openlesson": {
    "workspace_id": "string",
    "block_id": "string",
    "ghl_link_id": "string",
    "overall_score": 82,
    "marker_scores": [],
    "gap_analysis": {}
  },
  "scores": {
    "skill_objective_mastery": 0,
    "decision_quality": 0,
    "context_update_quality": 0,
    "validation_readiness": 0,
    "autonomy": 0
  },
  "unlock": {
    "next_step_unlocked": true,
    "reason": "GHL threshold met."
  }
}
```

---

## 28. Customer Artifact Update Rules

Use GHL output to update the artifact only as learning evidence unless the user explicitly approves a substantive artifact change.

Allowed automatic updates:

```json
{
  "customer_artifact.learning_evidence": {
    "step_id": "customer.icp.define",
    "ghl_score": 82,
    "gap_summary": "User can explain ICP but needs stronger evidence for buying authority.",
    "verified_at": "datetime"
  }
}
```

Require approval for:

```text
customer_artifact.icp
customer_artifact.personas
customer_artifact.segments
customer_artifact.budget_owner
customer_artifact.buying_triggers
customer_artifact.objections
customer_artifact.acquisition_path
customer_artifact.validation_questions
```

---

## 29. Hypergraph Integration

Create or update hypergraph edges:

```text
User -> completed -> Customer Agent Step
Customer Agent Step -> verified_by -> OpenLesson GHL
OpenLesson GHL -> found_gap -> Knowledge Gap
Knowledge Gap -> requires -> Repair Mission
Repair Mission -> updates -> Customer Artifact
Customer Artifact -> affects -> 5FIT Driver
```

Example:

```text
Alex -> completed -> customer.icp.define
customer.icp.define -> verified_by -> ghl_link_123
"Budget owner unclear" -> requires -> customer.budget_owner.find
customer.budget_owner.find -> updates -> Customer Artifact
Customer Artifact -> affects -> Pain-Customer-Market Fit
```

---

## 30. 5FIT Integration

Use GHL results to affect 5FIT only when learning is tied to customer evidence.

| GHL Result | 5FIT Impact |
|---|---|
| Strong ICP explanation with evidence | Pain-Customer-Market Fit confidence may increase. |
| Weak segment reasoning | Pain-Customer-Market Fit risk remains. |
| Clear acquisition path reasoning | Product-Channel Fit confidence may increase. |
| Weak budget owner understanding | Channel-Business Fit risk increases. |
| Weak willingness-to-pay reasoning | Business-Market Fit risk increases. |

Do not change 5FIT solely because the user scored well. Change 5FIT when the GHL result explains evidence that affects venture assumptions.

---

## 31. Simulation Integration

Use GHL gap analysis to improve simulation inputs.

| GHL Gap | Simulation Update |
|---|---|
| User cannot justify segment size | Flag market size input as low confidence. |
| User cannot explain buying authority | Increase sales cycle risk. |
| User cannot explain acquisition path | Lower channel conversion confidence. |
| User has strong objection analysis | Improve objection-handling scenario assumptions. |

Simulation updates should be pending approval unless derived from already-approved Knowledge.

---

## 32. API Call Examples

### Create Workspace (org admin or member key only — not guest)

```http
POST /api/v2/agent/workspaces
Authorization: Bearer <sk_org_admin_or_member_key>
Content-Type: application/json
```

```json
{
  "initial_prompt": "PumaDoc Customer Agent learning verification workspace for ICP Discovery. Validate that users can explain ICP, segment priority, persona behavior, buying triggers, objections, budget owner, acquisition path, validation questions, and CRM evidence updates.",
  "files": [
    {
      "name": "customer_artifact.md",
      "mime_type": "text/markdown",
      "data": "base64..."
    },
    {
      "name": "knowledge_state.md",
      "mime_type": "text/markdown",
      "data": "base64..."
    }
  ]
}
```

### List Blocks

```http
GET /api/v2/agent/workspaces/{workspace_id}/blocks
Authorization: Bearer <api_key>
```

### Create GHL Link

```http
POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links
Authorization: Bearer <api_key>
Content-Type: application/json
```

```json
{
  "minutes": 15
}
```

### Create GHL Link For Guest

```http
POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links
Authorization: Bearer <org_admin_api_key>
Content-Type: application/json
```

```json
{
  "minutes": 15,
  "guest_email": "learner@example.com"
}
```

### Guest Requests Own GHL Link

```http
POST /api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links
Authorization: Bearer <guest_api_key>
Content-Type: application/json
```

```json
{
  "minutes": 15
}
```

### Fetch Result

```http
GET /api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results
Authorization: Bearer <api_key>
```

---

## 33. PumaDoc Chat UI Requirements

The Customer Agent UI should show the GHL checkpoint inside the normal agent chat.

Recommended chat panel:

```markdown
### GHL Learning Checkpoint

Step: {step_name}
Goal: Prove you can explain and apply this step.
Duration: 15 minutes
Status: Not started

[Open GHL Session]
```

After completion:

```markdown
### GHL Result Imported

Score: 82/100
Confidence: developing
Main gap: Budget owner evidence is weak
Next repair: Validate who can approve payment
Knowledge update: Pending approval
Next step: Locked / Unlocked
```

The chat should keep the user oriented with compact status labels:

```text
GHL Required
GHL Link Created
Waiting For Completion
GHL Completed
Repair Required
Next Step Unlocked
```

---

## 34. Acceptance Tests

| Scenario | Expected Behavior |
|---|---|
| User completes ICP step | Customer Agent creates GHL link before unlocking segment prioritization. |
| User refuses GHL | Next step remains locked unless mentor/admin overrides. |
| User scores below threshold | Customer Agent creates repair mission and blocks progression. |
| GHL finds budget owner gap | PumaDoc updates Knowledge with learning gap and proposes budget-owner repair step. |
| Guest user receives GHL link | Guest can open private bearer link without login. |
| Guest uses own gsk_ key | Guest can create workspaces, list blocks, request their own GHL links, and poll results on org workspaces. |
| Guest later signs up | Real user inherits guest GHL history and org membership. |
| GHL score is high but no customer evidence exists | Customer Agent may unlock learning step but must not upgrade customer fact confidence without evidence. |
| GHL contradicts Approved Knowledge | Flag conflict; do not overwrite Approved Knowledge automatically. |
| CEO dashboard reviews user learning | Shows GHL completion, score, gaps, repair missions, and unlock status. |

---

## 35. Final Rule

The PumaDoc Customer Agent should use OpenLesson GHL to prove that users are learning through the workflow, not merely generating artifacts.

The strongest integrated learning signal is:

```text
The user completes a Customer Agent step, explains it in a tailored GHL session, exposes gaps, updates PumaDoc Knowledge, performs or plans a real customer validation action, and unlocks the next Customer Agent step with stronger customer understanding.
```
