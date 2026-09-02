# ILE TIM × chapter map interactions

Chapter complete is Proof of Work (`session_plan` / `chapter_done` → TIM endpoint `upload_ile_chapter_done`). TIM reads LWM `evidence_appetite` and schedules `chapter_map_expand` with **1–3** `chapter_suggestions`. ILE applies that on a **map timer** (idle/speech PoW cannot supersede it) and places adjacent TIM-sourced chapters.

Unopened TIM chapters use the explore/map icon (`tim-explore`). Accept switches them to the usual 3×3 blocky glyph; reject removes the tile so the cell is empty again.

## TIM interruption catalog (fixed)

Intervention **types** are a closed catalog (`TIM_INTERVENTION_TYPE_CATALOG`):

`reflection_prompt`, `checkpoint_probe`, `coaching_nudge`, `proof_of_work_reminder`, `performance_review`, `chapter_map_expand`.

`consumer_action` is a free-form snake_case hint (not a closed enum). ILE currently keys map growth on `chapter_map_expand` / `expand_chapter_map`.

## Follow-on ILE map actions

| id | status | TIM source | effect | summary |
| --- | --- | --- | --- | --- |
| `chapter_complete_expand` | shipped | `upload_ile_chapter_done` | positive | Done → 1–3 adjacent TIM-sourced chapters (explore icon until accepted or rejected). |
| `idle_fog_creep` | planned | `upload_ile_idle` | negative | Long idle grows fog over unvisited empty cells. |
| `idle_wilt_unopened` | planned | `upload_ile_idle` | negative | Unopened TIM tiles dim if ignored. |
| `idle_current_pulse` | planned | `upload_ile_idle` | positive | Short idle pulses the active chapter. |
| `speech_keyword_highlight` | planned | `upload_ile_speech` | positive | Highlight chapters whose keywords match speech. |
| `appetite_settle` | planned | `upload_ile_chapter_done` | neutral | Saturated expansion stops further TIM growth. |
| `skip_withdraw` | planned | skip | negative | Skipping a chapter withdraws nearby unopened TIM tiles. |

Canonical data: `ILE_TIM_MAP_INTERACTIONS` in `lib/ile-tim-chapter-complete.ts`.
