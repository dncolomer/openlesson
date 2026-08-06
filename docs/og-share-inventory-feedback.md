# OG / share card inventory — feedback draft

**How to use this file**
- Review each surface below (copy is quoted from shipped code as of this export).
- Edit freely: strike things you dislike, rewrite titles/descriptions, mark priorities.
- Fill in the `Feedback` fields under each surface (or add notes inline).
- Send this file back when ready.

**Card chrome (composed images)**  
Composed cards (`lib/og/compose.tsx`, 1200×630 PNG) show:

| Chrome field | What it is |
|--------------|------------|
| brand | Top-left (default: Uncertain Systems) |
| eyebrow | Amber uppercase badge next to brand |
| title | Main headline |
| description | Supporting line under title |
| footerLabel | Amber pill bottom-left — CTA-style chrome (**not** a URL) |
| siteLabel | Bottom-right (default: `uncertain.systems`) |
| background | Aesthetics image + dark gradient |

**Counts:** 7 registry surfaces · 8 dedicated `opengraph-image` routes · 3 `twitter-image` re-exports · many metadata-only pages.

---

## Global feedback

| Question | Your notes |
|----------|------------|
| Overall tone (too technical / too marketing / OK)? | |
| Should footerLabel read like a CTA everywhere? | |
| Prefer one shared aesthetic vs per-surface? | |
| Priority pages to fix first? | |
| Anything missing entirely (new pages that need OG)? | |

---

## 1. Registry surfaces (composed cards)

Source of truth: `lib/og/surfaces.ts`. Static routes use thin `app/**/opengraph-image.tsx` handlers.

### 1.1 home — `/`

| Field | Shipped value |
|-------|----------------|
| **path** | `/` |
| **title** | Learning efficiency for humans & agents |
| **description** | Measure what learners actually absorb — not just completion. Proof-of-Work API, Think Aloud Protocol, ILE, and ALE on Workspaces. |
| **eyebrow** | Learning efficiency |
| **footerLabel** | LEARNING EFFICIENCY • HUMANS & AGENTS |
| **brand** | Uncertain Systems |
| **image / aesthetic** | `/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg` |
| **image route** | `/opengraph-image` (+ `app/twitter-image.tsx` re-export) |
| **alt** | Uncertain Systems — Learning efficiency for humans & agents |

**Also in root layout metadata** (`app/layout.tsx`) — slightly different copy:

| Field | Metadata value |
|-------|----------------|
| OG title | Uncertain Systems — Learning Efficiency for Humans & Agents |
| OG description | Measure what learners actually absorb — not just completion. Four products on Workspaces. |
| Twitter title | Uncertain Systems — Learning Efficiency Platform |
| Twitter description | Optimize learning efficiency with Proof-of-Work API, Think Aloud Protocol, ILE, and Agentic Learning Environment. |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.2 pricing — `/pricing`

| Field | Shipped value |
|-------|----------------|
| **path** | `/pricing` |
| **title** | Pricing — Proof-of-Work volume |
| **description** | Meter proof-of-work artifacts across TAP, ILE, and the API. Plans scale with measurement and learning world model effort. |
| **eyebrow** | Pricing |
| **footerLabel** | Plans |
| **brand** | Uncertain Systems |
| **image / aesthetic** | seed `/pricing` → `/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg` |
| **image route** | `/pricing/opengraph-image` (+ twitter re-export) |
| **alt** | Uncertain Systems — Pricing — Proof-of-Work volume |

**Layout metadata** (`app/pricing/layout.tsx`):

| Field | Metadata value |
|-------|----------------|
| OG title | Pricing - Proof-of-Work Volume \| Uncertain Systems |
| OG description | (same as registry description) |
| Twitter title | Pricing \| Uncertain Systems |
| Twitter description | Proof-of-work volume pricing for humans and agents. |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.3 vision — `/vision`

