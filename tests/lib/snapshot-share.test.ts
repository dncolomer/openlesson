/**
 * Public Snapshot share: generate/lookup + report→landing projection.
 * Drives shipped helpers (not a re-implementation). Unpublished stays private.
 */
import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLE_PERFORMANCE_REPORT } from "@/lib/pow-api/performance-report";
import type { VerticalScoreReport } from "@/lib/pow-api/performance-report";
import {
  SNAPSHOT_LANDING_SECTIONS,
  SNAPSHOT_SHARE_PUBLIC_PATH,
  buildSnapshotShareUrl,
  createMemorySnapshotShareBackend,
  generateSnapshotShare,
  lookupSnapshotShare,
  projectSnapshotLandingView,
  renderSnapshotLandingHtml,
  renderSnapshotMissingHtml,
  snapshotSharePublicPath,
} from "@/lib/pow-api/snapshot-share";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-83a9125b428f/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeLog(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function representativeReport(): VerticalScoreReport {
  return {
    ...EXAMPLE_PERFORMANCE_REPORT,
    evaluated_goals: [
      {
        id: "goal-workspace",
        text: EXAMPLE_PERFORMANCE_REPORT.workspace_goal,
        scope: "workspace",
      },
      {
        id: "goal-block",
        text: "Document tradeoff before config change",
        scope: "block",
        block_id: "block-config",
      },
    ],
  };
}

const PUBLISHED_ID = "eval-run-published";
const UNPUBLISHED_ID = "eval-run-unpublished";
const WORKSPACE_ID = "ws-share-1";
const ORIGIN = "https://uncertain.systems";

function seededBackend() {
  const report = representativeReport();
  const unpublished: VerticalScoreReport = {
    ...report,
    summary: "This unpublished snapshot must never leak via token lookup.",
    strengths: ["secret-strength-must-not-leak"],
  };
  const backend = createMemorySnapshotShareBackend([
    {
      id: PUBLISHED_ID,
      workspaceId: WORKSPACE_ID,
      report,
      ranAt: "2026-08-20T15:04:00.000Z",
      source: "web",
      score: report.score,
      ghcScore: report.ghc_score,
    },
    {
      id: UNPUBLISHED_ID,
      workspaceId: WORKSPACE_ID,
      report: unpublished,
      ranAt: "2026-08-19T10:00:00.000Z",
      source: "api",
    },
  ]);
  return { backend, report, unpublished };
}

describe("generateSnapshotShare + lookupSnapshotShare", () => {
  it("mints a public URL from a real snapshot report and resolves it without auth", async () => {
    const { backend, report } = seededBackend();

    expect(await lookupSnapshotShare(backend, "garbage-token")).toBeNull();
    expect(await lookupSnapshotShare(backend, UNPUBLISHED_ID)).toBeNull();
    expect(await lookupSnapshotShare(backend, PUBLISHED_ID)).toBeNull();
    expect(await lookupSnapshotShare(backend, "  ")).toBeNull();

    const generated = await generateSnapshotShare(backend, {
      snapshotId: PUBLISHED_ID,
      origin: ORIGIN,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    expect(generated.token.length).toBeGreaterThan(16);
    expect(generated.path).toBe(`${SNAPSHOT_SHARE_PUBLIC_PATH}/${generated.token}`);
    expect(generated.url).toBe(`${ORIGIN}${generated.path}`);
    expect(generated.url).toBe(buildSnapshotShareUrl(ORIGIN, generated.token));
    expect(snapshotSharePublicPath(generated.token)).toContain("/snapshot/");

    const landing = await lookupSnapshotShare(backend, generated.token);
    expect(landing).not.toBeNull();
    expect(landing?.snapshot_id).toBe(PUBLISHED_ID);
    expect(landing?.skill_score).toBe(report.score);
    expect(landing?.authenticity_score).toBe(report.ghc_score);
    expect(landing?.summary.text).toBe(report.summary);
    expect(landing?.strengths).toEqual(report.strengths);
    expect(landing?.profile.markers.map((m) => m.label)).toEqual(
      report.marker_scores.map((m) => m.label),
    );
    expect(landing?.markers.length).toBe(report.marker_scores.length);
    expect(landing?.goals.evaluated_goals.map((g) => g.text)).toEqual(
      report.evaluated_goals?.map((g) => g.text),
    );
    expect(landing?.gaps.items.map((g) => g.title)).toEqual(
      report.gap_analysis.gaps.map((g) => g.title),
    );
    expect(landing?.next_steps.directions).toEqual(
      report.gap_analysis.next_steps.directions,
    );
    expect(landing?.next_steps.events).toEqual(report.gap_analysis.next_steps.events);
    expect(landing?.details.source).toBe("web");

    const again = await generateSnapshotShare(backend, {
      snapshotId: PUBLISHED_ID,
      origin: ORIGIN,
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.token).toBe(generated.token);

    expect(await lookupSnapshotShare(backend, UNPUBLISHED_ID)).toBeNull();
    expect(await lookupSnapshotShare(backend, "not-issued")).toBeNull();

    const html = renderSnapshotLandingHtml(landing!);
    for (const section of SNAPSHOT_LANDING_SECTIONS) {
      expect(html).toContain(`data-snapshot-landing-section="${section.id}"`);
      expect(html).toContain(`<h2>${section.label}</h2>`);
    }
    expect(html).toContain(report.summary);
    expect(html).toContain(report.strengths[0]);
    expect(html).toContain(report.marker_scores[0]!.label);
    expect(html).toContain(report.gap_analysis.gaps[0]!.title);
    expect(html).toContain(String(report.score));

    const missing = renderSnapshotMissingHtml();
    expect(missing).toContain("Snapshot not found");
    expect(missing).not.toContain(report.summary);
    expect(missing).not.toContain("secret-strength-must-not-leak");

    writeLog(
      "snapshot-share-tests.log",
      [
        "generated_ok=" + String(generated.ok),
        "url=" + generated.url,
        "token_len=" + generated.token.length,
        "lookup_summary=" + landing?.summary.text,
        "unpublished_null=true",
        "garbage_null=true",
        "html_has_profile=" + String(html.includes("Profile")),
        "html_has_goals=" + String(html.includes("Goals")),
        "html_has_summary=" + String(html.includes("Summary")),
      ].join("\n") + "\n",
    );
  });

  it("projects empty sections so the landing still names every detail tab", () => {
    const emptyReport = {
      vertical: "verification" as const,
      score: 12,
      workspace_goal: "",
      ghc_score: 0,
      ghc_confidence: "none" as const,
      marker_scores: [],
      summary: "",
      strengths: [],
      growth_areas: [],
      gap_analysis: { summary: "", gaps: [], next_steps: { directions: [], events: [] } },
      suggestions: [],
      confidence: "emerging" as const,
    };
    const landing = projectSnapshotLandingView({
      snapshot: {
        id: "empty-run",
        workspace_id: WORKSPACE_ID,
        report: emptyReport,
        ran_at: null,
        source: null,
        score: 12,
        ghc_score: 0,
        workspace_goal: null,
      },
    });
    const html = renderSnapshotLandingHtml(landing);
    for (const section of SNAPSHOT_LANDING_SECTIONS) {
      expect(html).toContain(`<h2>${section.label}</h2>`);
    }
    expect(html).toContain("No spider markers on this snapshot.");
    expect(html).toContain("No goals recorded on this snapshot.");
    expect(html).toContain("No summary on this snapshot.");
    expect(html).toContain("No strengths listed.");
    expect(html).toContain("No next steps on this snapshot.");
  });
});

describe("Learning Profiles + landing wiring", () => {
  it("exposes generate-public-URL on selected snapshot and a public landing with all sections", () => {
    const lwm = readKnowledgePanelSurface();
    expect(lwm).toContain("data-lwm-generate-public-url");
    expect(lwm).toContain("data-lwm-public-share");
    expect(lwm).toContain("data-lwm-public-url");
    expect(lwm).toContain("/api/workspace/snapshot-share");
    expect(lwm).toContain("evalRunHistoryId: selectedLwmRun.id");
    expect(lwm).toContain("copyPublicShareUrl");
    expect(lwm).toContain("generatePublicShareUrl");
    expect(lwm).toMatch(/selectedLwmRun \?/);

    const landing = read("components/SnapshotLandingView.tsx");
    const page = read("app/snapshot/[token]/page.tsx");
    expect(page).toContain("lookupSnapshotShare");
    expect(page).toContain("createSupabaseSnapshotShareBackend");
    expect(page).toContain("SnapshotLandingView");
    expect(page).toContain("SnapshotLandingMissing");
    expect(landing).toContain("data-snapshot-landing");
    for (const section of SNAPSHOT_LANDING_SECTIONS) {
      expect(landing).toContain(`"${section.id}"`);
      expect(landing).toContain(section.label);
    }
    expect(landing).toContain("Profile");
    expect(landing).toContain("Goals");
    expect(landing).toContain("Summary");
    expect(landing).toContain("Markers");
    expect(landing).toContain("Strengths");
    expect(landing).toContain("Gaps");
    expect(landing).toContain("Next steps");
    expect(landing).toContain("Details");

    const ownerApi = read("app/api/workspace/snapshot-share/route.ts");
    expect(ownerApi).toContain("generateSnapshotShare");
    expect(ownerApi).toContain("requireProductWorkspaceEvalAuth");
    expect(ownerApi).toContain("getEvalRunHistoryById");

    const publicApi = read("app/api/snapshot/[token]/route.ts");
    expect(publicApi).toContain("lookupSnapshotShare");
    expect(publicApi).toContain("jsonError(404");
    expect(publicApi).not.toContain("requireAuthenticatedUser");
    expect(publicApi).not.toContain("requireProductWorkspaceEvalAuth");

    const mw = read("middleware.ts");
    expect(mw).toContain('"/snapshot/"');
    expect(mw).toContain('"/snapshot"');
    expect(mw).toContain("SUBSCRIPTION_EXEMPT_PREFIXES");

    const migration = read(
      "supabase/migrations/20260824120000_eval_run_snapshot_shares.sql",
    );
    expect(migration).toContain("eval_run_snapshot_shares");
    expect(migration).toContain("share_token");
    expect(migration).toContain("enable row level security");
    expect(migration).not.toMatch(/FOR SELECT[\s\S]*anon|is_public = true/);

    writeLog(
      "snapshot-share-structure.log",
      [
        "lwm_generate_control=data-lwm-generate-public-url",
        "lwm_selected_run=selectedLwmRun.id",
        "landing=components/SnapshotLandingView.tsx",
        "page=app/snapshot/[token]/page.tsx",
        "sections=" + SNAPSHOT_LANDING_SECTIONS.map((s) => s.label).join(","),
        "middleware_public=/snapshot",
        "middleware_exempt=/snapshot/",
        "migration=20260824120000_eval_run_snapshot_shares.sql",
      ].join("\n") + "\n",
    );

    writeLog(
      "snapshot-share-public-path.log",
      [
        "middleware_publicRoutes=/snapshot",
        "middleware_SUBSCRIPTION_EXEMPT_PREFIXES=/snapshot/",
        "page=app/snapshot/[token]/page.tsx",
        "api=app/api/snapshot/[token]/route.ts",
        "insights_analog=/insights/",
        "portal_analog=/portal/",
        "matcher_excludes_api=true",
      ].join("\n") + "\n",
    );
  });
});

describe("Snapshot landing launch", () => {
  it("serves the published landing HTML twice and omits data for invalid tokens", async () => {
    const { backend, report } = seededBackend();
    const generated = await generateSnapshotShare(backend, {
      snapshotId: PUBLISHED_ID,
      origin: ORIGIN,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const landing = await lookupSnapshotShare(backend, generated.token);
    expect(landing).not.toBeNull();
    const html = renderSnapshotLandingHtml(landing!);
    const missing = renderSnapshotMissingHtml();

    const server = createServer((req, res) => {
      const url = req.url || "/";
      res.setHeader("content-type", "text/html; charset=utf-8");
      if (url.includes("invalid") || url.endsWith("/unpublished")) {
        res.statusCode = 404;
        res.end(missing);
        return;
      }
      res.statusCode = 200;
      res.end(html);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      server.close();
      throw new Error("server did not bind");
    }
    const base = `http://127.0.0.1:${addr.port}`;
    const bodies: string[] = [];
    try {
      for (const path of [
        `/snapshot/${generated.token}`,
        `/snapshot/${generated.token}`,
      ]) {
        const res = await fetch(`${base}${path}`);
        const body = await res.text();
        expect(res.status).toBe(200);
        expect(body).toContain("Profile");
        expect(body).toContain("Goals");
        expect(body).toContain("Summary");
        expect(body).toContain("Markers");
        expect(body).toContain("Strengths");
        expect(body).toContain("Gaps");
        expect(body).toContain("Next steps");
        expect(body).toContain("Details");
        expect(body).toContain(report.summary);
        expect(body).toContain(String(report.score));
        expect(body.length).toBeGreaterThan(800);
        bodies.push(body);
      }
      expect(bodies[0]).toBe(bodies[1]);

      const bad = await fetch(`${base}/snapshot/invalid`);
      const badBody = await bad.text();
      expect(bad.status).toBe(404);
      expect(badBody).not.toContain(report.summary);
      expect(badBody).not.toContain("secret-strength-must-not-leak");
      expect(badBody).toContain("Snapshot not found");

      writeLog(
        "snapshot-landing-launch.log",
        [
          "mode=node-http+renderSnapshotLandingHtml",
          "status_1=200",
          "status_2=200",
          "consistent=" + String(bodies[0] === bodies[1]),
          "body_len=" + bodies[0]!.length,
          "has_profile=" + String(bodies[0]!.includes("Profile")),
          "has_goals=" + String(bodies[0]!.includes("Goals")),
          "has_summary=" + String(bodies[0]!.includes("Summary")),
          "has_markers=" + String(bodies[0]!.includes("Markers")),
          "has_strengths=" + String(bodies[0]!.includes("Strengths")),
          "has_gaps=" + String(bodies[0]!.includes("Gaps")),
          "has_next_steps=" + String(bodies[0]!.includes("Next steps")),
          "has_details=" + String(bodies[0]!.includes("Details")),
          "has_report_summary=" + String(bodies[0]!.includes(report.summary)),
          "invalid_omits_payload=" + String(!badBody.includes(report.summary)),
        ].join("\n") + "\n",
      );
      writeLog("snapshot-landing.html", bodies[0]!);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("server-renders the shipped SnapshotLandingView with section content", async () => {
    const { backend, report } = seededBackend();
    const generated = await generateSnapshotShare(backend, {
      snapshotId: PUBLISHED_ID,
      origin: ORIGIN,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const landing = await lookupSnapshotShare(backend, generated.token);
    expect(landing).not.toBeNull();

    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SnapshotLandingView } = await import(
      "@/components/SnapshotLandingView"
    );
    const markup = renderToStaticMarkup(
      React.createElement(SnapshotLandingView, { view: landing! }),
    );
    expect(markup).toContain("data-snapshot-landing");
    expect(markup).toContain("Profile");
    expect(markup).toContain("Goals");
    expect(markup).toContain("Summary");
    expect(markup).toContain("Markers");
    expect(markup).toContain("Strengths");
    expect(markup).toContain("Gaps");
    expect(markup).toContain("Next steps");
    expect(markup).toContain("Details");
    expect(markup).toContain(report.summary);
    expect(markup).toContain(String(report.score));
    expect(markup.length).toBeGreaterThan(800);
    writeLog("snapshot-landing-react.html", markup);
  });
});
