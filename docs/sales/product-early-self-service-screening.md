# Early Self-Service Screening

**Uncertain Systems · Hiring product**  
**Website:** [uncertain.systems](https://uncertain.systems) · **Demo:** [cal.com/daniel-colomer](https://cal.com/daniel-colomer-lvwg8w/openlesson-demo)

---

## One line

Candidates open a private link, complete a **~15-minute self-service think-aloud** evaluation, and the client receives a **role ranking** plus optional **per-candidate strength/weakness** reports.

---

## What it is

An async screening product for high-volume hiring. Each candidate gets a **link**, goes through a **timed self-service evaluation (~15 minutes)**, and **thinks out loud** through an **interactive dialog** (Think Aloud Protocol). No interviewer needs to be on the call.

| | |
|--|--|
| **Format** | Private session link |
| **Duration** | ~15 minutes, timed |
| **Mode** | Fully self-service and parallelizable |
| **Core activity** | Think-out-loud problem solving via interactive dialog |
| **Who is present** | Candidate only (product-led evaluation) |
| **Integration** | Standalone links **or API** for full automation (ATS / recruiting stack) |

---

## Inputs required

| Input | Required? | Notes |
|-------|-----------|--------|
| **Job description** | **Required** | Role definition used to scope the exercise and score **fit for this position**. |
| **Company culture / general hiring brief** | Optional | Values, bar for the team, what “good” looks like beyond the JD — improves ranking and strength/weakness framing. |

Nothing else is required to stand up a first screening for a role. From those inputs we configure the timed dialog and the scoring bar.

---

## Integration (API)

This product can also be **integrated via API for full automation**:

- Issue and track session links from your ATS or recruiting tools  
- Receive completion and report payloads without manual export  
- Drive advance / reject / route-to-next-stage workflows programmatically  

Use hosted links for a fast pilot; use the API when screening must run hands-off at campaign scale.

---

## Candidate experience

1. Receive a private link (email, ATS, or recruiter message).  
2. Open the exercise and start the timer.  
3. Work through the task while **verbalizing reasoning** in an interactive dialog.  
4. Complete the session — no multi-day wait, no file-upload black box.

Designed for **hundreds of applicants in parallel** when you are hiring at scale (e.g. ~50 seats in ~2 months).

---

## What the client gets

| Deliverable | Description |
|-------------|-------------|
| **Job-position report** | Ranking of candidates scored on **how well they would perform in the role.** |
| **Per-candidate breakdown** | **Strengths and weaknesses** for each applicant. |
| **Optional human use** | Reviewer can skim only edge cases or top-N; or skip deep review and trust rank for first cut. |
| **Downstream input** | Same breakdowns feed later stages (interview guides, calibration, take-home design, offer risk). |

---

## When to use it

- Top-of-funnel or **first technical / skill screen** when volume is high  
- When **senior interview time** is the bottleneck  
- When AI-polished application CV look similar and you need **early process signal**  
- Campaigns that must evaluate many people against **one consistent bar**

---

## Why it fits “hire a lot, fast”

| Without this product | With Early Self-Service Screening |
|----------------------|-----------------------------------|
| Screeners and engineers bottleneck volume | Dozens of evaluations run async in parallel |
| Weak candidates reach expensive interviews | Role-ranked shortlist before HM time |
| Every interviewer invents a bar | Same exercise and markers for the whole cohort |
| No reusable artifact after screen | Strengths/weaknesses pack for later stages |

---

## Suggested placement in the funnel

```
Apply → (optional) resume screen
     → Early Self-Service Screening (~15 min)  ← this product
     → HM / tech interview
     → deeper work sample (optional)
     → Offer
```

---

## Pilot sketch

1. Pick **1–2 high-volume roles** in the hiring plan.  
2. Define the **role exercise** (scoped skill / job-position workspace).  
3. Send links to the next **N applicants** at the agreed stage.  
4. Calibrate pass/advance thresholds on the **position ranking** with hiring managers.  
5. Roll out to the full campaign.

**Success metrics:** time-to-first-signal, % advanced to live interview, interviewer hours saved, shortlist quality vs. prior process.

---

## Ask / next step

- Align on **roles and stage** for screening.  
- **Book a demo** with a real job description:  
  [cal.com/daniel-colomer-lvwg8w/openlesson-demo](https://cal.com/daniel-colomer-lvwg8w/openlesson-demo)

---

*Uncertain Systems — early skill signal at hiring scale.*  
*uncertain.systems*