| Field | Shipped value |
|-------|----------------|
| **path** | `/vision` |
| **title** | Self-driving technology for learning |
| **description** | Non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy. |
| **eyebrow** | Vision |
| **footerLabel** | Company |
| **brand** | Uncertain Systems |
| **image / aesthetic** | `/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg` |
| **image route** | `/vision/opengraph-image` |
| **alt** | Uncertain Systems — Self-driving technology for learning |

**Page metadata** OG title: `Vision | Uncertain Systems` · shorter OG description (drops “energy” clause).

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.4 science — `/science`

| Field | Shipped value |
|-------|----------------|
| **path** | `/science` |
| **title** | A holistic model of knowledge |
| **description** | Knowledge configuration, proximity, transformation, and a non-invasive path to self-driving learning. |
| **eyebrow** | Science |
| **footerLabel** | Research |
| **brand** | Uncertain Systems |
| **image / aesthetic** | `/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg` |
| **image route** | `/science/opengraph-image` |
| **alt** | Uncertain Systems — A holistic model of knowledge |

**Page metadata** OG title: `Science | Uncertain Systems`.

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.5 docs-proof-of-work-api — `/docs/proof-of-work-api`

| Field | Shipped value |
|-------|----------------|
| **path** | `/docs/proof-of-work-api` |
| **title** | Proof-of-Work API specification |
| **description** | Enable AI agents to upload proof of work on Workspaces, issue Think Aloud Protocol links, route ILE practice, and read learning efficiency results. |
| **eyebrow** | Docs |
| **footerLabel** | API reference |
| **brand** | Uncertain Systems |
| **image / aesthetic** | seed → `/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg` |
| **image route** | `/docs/proof-of-work-api/opengraph-image` |
| **alt** | Uncertain Systems — Proof-of-Work API specification |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.6 insight — `/insights/[id]` (dynamic)

| Field | Shipped value |
|-------|----------------|
| **path** | `/insights/[id]` |
| **title (default)** | Insight |
| **description (default)** | A bookmark from think-aloud learning on Uncertain Systems. |
| **title (live)** | `{insight.title}` |
| **description (live)** | `{insight.summary}` |
| **eyebrow** | Insight |
| **footerLabel** | Think-aloud bookmark |
| **brand** | Uncertain Systems |
| **image / aesthetic** | insight aesthetic if under `/aesthetics/…`; else seed → Greco-futurism |
| **image route** | `/insights/{id}/opengraph-image` (+ twitter re-export) |
| **alt** | Uncertain Systems insight |
| **siteLabel (live)** | `uncertain.systems/insights/{slug}` |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

### 1.7 public-workspace — `/p/[id]/[slug]` (dynamic)

| Field | Shipped value |
|-------|----------------|
| **path** | `/p/[id]/[slug]` |
| **title (default)** | Workspace |
| **description (default)** | A public workspace on Uncertain Systems. |
| **title (live)** | plan.title \|\| root_topic \|\| title-cased slug |
| **description (live)** | plan.description or default above |
| **eyebrow** | Public workspace |
| **footerLabel** | Public plan |
| **brand** | Uncertain Systems |
| **image / aesthetic** | cover_image_url if aesthetics path; else seed by workspace id → e.g. `/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg` |
| **image route** | `/p/{id}/{slug}/opengraph-image` |
| **alt** | Workspace |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

## 2. Ad-hoc composed OG (not a registry id)

### 2.1 AYCL workspace landing — `/all-you-can-learn/[workspaceId]`

Reuses **pricing** surface chrome with overrides (`app/all-you-can-learn/[workspaceId]/opengraph-image.tsx`).

| Field | Shipped value |
|-------|----------------|
| **title** | `landing.title` or `All-You-Can-Learn` |
| **description** | `landing.summary` (≤160) or *Curated lifetime learning environments — pay once, fork privately, learn at your pace.* |
| **eyebrow** | All-You-Can-Learn |
| **footerLabel** | Lifetime access |
| **siteLabel** | path snippet with workspace id prefix |
| **alt** | All-You-Can-Learn workspace |
| **image route** | `/all-you-can-learn/{workspaceId}/opengraph-image` |

