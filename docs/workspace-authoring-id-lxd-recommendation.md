# Workspace authoring tools — exposure and ID vs LXD recommendation

**Product:** OpenLesson workspace (map-first learning-experience builder)  
**Kind:** Advice only — do not treat this as an implementation spec.  
**Constraint:** Derived from the **live registries** in source (2026-09-04), not from memory and not solely from `docs/course-authoring-tools-report.md` (that file is an older inventory; see [Drift vs inventory report](#drift-vs-inventory-report)).  
**Out of scope:** Learner runtime (TAP, ILE, Muse/Helios in-session), admin/billing, marketing. Knowledge Region shells are noted only as a gated subset of the same ids.

**How to read:**  
1. [Authoring-surface inventory](#authoring-surface-inventory) names every shipped registry id.  
2. [Exposure verdicts](#exposure-verdicts) judge whether each family is optimally mounted.  
3. [ID vs LXD gap table](#id-vs-lxd-gap-table) scores eight frozen rubric rows.  
4. [Prioritized recommendations](#prioritized-recommendations) are now / later / out of product.

---

## Authoring-surface inventory

### Top-level sections (`WORKSPACE_SECTION_KEYS`)

Registry: `lib/workspace-sections.ts`. Nav order for a **Build-mode owner**: Workspace · DAGs · Map Types · Goals · Context · Simulation · Knowledge · Settings.

| Id | Who sees it | What it is today |
|---|---|---|
| `workspace` | Everyone with access (default). Hidden on Knowledge Region. | Map-first authoring: skill grid, left strip, selection-driven right pane. |
| `dags` | Owner only, **Build** only (hidden in Play / Explore). | Catalog of created multi-block **leads-to** DAGs. List / edit / delete. **No create** — create is map multi-select `dag` Apply. |
| `map_types` | Owner only, **Build** only (nav omitted when Explore is open). | Custom chapter-map types + enable/disable library types. Generator context (occupancy / order paint), not 1:1 lesson templates. |
| `goals` | Owner / org admin. | Multi natural-language **workspace goals** CRUD (`WorkspaceGoalsPanel`). Not the block-detail `goals` drawer. |
| `context` | Everyone in Build (hidden in Play). | Workspace materials: notes, files, external links, Dantes search. |
| `simulation` | Everyone in Build (hidden in Play). | **Shipped UI:** entire-workspace sample generate + durable simulation **collection** (questions / exercises). **Not** the unused journey-overview / validation libs. Distinct from block-detail `simulation`. |
| `knowledge` | Owner / org admin in Build; logged-in Play users get a reduced LWM + embeddings surface. | Analytics: Ranking, Strengths & Gaps, LWM snapshot (goal-evaluated), Embeddings. Not map edit. |
| `settings` | Owner / org admin. | Identity, AYCL, Knowledge Regions, Knowledge Portal, Knowledge Links, Data Studio, Integrations. |

**Gating (not extra ids):** `availableWorkspaceSections` + `availableSectionsForMode`. Consumers in Build: `workspace`, `context`, `simulation` only. Play: `workspace` (+ `knowledge` if logged in). Knowledge Region owners: `goals`, `knowledge`, `settings` only.

### Map tool strip (`BLOCK_MAP_TOOL_STRIP`)

Registry: `lib/block-map-tools.ts`. Mounted on the map column in **Build** when the mode shell allows the authoring strip (`showAuthoringToolStrip` — owner / privileged). Hidden in Play.

| Id | Kind | What it does |
|---|---|---|
| `select` | mode (default) | Click select; click-and-drag **moves**; Shift/⌘ multi-select. |
| `lasso` | mode | Region select. Submenu shapes `rect` / `circle` / `freehand` (`LASSO_SHAPE_ORDER`) — not separate strip buttons. |
| `merge` | action | Merge contiguous multi-selected blocks (also offered as the `combine` drawer). |
| `split` | action | Split multi-cell block(s) into singles (also the sole-block `split` drawer). |
| `clone` | action | Arm clone of the sole selected block; empty-cell click pastes. Strip-only — no drawer. |
| `lock_until` | action | Enter **prereq-edit** mode: target + multi-select prerequisites; confirm/clear gates. |
| `mark_unusable` | action | Mark / clear unusable ground on selected empty cells (path shaping). |
| `clear_selection` | action | Clear map selection (returns right pane to `map_tools`). |
| `zoom_in` | viewport | Zoom in. |
| `zoom_out` | viewport | Zoom out. |
| `recenter` | viewport | Recenter on start / default cell. |

**Recognized but not on the strip (deferred as strip ids; still author-relevant):**

| Id / gesture | Why deferred from this registry | How authors hit it |
|---|---|---|
| `move` | Demoted; click-and-drag in `select`. | Gesture. |
| `lasso_circle` / `lasso_freehand` | Shapes under `lasso`, not strip tools. | Lasso submenu. |
| `generate_shape` (tool id) | Omitted from strip on purpose. | Right-pane kind `generate_shape` when ≥2 placeable empties are selected. |
| Edit / delete | Not strip tools. | Drawers `edit` and `danger`. |
| Edge/corner stretch | Gesture, not a tool id. | Sole-selected block handles → grid op `resize`. |
| Empty click / Shift multi-empty | Gesture. | Opens `add_block` or `generate_shape`. |
| Space / middle-mouse / empty drag | Gesture. | Pan. |

### Right-pane kinds (`WorkspaceRightPaneKind`)

Resolver: `resolveWorkspaceRightPane` in `lib/workspace-right-pane.ts`. Priority: 2+ filled blocks → combine; sole block → detail; empty create; else map tools.

| Id | When it mounts | Author tools |
|---|---|---|
| `map_tools` | Default empty selection, Explore overlay closed. | Idle hint only (`WorkspaceMapAuthoringPane`). Points authors at the left strip and Context. |
| `block_detail` | Exactly one filled block selected (Build). | Sole-block accordion drawers (next table). Play uses the learner practice pane instead (`soleBlockPane: learner_practice`). |
| `combine_blocks` | ≥2 filled blocks selected. | Multi-select drawers (table after next). |
| `add_block` | Single placeable empty (Build, not Explore). | Prompt, attach context, range/density expand, starter flag. |
| `generate_shape` | ≥2 placeable empties (Build). | Lecture-shaped multi-create from the selection + context source picker. |
| `explore_block` | Explore overlay + placeable empty. | Explore-block drawer (`map_explore_block`) — not Add. |

### Sole-block drawers (`workspaceBlockDetailDrawerIds`)

Call used for this review (full authoring stack):

`workspaceBlockDetailDrawerIds({ canEdit: true, showSplit: true, showExpand: true, hasGoals: true, showEffects: true })`

Yields, in order: `simulation`, `split`, `expand_block`, `edit`, `danger`, `goals`, `effect_dynamic`, `effect_generator`, `local`.

| Id | Title in UI | Purpose |
|---|---|---|
| `simulation` | Block Simulation | Per-block 3 questions + 3 exercises, regenerate, deposit to Simulation collection. Not the `simulation` **section**. |
| `split` | Split | Multi-cell / freeform only: split into singles. Gated by `showSplit`. |
| `expand_block` | Expand block | Neighborhood multi-create from this block. Gated by `showExpand`. |
| `edit` | Edit | Title, description, starter (`is_start`), **practice options** (Explore/Drill × Dialog/Solo + TAP durations). |
| `danger` | Danger zone | Delete this block. Peer of Edit, not nested in it. |
| `goals` | Goals | Per-block natural-language goals CRUD. Gated by `hasGoals` (persisted block + workspace). Distinct from section `goals`. |
| `effect_dynamic` | Dynamic | Combinable effect: generate content when unlock-after blocks are Done. Not DAG / `lock_until` edges. |
| `effect_generator` | Generator | Combinable effect: on complete, spawn blocks on picked empty cells. |
| `local` | Local context | Per-block notes, local files, global file refs, external resource ids. |

No `detail` drawer exists in this registry (the older inventory still lists one). Session launch in Build is not a block-detail drawer; Play uses the learner pane.

### Multi-select drawers (`workspaceMultiSelectDrawerIds`)

`workspaceMultiSelectDrawerIds()` → `combine`, `bridge`, `cluster`, `dag`, `simulation`, `danger`.

| Id | Title in UI | Purpose |
|---|---|---|
| `combine` | Combine blocks | Merge contiguous selection into one broader block (prompted). |
| `bridge` | Bridge Blocks | Corridor multi-create between anchors; density / width; map preview. |
| `cluster` | Cluster blocks | Physically relocate selection into N groups with separation + optional prompt. |
| `dag` | DAG | Visual next/lock graph among the selection; Suggest + Apply. Creates / updates a workspace DAG record. |
| `simulation` | Simulation | Multi-block sample generate; deposits into the Simulation **section** collection. |
| `danger` | Danger zone | Batch delete the selection. |

### Explore overlay (not in the five registries — named so it is not mistaken for a gap)

While the under-minimap toggle is **Explore**, the right column is the map-explore accordion (`MAP_EXPLORE_DRAWER_IDS`): `map_overview`, `map_search`, `map_suggest_spot`, `map_selective`, plus `map_explore_block` when an empty is selected (`explore_block` kind). These are LXD search / suggest / area-summary tools, not Build create.

### Settings subviews (section `settings` only)

`ALL_SETTINGS_SUBVIEWS`: `general`, `aycl`, `regions`, `knowledge-portal`, `guest-links`, `data-studio`, `integrations`. Identity (title/description) lives here; **workspace goals do not**.

---

## Exposure verdicts

Verdicts are **keep / promote / demote / relocate / hide**, tied to where the family is mounted now (left strip vs gesture vs right-pane drawer vs top-level section vs owner-only vs Build/Play/Explore).

| Family | Mounted now | Verdict | One-line reason |
|---|---|---|---|
| Map (`workspace`) + `select` / `lasso` / viewport (`zoom_in`, `zoom_out`, `recenter`) / `clear_selection` | Left strip, Build | **keep** | The map is the authoring canvas; select + lasso + viewport belong on the strip, not in a drawer. |
| Move | Gesture in `select` (legacy `move` id) | **keep** | Demotion off the strip is correct; a dedicated Move tool would fight click-select. |
| `clone` | Left strip | **keep** | Paste-onto-empty is a pointer tool; a drawer would hide the source/target gesture. |
| `lock_until` | Left strip (prereq-edit mode) | **keep** | Prerequisite painting is a map mode; a coordinate form would be worse. Copy should still say “prerequisites,” not only “lock.” |
| `mark_unusable` | Left strip | **keep** | Path-shaping is ground, not block metadata; strip + empty selection is the right mount. |
| `merge` (strip) vs `combine` (drawer) | Strip action **and** `combine_blocks` drawer | **demote** (strip `merge`) | Multi-select already opens `combine`; the strip duplicate is a second entry to the same job. |
| `split` (strip) vs `split` (drawer) | Strip action **and** sole-block drawer | **demote** (strip `split`) | Split is only valid for a multi-cell sole selection, which already has a contextual drawer. |
| `generate_shape` tool vs pane | Right pane `generate_shape` only | **keep** | Omitting it from the strip is already optimal: empty multi-select *is* the command. |
| Idle `map_tools` pane | Right pane default | **relocate** (content) | A static tip wastes the primary empty state; this is the natural home for a compact journey / validation snapshot (libs already exist, unmounted). |
| `add_block` | Right pane on single empty | **keep** | Create-on-click-empty is the expected spatial authoring path. |
| `expand_block` | Sole-block drawer | **keep** | Growth from a source block is a detail action, not a strip mode. |
| `bridge` / `cluster` | Multi-select drawers | **keep** | Spatial composition tools belong on the multi-select surface, not as top-level sections. |
| Sequence: `dag` drawer + `dags` section | Drawer creates; owner tab catalogs | **relocate** (`dags` tab) | Create-on-map / manage-on-tab splits “sequence the course” across IA. Keep the drawer; fold the catalog under Simulation or a Map “Journeys” home later. |
| `goals` section | Owner/org-admin top-level | **promote** | ID starts with objectives; the tab is correctly first-class but is owner-gated, unstructured NL, and disconnected from block `goals` and Simulation items. |
| Block `goals` drawer | Accordion after `danger` | **promote** | Block outcomes are buried below delete; authors will set title/practice and never open Goals. |
| `edit` + practice options | Sole-block `edit` drawer | **keep** | Identity + allowed modalities belong on the block. Starter flag here is correct. |
| `danger` (sole + multi) | Peer drawer | **keep** | Separating delete from Edit is the right exposure. |
| `local` + section `context` | Block drawer + top-level | **keep** | Global materials vs per-block grounding is a clean split. |
| `effect_dynamic` / `effect_generator` | Sole-block drawers, after goals | **promote** | These are the product’s personalization/engagement differentiators and sit below housekeeping. |
| Block `simulation` + multi `simulation` | Drawers | **keep** | Probe generation next to the block(s) is the right scale. |
| Section `simulation` | Top-level, Build | **promote** (restore journey) / **keep** collection | Comments still call this “learner-journey overview”; shipped UI is a question bank. Collection should stay; journey + validation should come back to this tab. |
| `map_types` | Owner, Build, hidden in Play/Explore | **keep** | Advanced generator context; hiding it outside Build is correct. Do not promote to a template gallery unless the product wants that metaphor. |
| `knowledge` | Privileged analytics | **keep** (not authoring) | Evaluation of *learners* against goals, not of the instruction. Do not hide from owners; do not pretend it is an ID design surface. |
| `settings` | Privileged | **keep** | Access and identity. Correct that goals left this surface. |
| `explore_block` + Explore overlay | Under-minimap Explore | **keep** | Learner-perspective search/suggest without mixing into Add. |
| Build / Play / Explore toggle | Under minimap | **keep** Play hide; **promote** a Build-side preview | Play correctly strips authoring chrome, but that is a mode switch, not an iterate-in-place preview. Authors need a learner-perspective pass **without** losing drawers. |
| Knowledge Region (`goals` / `knowledge` / `settings` only) | Kind gate | **keep** | Not a course map; omitting `workspace` / `dags` / `map_types` / `context` / `simulation` is correct. |

**Net:** Spatial authoring (map, strip modes, selection-driven create/combine) is well exposed. Instructional *design* objects (objectives, sequence as one job, assessment alignment, instruction health) are either unstructured, split across mounts, or implemented in libs that the Simulation tab no longer shows.

---

## ID vs LXD gap table

Rubric is the industry distinction (ID = systematic instruction / objectives / assessment / evaluation; LXD = learner-centered journey, preview/iteration, engagement, personalization). Not a third-party product.

| # | Rubric row | Status | Evidence in workspace authoring | Recommendation (or no gap) |
|---|---|---|---|---|
| 1 | **ID — measurable learning objectives** | **partial** | Section `goals` and drawer `goals` are free-text CRUD. LWM snapshots evaluate against those texts. Session-time `generateObjectives` (`lib/xai.ts`) is **not** a workspace authoring tool. No audience/verb/criterion fields, no Bloom (or equivalent) structure, no “done when…” evidence. Workspace validation’s goal checks exist in `validateWorkspaceSimulation` but are **not mounted**. | **Now:** treat workspace goals as observable outcomes in copy + remount goal-health on Simulation. **Later:** light structure (who / does what / evidence) and optional generate-from-title. Do not ship a taxonomy picker as a product. |
| 2 | **ID — content + sequence + prerequisites** | **present** | Content = map blocks (`add_block`, `generate_shape`, `expand_block`, `bridge`, `cluster`, `map_types`). Sequence = `dag` / `next_block_ids` + `dags` catalog. Prerequisites = `lock_until`. Starters = `edit` `is_start`. Unusable ground shapes paths. | **No gap** on capability. Exposure gap only: sequence is split (`lock_until` strip vs `dag` drawer vs `dags` tab). Unify in copy and, later, IA — do not add a fourth sequencer. |
| 3 | **ID — assessment aligned to those objectives** | **partial** | Practice options on `edit` (Explore/Drill × Dialog/Solo + durations). Block/multi/workspace `simulation` generate questions and exercises into a collection. Live TAP/ILE is runtime, not an authoring matrix. Nothing binds a goal id to a probe or collection item. | **Later:** tag simulation-collection items with workspace/block goal ids; show “unassessed goals.” **Now:** do not invent a quiz builder — the practice surfaces already *are* the assessment. |
| 4 | **ID — evaluation of the instruction** | **partial** | `knowledge` / LWM evaluates **learners** vs goals (beyond pass/fail — good LXD overlap). Data Studio is export/analytics. `validateWorkspaceSimulation` (name, goal, blocks, context, structure, learner_path) is the instruction-health check and is **unmounted** from `WorkspaceSimulationPanel`. No author-facing A/B of designs. | **Now:** remount validation + score on the `simulation` section (code already ships). **Out of product:** Kirkpatrick suites, experimental design tooling. |
| 5 | **LXD — learner journey / experience mapping** | **partial** | The map + starters + next + locks *is* a spatial journey. `deriveWorkspaceSimulationOverview` builds sample paths and a journey summary — **unmounted**. Section `simulation` no longer shows paths. No persona or emotional-journey map (and none is required). | **Now:** put sample paths + journey summary on the Simulation tab (and/or idle `map_tools`). **Later:** optional path highlighter on the map from that overview. **Out of product:** persona research canvases. |
| 6 | **LXD — learner-perspective preview and iteration** | **partial** | Play mode is a real learner shell (practice pane, no strip). Explore overlay is search/suggest from a visitor stance. Block Simulation probes preview practice. Authors **cannot** keep editing chrome while previewing; Play hides `context` / `simulation` / drawers. Iteration is “switch mode,” not a loop. | **Later:** Build-mode “preview as learner” that keeps selection and a one-click return to the same drawer. **Now:** Simulation tab should at least show path + probes without leaving Build. |
| 7 | **LXD — interaction and engagement design** | **present** | Practice modality matrix on `edit`; Explore vs Drill; Dynamic / Generator effects; spatial clustering, bridges, unusable ground, map types; local + workspace context; map notes from Explore selective summary. This is stronger than typical ID page-turners. | **No gap** on capability. **Promote** `effect_dynamic` / `effect_generator` in drawer order so authors discover them. |
| 8 | **LXD — personalization and feedback loops beyond pass/fail** | **partial** | Dynamic unlock-from-history and Generator spawn are authored personalization (not `lock_until`). LWM / GHC / strengths-gaps are feedback beyond Done. Block status is still completed/done. Authors do not design formative feedback copy or adaptive *rules* beyond those two effects. | **Keep** effects as the authoring model. **Later:** surface Dynamic/Generator on the map as first-class badges with a short “what the learner will see.” **Out of product:** general-purpose rules engines and LMS gradebook feedback designers. |

**Summary:** The product is **stronger as an LXD map studio than as a classical ID system**. Sequence, interaction design, and (runtime) knowledge evaluation are real. The missing ID spine is **measurable objectives ↔ aligned probes ↔ instruction health**, most of which is a *mounting* problem (unused Simulation libs) rather than a greenfield build.

---

## Prioritized recommendations

Advice only. This goal does not implement them.

### Now (highest leverage, mostly remount / IA / copy)

1. **Restore Simulation as the author journey + health surface.** Keep the collection/generate UI. Add back (from existing `deriveWorkspaceSimulationOverview` + `validateWorkspaceSimulation`) sample paths, journey summary, and instruction-health findings. This is the single change that most closes ID evaluation and LXD journey mapping without new primitives.
2. **Use the idle `map_tools` pane as a 3-line journey/health teaser** that deep-links to the Simulation tab. Stop spending the default right column on a toolbar reminder.
3. **Name sequence as one job in chrome.** Strip `lock_until` label → “Prerequisites”; `dag` drawer → “Leads to / sequence”; `dags` tab subtitle → “Saved journeys (create on the map).” No new control.
4. **Promote block `goals` and effects in the sole-block accordion** (suggested order: `simulation` → `goals` → `edit` → `effect_dynamic` → `effect_generator` → `local` → `split` / `expand_block` → `danger`). Objectives and engagement before delete.
5. **Goal copy:** workspace and block goal placeholders should ask for an observable outcome (“A learner can … as shown by …”), matching what validation already wants.

### Later (real product work, still in-family)

6. **Demote strip `merge` and `split`** once the drawers are the obvious path; keep keyboard/enablement if needed. Shrinks the strip toward modes + ground + clone + viewport.
7. **Relocate the `dags` catalog** under Simulation (“Journeys”) or a Map sub-home so owners do not hunt a create-less tab.
8. **Build-mode learner preview** (Play optics, author chrome retained, or a preview overlay). Closes the iterate-in-place LXD hole.
9. **Align collection items to goal ids** (workspace + block). Show uncovered goals. This is the assessment-alignment step; do not add a separate quiz editor.
10. **Light objective structure** (optional fields on `goals`: outcome + evidence). Generate-from-title using the existing session `generateObjectives` prompt family if it can be scoped to workspace authoring without mixing tutoring sessions.
11. **Map badges for Dynamic/Generator** that explain learner-facing behavior in one sentence.

### Out of product

- Full ADDIE / SAM process managers, persona research suites, empathy maps as documents.
- SCORM / xAPI / LMS package export (unless a later distribution goal).
- Bloom taxonomy pickers, Kirkpatrick dashboards, experimental A/B of instruction.
- A linear storyboard or page-turner authoring mode that duplicates the map.
- A fourth sequence editor (storyboard + DAG + lock_until + something else).
- Treating `knowledge` as an authoring canvas, or hiding `map_types` from owners in Build.

---

## Drift vs inventory report

`docs/course-authoring-tools-report.md` is still useful as a map of *older* mounts. Do not use it as the recommendation. Material drift vs live registries:

| Topic | Inventory report | Live source |
|---|---|---|
| Sole-block drawers | `detail`, `simulation`, `split`, `edit`, `local` | `simulation`, `split`, `expand_block`, `edit`, `danger`, `goals`, `effect_dynamic`, `effect_generator`, `local` — **no `detail`** |
| Multi-select drawers | Combine + Bridge only | `combine`, `bridge`, `cluster`, `dag`, `simulation`, `danger` |
| Right-pane kinds | five kinds | six: adds `explore_block` |
| Simulation **section** | Journey overview, sample paths, validation, score | Generate + collection only; overview/validation **unmounted** |
| Settings subviews | `general`, `regions`, `knowledge-portal`, `guest-links`, `data-studio`, `integrations` | Adds `aycl`; guest-links labeled Knowledge Links |
| Goals | Workspace goals tab mentioned | Also block-detail `goals`; Settings no longer edits a single goal |
| Strip | Matches `BLOCK_MAP_TOOL_STRIP` | Still accurate for strip ids |

---

## Source index

| Concern | File |
|---|---|
| Section keys + auth | `lib/workspace-sections.ts` |
| Build / Play / Explore | `lib/workspace-mode.ts` |
| Strip + prereq-edit | `lib/block-map-tools.ts` |
| Right pane + drawer id functions | `lib/workspace-right-pane.ts` |
| Map ground | `lib/map-ground-rules.ts` |
| Simulation overview (unmounted) | `lib/workspace-simulation-overview.ts` |
| Simulation validation (unmounted) | `lib/workspace-simulation-validation.ts` |
| Simulation tab UI | `components/WorkspaceSimulationPanel.tsx` |
| Block drawers | `components/WorkspaceBlockDetailPane.tsx` |
| Multi-select drawers | `components/WorkspaceCombineBlocksPane.tsx` |
| Section hosts | `components/workspace-view/workspace-section-hosts.tsx` |
| Older inventory | `docs/course-authoring-tools-report.md` |

---

*Recommendation from shipped registries; implement only via a later goal.*
