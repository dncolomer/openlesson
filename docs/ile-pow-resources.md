# TAP Learning Proof of Work as a resource

TAP Learning treats Proof of Work as one spendable pool. Typed artifacts (tools, screen, video, EEG) plus spoken thought traces add to the pool. Starting extra **Work** and **Gather resources** both consume from it.

## What counts

| Display | Spendable? | Source |
| --- | --- | --- |
| Tools | yes | Work canvas board actions (draw/move/rotate/delete/Expand More/board prompt), chat, gather, other tool events |
| Screen | yes | screen-share stills |
| Video | yes | webcam / face (when present) |
| EEG | yes | Muse bands (impure samples excluded) |
| Thoughts | yes (capacity) | speech segments and thought traces |

Counts are session-global. Switching the focused chapter does not split the economy.

## Expense slider

Welcome settings expose how many chapters the session has (1–5, manually or via Skirmish, Campaign, and Blitz), the session-wide insight goal, **Work expense**, **Insight crafts per turn**, **Gather appetite**, language, the canvas timer, silence, and aesthetics. Those settings do not offer a map or board type.

- Cheaper → extra Work costs fewer units, so the same pool affords more chapters in parallel.
- More expensive → extra Work costs more, so the journey stays more linear.

Default is 3, which matches the historic Gather floors (2 tools and 3 total typed units).

## Spends

1. **First Work** on a chapter is free. It opens that chapter’s dialogue.
2. **Additional Work** is allowed only when remaining pool ≥ the slider-scaled cost. If spend is refused, the extra chapter does not open.
3. **Gather resources** uses the same pool and the same slider for its minimums and consume amounts. Rate limits still apply.

Spent units are not refunded when you finish a chapter. Gather refunds only if the forage request fails.

## Visualization

After settings, the stage is the focused chapter’s work canvas. There is no full-width resource bar and no turn-close button. Every chapter the session makes available is docked at once; focusing a chip opens that chapter’s canvas. Insights, the chapter dock, and the signal widgets collapse and expand on the canvas. The only bottom chrome is a short transcript bar with Exit. Exit runs the existing save path.

Welcome settings is a dedicated full-screen route (`/session/settings`, `/ile/session/{token}/settings`, `/learn/{token}/session/settings`). Confirming settings continues onto that canvas.

Crafting insights stays on the work canvas. Typed insights are evaluated by xAI and refused when they are not correct or good enough; thoughts-pool selections generate insight candidates. Accepted crafts persist as the existing insight records (workspace Insights tab, social share, dedicated `/insights/…` page) **and** as a snapshot-eligible tool Proof of Work event (`insight-crafting`) on the session stream. The insight goal is one session-wide count. It does not block crafting or mark chapters done. TAP keeps its own I’m done answering control. The Work canvas no longer has an I’m done drawing button.

Helpers: `lib/ile-pow-spend.ts`, `lib/ile-session-turn-close.ts`, `lib/ile-turn-insights.ts`, `lib/ile-gather-resources.ts`.