**Feedback**

```
Keep / change:
Priority (P0/P1/P2):
Notes:
```

---

## 3. openGraph metadata; image reuses **home** card

These set OG title/description but point images at `/opengraph-image` (home art), not a custom card.

### 3.1 `/hackathons`

| Field | Shipped value |
|-------|----------------|
| OG title | Hackathons · Projects & Community \| Uncertain Systems |
| OG description | Events on frontier knowledge — probabilistic computing, learning systems, and more. |
| images | `/opengraph-image` (alt: Hackathons) |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

### 3.2 `/hackathons/probabilistic-computing`

| Field | Shipped value |
|-------|----------------|
| OG title | Probabilistic Computing Hackathon · ETH Zurich \| Uncertain Systems |
| OG description | Past event: build with probabilistic and thermodynamic computing — EBMs, THRML, Extropic, and Uncertain Systems. |
| images | `/opengraph-image` (alt: Probabilistic Computing Hackathon) |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

### 3.3 `/workspace/[id]` (private workspace)

| Field | Shipped value |
|-------|----------------|
| OG title | `{title} - Uncertain Systems` |
| OG description | plan.description or `A workspace on Uncertain Systems` |
| images | `/opengraph-image` (intentional: no private workspace OG art) |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

---

## 4. openGraph text only — **no images[]**

Crawlers may fall back to root/default; no dedicated share art wired.

### 4.1 `/map-of-knowledge`

| Field | Shipped value |
|-------|----------------|
| OG title | The Map of Knowledge \| Uncertain Systems |
| OG description | Interactive map of public knowledge configuration space — regions, user locations, and proof-of-work aggregates. |
| images | **not set** |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

### 4.2 `/tapbench`

| Field | Shipped value |
|-------|----------------|
| OG title | TAPBench \| Uncertain Systems |
| OG description | Run Think Aloud Protocol benchmarks against agents. Long term: an agentic Map of Knowledge. |
| images | **not set** |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

### 4.3 `/science/think-aloud-protocol`

| Field | Shipped value |
|-------|----------------|
| OG title | TAP Stash/Submit White Paper \| Uncertain Systems |
| OG description | A methods white paper on the Think Aloud Protocol Stash/Submit interface for externalizing dual-process thought traces as Proof of Work data, and a planned experiment on embeddings and Map of Knowledge regions. |
| images | **not set** |

**Feedback**

```
Keep / change:
Need dedicated OG image? (Y/N):
Notes:
```

---

## 5. Title / description only — no openGraph block

These only set `metadata.title` / `description` (or nothing). Share previews typically inherit root defaults unless a crawler invents something.

