/**
 * Product pitch — 5 crisp slides (thesis → method ×2 → product → uses)
 * Layout: content left, image placeholder right on every slide.
 */
import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLORS = {
  bg: "0B0D12",
  panel: "12151C",
  card: "181C26",
  cardAlt: "1C2130",
  border: "2A3142",
  placeholder: "151922",
  placeholderBorder: "3A4258",
  white: "FFFFFF",
  ice: "C8D4F0",
  muted: "8B93A7",
  dim: "5C657A",
  accent: "7C9CFF",
  accentSoft: "3D4F8C",
  green: "6BCB9A",
  amber: "E8B86D",
};

const FONT = {
  head: "Calibri",
  body: "Calibri",
  mono: "Consolas",
};

const W = 10;
const H = 5.625;
const MARGIN = 0.45;
const GAP = 0.28;
const RIGHT_W = 3.55;
const LEFT_W = W - MARGIN * 2 - GAP - RIGHT_W;
const LEFT_X = MARGIN;
const RIGHT_X = MARGIN + LEFT_W + GAP;

function addBackground(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: { color: COLORS.bg },
    line: { color: COLORS.bg, width: 0 },
  });
}

function addImagePlaceholder(slide, label = "Image") {
  // Outer frame
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: RIGHT_X,
    y: 0.9,
    w: RIGHT_W,
    h: H - 1.25,
    fill: { color: COLORS.placeholder },
    line: { color: COLORS.placeholderBorder, width: 1.25, dashType: "dash" },
    rectRadius: 0.1,
  });

  // Crosshair / empty-state mark
  const cx = RIGHT_X + RIGHT_W / 2;
  const cy = 0.9 + (H - 1.25) / 2;
  const mark = 0.35;

  slide.addShape(pres.shapes.LINE, {
    x: cx - mark,
    y: cy,
    w: mark * 2,
    h: 0,
    line: { color: COLORS.dim, width: 1.25 },
  });
  slide.addShape(pres.shapes.LINE, {
    x: cx,
    y: cy - mark,
    w: 0,
    h: mark * 2,
    line: { color: COLORS.dim, width: 1.25 },
  });

  slide.addText(label, {
    x: RIGHT_X + 0.2,
    y: cy + 0.45,
    w: RIGHT_W - 0.4,
    h: 0.35,
    fontFace: FONT.mono,
    fontSize: 11,
    color: COLORS.dim,
    align: "center",
    margin: 0,
  });

  slide.addText("PLACEHOLDER", {
    x: RIGHT_X + 0.2,
    y: 1.1,
    w: RIGHT_W - 0.4,
    h: 0.28,
    fontFace: FONT.mono,
    fontSize: 9,
    color: COLORS.dim,
    align: "center",
    charSpacing: 2,
    margin: 0,
  });
}

