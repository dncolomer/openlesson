# Course authoring tools — inventory report

**Product:** OpenLesson workspace (map-first course builder)  
**Scope:** Tools available to course **authors** (owners / builders) as implemented in source today  
**Sources of truth:** `lib/workspace-sections.ts`, `lib/block-map-tools.ts`, `lib/workspace-right-pane.ts`, `components/BlockSkillGrid.tsx`, block/combine/add panes, Simulation + Context + Settings mounts  
**Not covered:** Learner runtime (TAP, ILE, Muse dialogue in-session), admin consoles, marketing surfaces — see [Exclusions](#exclusions)

---

## 1. Top-level workspace sections

Registry: `WORKSPACE_SECTION_KEYS` / `availableWorkspaceSections` in `lib/workspace-sections.ts`.  
Nav labels (EN): Workspace · DAGs · Context · Simulation · Knowledge · Settings.

| Section key | Who sees it | Purpose for authors |
|---|---|---|
| **`workspace`** | Everyone with access | Map-first authoring: skill grid, left tool strip, right pane for selection-driven authoring |
| **`context`** | Everyone | Workspace-level materials: notes, files, external links / Dantes search |
| **`simulation`** | Everyone | Author preview of learner journey + **workspace validation** (not live learner session) |
| **`dags`** | Workspace owner only (Creator mode) | List/edit/delete multi-block **leads-to** DAGs created via map multi-select Apply — no create on this tab |
| **`knowledge`** | Owner / org admin only | Performance / knowledge analytics surface (`mountsPerformancePanel`) |
| **`settings`** | Owner / org admin only | Identity, access, guest links, data studio, knowledge portal, integrations |

**Note:** Privileged sections (`knowledge`, `settings`) fall back to Workspace for non-privileged viewers via `resolveActiveSection`. **DAGs** is also hidden in Learner mode.

---

## 2. Workspace map — tool strip (`BLOCK_MAP_TOOL_STRIP`)

Primary strip order from `lib/block-map-tools.ts` (`BLOCK_MAP_TOOL_STRIP`). Labels via `blockMapToolLabel`.

| Tool id | Kind | Author purpose |
|---|---|---|
| **`select`** | mode (default) | Click to select blocks/empties; **click-and-drag body** moves blocks; Shift/⌘ multi-select |
| **`lasso`** | mode | Region select; **submenu shapes:** `rect` · `circle` · `freehand` (`LASSO_SHAPE_ORDER`) |
| **`merge`** | action | Merge contiguous multi-selected blocks (opens merge / combine flow when enabled) |
| **`split`** | action | Split multi-cell block(s) into singles (toolbar when multi-cell selection qualifies) |
| **`lock_until`** | action | Enter **prereq-edit**: target block + multi-select prerequisites; confirm/clear lock-until gates |
| **`mark_unusable`** | action | Mark/clear **unusable ground** on multi-selected empty cells (path-shaping) |
| **`clear_selection`** | action | Clear map selection |
| **`zoom_in`** | viewport | Zoom map in |
| **`zoom_out`** | viewport | Zoom map out |
| **`recenter`** | viewport | Recenter on start / default cell |

### Demoted / gesture-only tools (still matter; not on primary strip)

| Id / gesture | How authors use it |
|---|---|
| **`move`** | Demoted: use **Select** + click-and-drag (body drag). Legacy mode id still recognized. |
| **`lasso_circle` / `lasso_freehand`** | Not separate strip buttons; shapes under single **Lasso** control |
| **`generate_shape`** | Omitted from strip: multi empty selection opens **Generate in shape** in the right pane |
| **Edit / delete** | Not on strip: **Edit** drawer on sole block detail |

### Map gestures (BlockSkillGrid)

| Gesture | Purpose |
|---|---|
| **Select click** | Sole focus / toggle; re-click sole may clear (resolved via pointer gesture helpers) |
| **Click-and-drag on block** | Move sole or multi membership; settle on mouseup via grid op `move` |
| **Edge/corner stretch handles** | Sole-selected only: enlarge footprint; preview while dragging; settle on mouseup via `resize` |
| **Empty click** | Open **Add block** (single placeable empty) |
| **Shift multi empty** | **Generate in shape** when ≥2 placeable empties |
| **Empty drag / Space / middle mouse** | **Pan** viewport |
| **Lasso drag** | Multi-select blocks and/or empties by region |
| **Double-click block** | Open block detail focus (host-dependent) |
| **Expand-job pending cells** | Generation-locked chrome while multi-create / bridge jobs run |

---

## 3. Right-pane surfaces (map column)

Resolver: `resolveWorkspaceRightPane` → `WorkspaceRightPaneKind` in `lib/workspace-right-pane.ts`.

| Kind | When it opens | Author tools |
|---|---|---|
| **`map_tools`** | Default (no sole block / no empty create) | Map authoring hints / ground tool summary (`WorkspaceMapAuthoringPane`) |
| **`block_detail`** | Exactly one filled block selected | Peer drawers (below) |
| **`combine_blocks`** | ≥2 filled blocks multi-selected | Combine + Bridge |
| **`add_block`** | Single placeable empty selected | Create one or range/density expand multi-create |
| **`generate_shape`** | ≥2 placeable empties multi-selected | Contiguous freeform/rect lecture shape generation form |

### 3.1 Sole block detail drawers (`WorkspaceBlockDetailPane`)

Accordion peer drawers (one open at a time):

| Drawer id | Title | Purpose |
|---|---|---|
| **`detail`** | Block title / sessions label | Launch / session-style block body (`SessionItem` detail) |
| **`simulation`** | **Block Simulation** | Per-block 3 questions + 3 exercises; regenerate; context chips |
| **`split`** | Split | Multi-cell / freeform only: split into singles |
| **`edit`** | Edit | Title, description, **starter (`is_start`)** flag; update / delete |
| **`local`** | Local context | Notes, local files, global file refs, external resource ids for that block |

### 3.2 Multi-block: Combine (`WorkspaceCombineBlocksPane`)

| Drawer | Purpose |
|---|---|
| **Combine blocks** (`combine`) | Merge contiguous selection into one larger freeform/rect block (prompted merge) |
| **Bridge Blocks** (`bridge`) | Corridor multi-create between anchors; density control; preview on map when drawer open |

### 3.3 Add block (`WorkspaceAddBlockPane`)

| Capability | Purpose |
|---|---|
| Single-cell create | Prompt → place one block at selected empty |
| **Range / Density expand** | Multi 1×1 create in expanding neighborhood of empties |
| **Starter flag** | Optionally mark created block(s) as starters |
| Suggest topics | AI topic suggestions for the form |
| Local context (on create path) | Optional materials for new content |

### 3.4 Generate in shape (`WorkspaceGenerateShapePane`)

| Capability | Purpose |
|---|---|
| Multi-empty freeform / solid shape | Generate lecture-shaped multi-cell block(s) from selection |
| Context source picker | Use workspace notes / files / external sources for generation |

---

## 4. Grid / map-ground operations (persist path)

Author-facing ops routed through `onGridOp` → `/api/workspace/grid-ops` and map-ground APIs:

| Op | Trigger | What it does |
|---|---|---|
| **`move`** | Body drag mouseup | Translate block(s), preserve shape; collision-safe |
| **`resize`** | Stretch handle mouseup | Sole-block solid-rect expand of bbox; clears freeform mask |
| **`merge`** | Merge tool / combine | Combine footprints + AI title/description |
| **`split`** | Split tool / drawer | Break multi-cell into 1×1 cells |
| **`generate_shape`** | Generate pane | Create from empty multi-selection |
| **`update_block`** | Edit drawer | Title, description, starter flag |
| **`delete_block`** | Edit drawer | Remove block; clean peer next/lock links |
| **Lock until** | `lock_until` tool | Persist `lock_until_block_ids` prerequisites |
| **Unusable cells** | `mark_unusable` | Persist unusable ground on workspace |
| **Expand / bridge jobs** | Add expand + Bridge | Background multi-create with pending cell chrome |

---

## 5. Context section

Surface: `WorkspaceContextPanel` (+ notes/files, external resources).

| Tool | Purpose |
|---|---|
| **Workspace notes** | Author-facing course notes (saved via notes API) |
| **Workspace files** | Upload / attach files used as generation & practice context |
| **External resources** | Link external URLs/resources |
| **Dantes search** | Search/add external context helpers |
| **Suggest external context** | Related tooling for sourcing materials |

---

## 6. Simulation section (workspace-level)

Surface: `WorkspaceSimulationPanel` — **not** the Block Simulation drawer.

| Tool | Purpose |
|---|---|
| **Learner journey overview** | Stats: blocks, starters, locked, local-context counts |
| **Sample paths** | BFS paths from starters via `next_block_ids` |
| **Sample practice probes** | Preview Q/Ex from start (or first) blocks via pure derive |
| **Interaction modes** | Labels for map / Explore / Drill / gates |
| **Run validation** | Holistic check of **name, goal, blocks, context, structure, learner path** |
| **Validation findings + ideas** | Severity-tagged findings and actionable improvement recommendations + score |

Inputs wired from host: title, `workspace_goal`, description, notes, blocks, file count.

---

## 7. Settings section (privileged)

Surface: `WorkspaceIntegrationPanel` subviews (`SETTINGS_SUBVIEWS`):

| Subview | Purpose |
|---|---|
| **`general`** | Identity (title/topic/description) + access settings (public / group / AYCL, etc.) |
| **`regions`** | Custom knowledge / verification regions |
| **`knowledge-portal`** | Knowledge portal configuration |
| **`guest-links`** | Guest / share links for learners |
| **`data-studio`** | Data studio panel for workspace analytics/export-style work |
| **`integrations`** | Integration skill/spec generation, MCP/API-oriented author tooling |

Also related: **Access** copy/chrome on workspace shell for sharing posture.

---

## 8. Knowledge section (privileged)

| Surface | Purpose |
|---|---|
| **Performance / knowledge panel** | Author/owner view of performance reporting and knowledge-config style insights (`mountsPerformancePanel`) — analytics rather than map edit |

---

## 9. Block content model (what authors shape)

| Field / concept | Author meaning |
|---|---|
| **Title / description** | Map label + practice seed text |
| **`is_start` (starter)** | Entry points for Simulation paths |
| **`next_block_ids`** | Forward journey edges |
| **`lock_until_block_ids`** | Prerequisite gates |
| **`span_w` / `span_h` / `shape_cells`** | Footprint (rect or freeform polyomino) |
| **Local context** | Per-block notes/files/refs for grounded practice |
| **Status** | Progress chrome (author/learner display) |
| **Workspace goal / notes / files** | Course-level intent and materials |

---

## 10. Quick map: “I want to…” → tool

| Goal | Where |
|---|---|
| Place a new topic | Empty cell → **Add block** |
| Create many nearby 1×1s | Add → **Range/Density** |
| Create corridor between two regions | Multi-select → **Bridge Blocks** |
| Merge neighbors | Multi-select contiguous → **Merge** / **Combine** |
| Split a large block | Sole multi-cell → **Split** drawer or strip |
| Resize bigger | Sole select → **edge/corner stretch** |
| Move blocks | Select → **drag body** |
| Set learning order | **Lock until** + next-links |
| Block off map cells | Multi empty → **Unusable ground** |
| Attach course materials | **Context** section |
| Attach block materials | Detail → **Local context** |
| Preview learner path | **Simulation** section |
| Health-check the course | Simulation → **Run validation** |
| Practice probes for one block | Detail → **Block Simulation** |
| Rename / delete / starter | Detail → **Edit** |
| Sharing & identity | **Settings** |

---

## Exclusions

Not treated as **course map authoring** tools in this report (exist elsewhere in the product):

- Learner TAP / TAPBench exercise runtime and stash flows  
- ILE (in-lesson experience) guest sessions and realtime POW  
- Muse / Helios voice dialogue during a live session  
- Global admin, billing, org invite flows (except Settings access flags)  
- Public marketing / pitch / demo landing pages  

---

## Source index (for maintainers)

| Concern | Primary files |
|---|---|
| Section keys | `lib/workspace-sections.ts` |
| Map strip ids | `lib/block-map-tools.ts` (`BLOCK_MAP_TOOL_STRIP`) |
| Right pane kinds | `lib/workspace-right-pane.ts` |
| Map UI + stretch/gestures | `components/BlockSkillGrid.tsx` |
| Block detail drawers | `components/WorkspaceBlockDetailPane.tsx` |
| Combine / bridge | `components/WorkspaceCombineBlocksPane.tsx`, `lib/bridge-blocks.ts` |
| Add / expand | `components/WorkspaceAddBlockPane.tsx`, `lib/add-block-range-density.ts` |
| Simulation overview | `lib/workspace-simulation-overview.ts`, `components/WorkspaceSimulationPanel.tsx` |
| Created DAGs tab | `lib/workspace-dags.ts`, `components/WorkspaceDagsPanel.tsx` |
| Workspace validation | `lib/workspace-simulation-validation.ts` |
| Block simulation | `lib/block-simulation.ts`, `components/WorkspaceBlockSimulationPanel.tsx` |
| Grid ops API | `app/api/workspace/grid-ops/route.ts` |
| Map ground | `lib/map-ground-rules.ts` |
| Shell hosts | `components/WorkspaceView.tsx`, `components/AyclWorkspaceView.tsx` |

---

*Generated from shipped code inventory; update this file when strip tools, section keys, or primary drawers change.*