| path | title | description | notes | Your feedback |
|------|-------|-------------|-------|---------------|
| `/all-you-can-learn` | *(client page — no metadata export)* | inherits root | catalog | |
| `/skill-verification` | Hard Skill Verification for Recruitment & HR \| Uncertain Systems | Self-Service Skill Check and Self-Service Take-Home for recruitment teams, startup HR, and recruitment service providers. Hard skill verification that scales, without AI-faked test results. | **noindex** | |
| `/sales` | Sales | — | **noindex** | |
| `/sales/self-service-skill-check` | Self-Service Skill Check \| Sales | Candidates open a private link, complete a ~15-minute self-service think-aloud evaluation, and the client receives a role ranking plus optional per-candidate strength/weakness reports. | **noindex** | |
| `/sales/self-service-take-home` | Self-Service Take-Home \| Sales | Candidates complete an open-ended, multi-block assignment inside the tool… | **noindex** | |
| `/sales/learning-loop` | Learning Loop \| Sales | After a class, tutorial video… drive a customizable-length learning check… | **noindex** | |
| `/sales/pow-augmented-apps` | PoW Augmented Apps \| Sales | Stream proof-of-work data from your product in real time… | **noindex** | |
| `/pitch` | Verification Pitch | — | **noindex** | |
| `/click-moments` | Click Moments | A library of shareable Uncertain Systems click moments. | | |
| `/click-moments/blockchain-tx-validation` | Blockchain TX Validation Click Moment | A shareable Uncertain Systems card capturing the blockchain transaction validation click moment. | in-page aesthetic only | |
| `/click-moments/software-design-clicks` | Software Design Click Moment | A shareable Uncertain Systems card capturing the software design click moment. | in-page aesthetic only | |
| `/quiz/[id]` | Quiz {id}: {topic} or Helios Quiz | question text or default | | |
| `/session/mobile/[sessionId]` | Mobile Block \| Uncertain Systems | Continue your learning session on mobile | | |
| `/cookies` | Cookie Policy - Uncertain Systems | Cookie Policy for Uncertain Systems - How we use cookies on our website | | |
| `/privacy` | Privacy Policy - Uncertain Systems | Privacy Policy for Uncertain Systems - How we collect, use, and protect your data | | |
| `/terms` | Terms & Conditions - Uncertain Systems | Terms and Conditions for Uncertain Systems | | |
| `/legal` | Legal Notice - Uncertain Systems | Legal Notice and company information for Uncertain Systems | | |

**Section feedback**

```
Which of these need real share cards?
Which should stay noindex / bare?
Notes:
```

---

## 6. Twitter image re-exports

| file | re-exports |
|------|------------|
| `app/twitter-image.tsx` | home `opengraph-image` |
| `app/pricing/twitter-image.tsx` | pricing `opengraph-image` |
| `app/insights/[id]/twitter-image.tsx` | insights `opengraph-image` |

Other routes only set `twitter.images` in metadata to the opengraph-image URL.

**Feedback**

```
Need more dedicated twitter-image routes? (Y/N):
Notes:
```

---

## 7. Gaps / inconsistencies (for prioritization)

Edit priority next to each row.

| # | Gap | Your priority (P0/P1/P2 / ignore) | Notes |
|---|-----|-----------------------------------|-------|
| 1 | footerLabel is chrome, not a real CTA link | | |
| 2 | Metadata copy ≠ registry card copy (home, pricing punctuation) | | |
| 3 | Hackathons + private `/workspace` share home art | | |
| 4 | Map of Knowledge, TAPBench, TAP whitepaper: OG text, no images | | |
| 5 | AYCL catalog has no metadata → root defaults | | |
| 6 | Sales / skill-verification / pitch: no composed OG; often noindex | | |
| 7 | AYCL entity OG reuses pricing chrome (no own registry id) | | |
| 8 | Only 3 twitter-image routes exist | | |

---

## 8. Freeform notes

```
(paste anything else — preferred CTAs, banned words, brand rules, examples of good share cards, etc.)
```

---

## Source index (for implementers)

**Registry / helpers:** `lib/og/surfaces.ts`, `compose.tsx`, `create-static-og.ts`, `paths.ts`, `aesthetic.ts`, `text.ts`, `index.ts`

**Image routes:**
```
app/opengraph-image.tsx
app/twitter-image.tsx
app/pricing/opengraph-image.tsx
app/pricing/twitter-image.tsx
app/vision/opengraph-image.tsx
app/science/opengraph-image.tsx
app/docs/proof-of-work-api/opengraph-image.tsx
app/insights/[id]/opengraph-image.tsx
app/insights/[id]/twitter-image.tsx
app/p/[id]/[slug]/opengraph-image.tsx
app/all-you-can-learn/[workspaceId]/opengraph-image.tsx
```

**Structural tests:** `tests/lib/og-inventory-review.test.ts`, `tests/lib/og-system.test.ts`
