# ILE Proof of Work as a resource

ILE treats Proof of Work as one spendable pool. Typed artifacts (tools, screen, video, EEG) plus spoken thought traces add to the pool. Starting extra **Work** and **Gather resources** both consume from it.

## What counts

| Display | Spendable? | Source |
| --- | --- | --- |
| Tools | yes | notebook, canvas, chat, gather, other tool events |
| Screen | yes | screen-share stills |
| Video | yes | webcam / face (when present) |
| EEG | yes | Muse bands (impure samples excluded) |
| Thoughts | yes (capacity) | speech segments and thought traces |

Counts are session-global. Switching the focused chapter does not split the economy.

## Expense slider

Welcome settings (same surface as aesthetics and map type) expose **Work expense** from 1 (cheaper) to 5 (more expensive), plus **Insight crafts per turn** and **Gather appetite**. Named setups (Skirmish, Campaign, Blitz) apply a combination of those sliders and, when the map is still choosable, a map type.

- Cheaper → extra Work costs fewer units, so the same pool affords more chapters in parallel.
- More expensive → extra Work costs more, so the journey stays more linear.

Default is 3, which matches the historic Gather floors (2 tools and 3 total typed units).

## Spends

1. **First Work** on a chapter is free. It opens that chapter’s dialogue.
2. **Additional Work** is allowed only when remaining pool ≥ the slider-scaled cost. If spend is refused, the extra chapter does not open.
3. **Gather resources** uses the same pool and the same slider for its minimums and consume amounts. Rate limits still apply.

Spent units are not refunded when you finish a chapter. Gather refunds only if the forage request fails.

## Visualization and turn close

The top resource bar shows two numbers per type in a dual pill: **submitted** (white background, black number) and **unsubmitted** (black background, white number). Unsubmitted covers stashed thoughts, forming speech, and dirty canvas/notebook that have not gone through **End turn**. A highlighted **Insights** counter sits next to those resource pills, with a quieter **Global resources** control beside Insights. **End turn** floats at the bottom-right with a double border and a right-pointing arrow; docked chapter chips sit beside it with no connecting line. There is no Review work button on ILE chrome. Global resources opens a map widget with one tab per resource type (same icons as the bar). Thoughts is not a chapter-widget tab. Picture-in-Picture keeps **End turn** on its compact dock and hosts the crafting-insights UI in that window when End turn is activated. Chapter dialogue is a left-side map widget that uses the same box as Global resources (`ILE_MAP_WIDGET_FRAME_CLASS`: same gutter below the PoW bar as above the transcription bar, 720px wide capped to leave right-side chrome). Future map widgets should use that same frame. Minimize (–) collapses the panel without dropping the Work chip. Saving the session stores those open Work chapters (`ile_open_work_ids` in session metadata) so resume restores every chapter you clicked Work on and have not closed yet. Chapters already `in_progress` on the plan are docked the same way, even if they were not in that saved list.

Welcome settings is a dedicated full-screen route (`/session/settings`, `/ile/session/{token}/settings`, `/learn/{token}/session/settings`), not a modal on the map. Confirming settings continues into the ILE map session.

**End turn** runs the existing I’m-done-answering collect / send / flag close once per open Work, pings any other open Work that had no stashed thoughts, and also flushes dirty canvas/notebook, then opens the crafting-insights screen. Each turn can keep up to 3 insights, scaled by unused Proof of Work remaining. Crafting is optional — finishing with zero insights is allowed. Typed insights are evaluated by xAI and refused when they are not correct or good enough; thoughts-pool selections generate insight candidates. Accepted crafts persist as the existing insight records (workspace Insights tab, social share, dedicated `/insights/…` page) **and** as a snapshot-eligible tool Proof of Work event (`insight-crafting`) on the session stream. Refused evaluates and zero-craft completes do not emit that event. The new event is counted with other tool PoW; it does not reopen unused-PoW slots in the same craft. Every docked chapter chip shows a loading bar until that chapter’s Helios reply arrives, then a warning icon until the chapter is opened. TAP keeps its own I’m done answering control. Canvas/notebook no longer have I’m done writing/drawing buttons.

Helpers: `lib/ile-pow-spend.ts`, `lib/ile-session-turn-close.ts`, `lib/ile-turn-insights.ts`, `lib/ile-gather-resources.ts`.