function addSlideChrome(slide, { num, total, kicker }) {
  // Top kicker strip
  slide.addText(kicker, {
    x: LEFT_X,
    y: 0.28,
    w: LEFT_W,
    h: 0.28,
    fontFace: FONT.mono,
    fontSize: 10,
    color: COLORS.accent,
    bold: true,
    charSpacing: 1.5,
    margin: 0,
  });

  // Slide counter (top right of left column edge / global)
  slide.addText(`${String(num).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: RIGHT_X,
    y: 0.28,
    w: RIGHT_W,
    h: 0.28,
    fontFace: FONT.mono,
    fontSize: 10,
    color: COLORS.dim,
    align: "right",
    margin: 0,
  });
}

function addTitle(slide, title, { y = 0.62, h = 0.7 } = {}) {
  slide.addText(title, {
    x: LEFT_X,
    y,
    w: LEFT_W,
    h,
    fontFace: FONT.head,
    fontSize: 28,
    bold: true,
    color: COLORS.white,
    margin: 0,
    valign: "top",
  });
}

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Uncertain Systems";
pres.title = "Product Pitch — Learning World Model";
pres.subject = "Thesis, method, productization, integrations";

const TOTAL = 5;

/** Shared layer-card renderer for the "How we test it" slides */
function addLayerCard(slide, layer, { y, h }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: LEFT_X,
    y,
    w: LEFT_W,
    h,
    fill: { color: COLORS.card },
    line: { color: COLORS.border, width: 1 },
    rectRadius: 0.08,
  });

  const badgeY = y + (h - 0.52) / 2;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: LEFT_X + 0.18,
    y: badgeY,
    w: 0.52,
    h: 0.52,
    fill: { color: COLORS.cardAlt },
    line: { color: COLORS.border, width: 1 },
    rectRadius: 0.06,
  });
  slide.addText(layer.n, {
    x: LEFT_X + 0.18,
    y: badgeY,
    w: 0.52,
    h: 0.52,
    fontFace: FONT.mono,
    fontSize: 12,
    color: layer.accent,
    bold: true,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  slide.addText(layer.title, {
    x: LEFT_X + 0.9,
    y: y + 0.22,
    w: LEFT_W - 1.15,
    h: 0.36,
    fontFace: FONT.head,
    fontSize: 17,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  slide.addText(layer.body, {
    x: LEFT_X + 0.9,
    y: y + 0.62,
    w: LEFT_W - 1.15,
    h: h - 0.82,
    fontFace: FONT.body,
    fontSize: 13,
    color: COLORS.muted,
    margin: 0,
    valign: "top",
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 1 — Our Thesis
// ─────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  addBackground(slide);
  addSlideChrome(slide, { num: 1, total: TOTAL, kicker: "01  ·  OUR THESIS" });
  addTitle(slide, "Hard skills are not\na ratio of correct answers.");
  addImagePlaceholder(slide, "Brain config / proximity");

  // Core statement card
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: LEFT_X,
    y: 2.15,
    w: LEFT_W,
    h: 0.95,
    fill: { color: COLORS.card },
    line: { color: COLORS.border, width: 1 },
    rectRadius: 0.08,
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: LEFT_X,
    y: 2.15,
    w: 0.08,
    h: 0.95,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent, width: 0 },
  });
  slide.addText(
    "Quizzes sample thin outputs. Real competence is proximity to a useful cognitive configuration — retrievable, applicable, transformable under pressure.",
    {
      x: LEFT_X + 0.22,
      y: 2.28,
      w: LEFT_W - 0.35,
      h: 0.72,
      fontFace: FONT.body,
      fontSize: 13,
      color: COLORS.ice,
      margin: 0,
      valign: "middle",
    }
  );

  // Two pillars
  const pillars = [
    {
      label: "BRAIN CONFIG MODEL",
      body: "Holistic state of mind — not a scoreboard of right/wrong items.",
    },
    {
      label: "PROXIMITY, NOT %",
      body: "We built a model that measures distance to a learning model — a cognitive target — not pass-rate.",
    },
  ];

  pillars.forEach((p, i) => {
    const x = LEFT_X + i * (LEFT_W / 2 + 0.08);
    const w = LEFT_W / 2 - 0.08;
    const y = 3.3;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w,
      h: 1.75,
      fill: { color: COLORS.card },
      line: { color: COLORS.border, width: 1 },
      rectRadius: 0.08,
    });
    slide.addText(p.label, {
      x: x + 0.18,
      y: y + 0.22,
      w: w - 0.36,
      h: 0.35,
      fontFace: FONT.mono,
      fontSize: 10,
      color: COLORS.accent,
      bold: true,
      charSpacing: 0.8,
      margin: 0,
    });
    slide.addText(p.body, {
      x: x + 0.18,
      y: y + 0.65,
      w: w - 0.36,
      h: 0.9,
      fontFace: FONT.body,
      fontSize: 13,
      color: COLORS.ice,
      margin: 0,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 2 — How we test it (layers 01–02)
// ─────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  addBackground(slide);
  addSlideChrome(slide, { num: 2, total: TOTAL, kicker: "02  ·  HOW WE TEST IT" });
  addTitle(slide, "Three layers that make\nproximity measurable.", { h: 0.72 });
  addImagePlaceholder(slide, "PoW + cognition layers");

  const layers = [
    {
      n: "01",
      title: "Proof of Work",
      body: "Basis layer. Artifacts, tool traces, and think-aloud — evidence of work, not a multiple-choice snapshot.",
      accent: COLORS.accent,
    },
    {
      n: "02",
      title: "Genuine Human Cognition Analysis",
      body: "Chain-of-thought linearity analysis. How we capture thought is decisive — Selective Thought Interface.",
      accent: COLORS.green,
    },
  ];

  const cardH = 1.55;
  const cardGap = 0.2;
  const cardY0 = 1.55;

  layers.forEach((layer, i) => {
    addLayerCard(slide, layer, {
      y: cardY0 + i * (cardH + cardGap),
      h: cardH,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 3 — How we test it (layer 03)
// ─────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  addBackground(slide);
  addSlideChrome(slide, { num: 3, total: TOTAL, kicker: "03  ·  HOW WE TEST IT" });
  addTitle(slide, "The third layer: probe\ngaps mid-reasoning.", { h: 0.72 });
  addImagePlaceholder(slide, "Trace interruptions");

  // Featured layer 03 card
  addLayerCard(
    slide,
    {
      n: "03",
      title: "Learning Model · Trace Interruptions",
      body: "World-model style. Trace interruptions probe gaps mid-reasoning — and measure how interruption changes learning effectiveness.",
      accent: COLORS.amber,
    },
    { y: 1.55, h: 1.85 }
  );

  // Supporting detail cards under the featured layer
  const details = [
    {
      label: "PROBE GAPS",
      body: "Interrupt at decision points to surface missing knowledge while reasoning is still live.",
    },
    {
      label: "MEASURE EFFECT",
      body: "Track how interruptions shift learning effectiveness — not just whether the final answer was right.",
    },
  ];

  const detailW = (LEFT_W - 0.16) / 2;
  details.forEach((d, i) => {
    const x = LEFT_X + i * (detailW + 0.16);
    const y = 3.6;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w: detailW,
      h: 1.45,
      fill: { color: COLORS.card },
      line: { color: COLORS.border, width: 1 },
      rectRadius: 0.08,
    });
    slide.addText(d.label, {
      x: x + 0.18,
      y: y + 0.22,
      w: detailW - 0.36,
      h: 0.3,
      fontFace: FONT.mono,
      fontSize: 10,
      color: COLORS.amber,
      bold: true,
      charSpacing: 0.8,
      margin: 0,
    });
    slide.addText(d.body, {
      x: x + 0.18,
      y: y + 0.58,
      w: detailW - 0.36,
      h: 0.7,
      fontFace: FONT.body,
      fontSize: 12,
      color: COLORS.ice,
      margin: 0,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 4 — Productization
// ─────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  addBackground(slide);
  addSlideChrome(slide, { num: 4, total: TOTAL, kicker: "04  ·  PRODUCTIZED" });
  addTitle(slide, "Model surfaces in\ntwo product primitives.", { h: 0.72 });
  addImagePlaceholder(slide, "UI / interaction model");

  // Product card 1 — PoW / Submit-Stash
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: LEFT_X,
    y: 1.55,
    w: LEFT_W,
    h: 1.7,
    fill: { color: COLORS.card },
    line: { color: COLORS.border, width: 1 },
    rectRadius: 0.08,
  });
  slide.addText("PROOF OF WORK", {
    x: LEFT_X + 0.22,
    y: 1.7,
    w: LEFT_W - 0.44,
    h: 0.24,
    fontFace: FONT.mono,
    fontSize: 10,
    color: COLORS.accent,
    bold: true,
    charSpacing: 1,
    margin: 0,
  });
  slide.addText("Submit–Stash interaction", {
    x: LEFT_X + 0.22,
    y: 2.0,
    w: LEFT_W - 0.44,
    h: 0.35,
    fontFace: FONT.head,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  slide.addText(
    "Stream answers continuously. Learner (or agent) signals submit or stash — scoring attaches to intent, not just final paste.",
    {
      x: LEFT_X + 0.22,
      y: 2.42,
      w: LEFT_W - 0.44,
      h: 0.6,
      fontFace: FONT.body,
      fontSize: 13,
      color: COLORS.muted,
      margin: 0,
    }
  );

  // Product card 2 — Selective Thought UI
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: LEFT_X,
    y: 3.45,
    w: LEFT_W,
    h: 1.7,
    fill: { color: COLORS.card },
    line: { color: COLORS.border, width: 1 },
    rectRadius: 0.08,
  });
  slide.addText("SELECTIVE THOUGHT INTERFACE", {
    x: LEFT_X + 0.22,
    y: 3.6,
    w: LEFT_W - 0.44,
    h: 0.24,
    fontFace: FONT.mono,
    fontSize: 10,
    color: COLORS.green,
    bold: true,
    charSpacing: 1,
    margin: 0,
  });
  slide.addText("UI inside TAP & ILE tools", {
    x: LEFT_X + 0.22,
    y: 3.9,
    w: LEFT_W - 0.44,
    h: 0.35,
    fontFace: FONT.head,
    fontSize: 18,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  slide.addText(
    "Capture method is the product. Thought UI lives inside Think Aloud Protocol and Integrated Learning Environment tool surfaces — not a bolt-on form.",
    {
      x: LEFT_X + 0.22,
      y: 4.32,
      w: LEFT_W - 0.44,
      h: 0.65,
      fontFace: FONT.body,
      fontSize: 13,
      color: COLORS.muted,
      margin: 0,
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDE 5 — How these can be used
// ─────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  addBackground(slide);
  addSlideChrome(slide, { num: 5, total: TOTAL, kicker: "05  ·  HOW THEY'RE USED" });
  addTitle(slide, "What each product is for.", { h: 0.5 });
  addImagePlaceholder(slide, "Integration map");

  // Three product groups: PoW · TAP · ILE — business-value use cases
  const groups = [
    {
      label: "PoW",
      accent: COLORS.accent,
      cases: [
        "Screen hires on real work, not résumés",
        "Gate certifications on proof, not quizzes",
        "Stop weak agent or CI output before it ships",
      ],
    },
    {
      label: "TAP",
      accent: COLORS.green,
      cases: [
        "Run live think-aloud interviews",
        "Capture how experts actually solve problems",
        "Verify remote work was done by a human",
      ],
    },
    {
      label: "ILE",
      accent: COLORS.amber,
      cases: [
        "Replace take-homes with coached practice",
        "Close skill gaps found after assessment",
        "Onboard teams with real job scenarios",
      ],
    },
  ];

  const cardH = 1.15;
  const cardGap = 0.12;
  const cardY0 = 1.35;

  groups.forEach((g, i) => {
    const y = cardY0 + i * (cardH + cardGap);

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: LEFT_X,
      y,
      w: LEFT_W,
      h: cardH,
      fill: { color: COLORS.card },
      line: { color: COLORS.border, width: 1 },
      rectRadius: 0.08,
    });

    // Left accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: LEFT_X,
      y,
      w: 0.07,
      h: cardH,
      fill: { color: g.accent },
      line: { color: g.accent, width: 0 },
    });

    // Group label
    slide.addText(g.label, {
      x: LEFT_X + 0.22,
      y: y + 0.14,
      w: 0.7,
      h: cardH - 0.28,
      fontFace: FONT.mono,
      fontSize: 13,
      color: g.accent,
      bold: true,
      margin: 0,
      valign: "middle",
    });

    // Use cases as one multi-line block
    slide.addText(
      g.cases.map((c, j) => ({
        text: `·  ${c}`,
        options: { breakLine: j < g.cases.length - 1 },
      })),
      {
        x: LEFT_X + 1.0,
        y: y + 0.12,
        w: LEFT_W - 1.2,
        h: cardH - 0.24,
        fontFace: FONT.body,
        fontSize: 12,
        color: COLORS.ice,
        margin: 0,
        valign: "middle",
        paraSpaceAfter: 3,
      }
    );
  });
}

const outPath = path.join(__dirname, "product-pitch.pptx");
await pres.writeFile({ fileName: outPath });
console.log(`Wrote ${outPath}`);
