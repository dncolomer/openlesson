/**
 * Build docs/sales/early-self-service-screening.docx for Google Drive upload.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "early-self-service-screening.docx");
const CONTENT_W = 10224;

const thin = { style: BorderStyle.SINGLE, size: 8, color: "CCCCCC" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const headerFill = "F3F4F6";
const labelFill = "FAFAFA";

function body(text, after = 140) {
  return new Paragraph({
    spacing: { after },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 200 },
    children: [
      new TextRun({ text, font: "Arial", size: 32, bold: true, color: "111111" }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({ text, font: "Arial", size: 26, bold: true, color: "111111" }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: opts.size ?? 20,
            bold: Boolean(opts.bold),
            color: opts.color ?? "222222",
          }),
        ],
      }),
    ],
  });
}

function twoColTable(rows, col1 = 3000, col2 = CONTENT_W - 3000) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [col1, col2],
    rows: rows.map((row) => {
      const isHeader = Boolean(row.isHeader);
      return new TableRow({
        children: [
          cell(row[0], col1, {
            bold: true,
            fill: isHeader ? headerFill : labelFill,
          }),
          cell(row[1], col2, {
            bold: isHeader,
            fill: isHeader ? headerFill : undefined,
          }),
        ],
      });
    }),
  });
}

function threeColTable(header, dataRows, widths = [2800, 2000, CONTENT_W - 4800]) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: header.map((h, i) =>
          cell(h, widths[i], { bold: true, fill: headerFill }),
        ),
      }),
      ...dataRows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) =>
              cell(c, widths[i], {
                bold: i === 0,
                fill: i === 0 ? labelFill : undefined,
              }),
            ),
          }),
      ),
    ],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "111111" },
        paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "111111" },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets2",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets3",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1008, right: 1008, bottom: 1008, left: 1008 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "E5E7EB",
                  space: 4,
                },
              },
              spacing: { after: 120 },
              children: [
                new TextRun({
                  text: "Uncertain Systems  ·  Hiring product",
                  font: "Arial",
                  size: 18,
                  color: "6B7280",
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "E5E7EB",
                  space: 4,
                },
              },
              spacing: { before: 80 },
              children: [
                new TextRun({
                  text: "uncertain.systems  ·  Page ",
                  font: "Arial",
                  size: 16,
                  color: "9CA3AF",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  color: "9CA3AF",
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        h1("Early Self-Service Screening"),

        h2("In One line"),
        body(
          "Candidates open a private link, complete a ~15-minute self-service think-aloud evaluation, and the client receives a role-level candidate ranking plus optional per-candidate strength/weakness reports.",
        ),

        h2("What it is"),
        body(
          "An async screening product for high-volume hiring. Each candidate gets a link, goes through a timed self-service evaluation (~15 minutes), and thinks out loud through an interactive dialog (Think Aloud Protocol). No interviewer needs to be on the call.",
        ),
        twoColTable([
          { 0: "Attribute", 1: "Detail", isHeader: true },
          ["Format", "Private session link"],
          ["Duration", "~15 minutes, timed"],
          ["Mode", "Fully self-service and parallelizable"],
          [
            "Core activity",
            "Think-out-loud problem solving via interactive dialog",
          ],
          ["Who is present", "Candidate only (product-led evaluation)"],
          [
            "Integration",
            "Standalone links or API for full automation (ATS / recruiting stack)",
          ],
        ]),

        h2("Inputs required"),
        threeColTable(
          ["Input", "Required?", "Notes"],
          [
            [
              "Job description",
              "Required",
              "Role definition used to scope the exercise and score fit for this position.",
            ],
            [
              "Company culture / general hiring brief",
              "Optional",
              "Values, bar for the team, what “good” looks like beyond the JD — improves ranking and strength/weakness framing.",
            ],
          ],
        ),
        new Paragraph({ spacing: { before: 140 }, children: [] }),
        body(
          "Nothing else is required to stand up a first screening for a role. From those inputs we configure the timed dialog and the scoring bar.",
        ),

        h2("Integration (API)"),
        body(
          "This product can also be integrated via API for full automation:",
        ),
        bullet(
          "Issue and track session links from your ATS or recruiting tools",
          "bullets2",
        ),
        bullet(
          "Receive completion and report payloads without manual export",
          "bullets2",
        ),
        bullet(
          "Drive advance / reject / route-to-next-stage workflows programmatically",
          "bullets2",
        ),
        new Paragraph({ spacing: { before: 80 }, children: [] }),
        body(
          "Use hosted links for a fast pilot; use the API when screening must run hands-off at campaign scale.",
        ),

        h2("Candidate experience"),
        numbered(
          "Receive a private link (email, ATS, or recruiter message).",
        ),
        numbered("Open the exercise and start the timer."),
        numbered(
          "Work through the task while verbalizing reasoning in an interactive dialog.",
        ),
        numbered("Complete the session."),
        new Paragraph({ spacing: { before: 80 }, children: [] }),
        body(
          "Designed for hundreds of applicants in parallel when you are hiring at scale.",
        ),

        h2("What the client gets"),
        twoColTable([
          { 0: "Deliverable", 1: "Description", isHeader: true },
          [
            "Job-position report",
            "Ranking of candidates scored on how well they would perform in the role.",
          ],
          [
            "Per-candidate breakdown",
            "Strengths and weaknesses for each applicant.",
          ],
          [
            "Optional human use",
            "Reviewer can skim only edge cases or top-N; or skip deep review and trust rank for first cut.",
          ],
          [
            "Downstream input",
            "Same breakdowns feed later stages (interview guides, calibration, take-home design, offer risk).",
          ],
        ]),

        h2("When to use it"),
        bullet(
          "Top-of-funnel or first technical / skill screen when volume is high",
          "bullets3",
        ),
        bullet(
          "When senior interview time is the bottleneck",
          "bullets3",
        ),
        bullet(
          "When AI-polished application CVs look similar and you need early process signal",
          "bullets3",
        ),
        bullet(
          "Campaigns that must evaluate many people against one consistent bar",
          "bullets3",
        ),

        h2('Why it fits "hire a lot, fast"'),
        twoColTable([
          {
            0: "Without this product",
            1: "With Early Self-Service Screening",
            isHeader: true,
          },
          [
            "Screeners bottleneck volume",
            "Dozens of evaluations run async in parallel",
          ],
          [
            "Weak candidates reach expensive interviews",
            "Role-ranked shortlist before HM time",
          ],
          [
            "Every interviewer invents a bar",
            "Same exercise and markers for the whole cohort",
          ],
          [
            "No reusable artifact after screen",
            "Strengths/weaknesses pack for later stages",
          ],
          [
            "Risk of CV / personal hiring bias",
            "The system does not look at the applicants CV",
          ],
        ]),

        h2("Suggested placement in the funnel"),
        body(
          "Placement Option #1: As part of the application submission process.",
        ),
        body(
          "Placement Option #2: Right after CV Screening Stage (early stage).",
        ),

        new Paragraph({ spacing: { before: 360 }, children: [] }),
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Uncertain Systems — early skill signal at hiring scale.",
              font: "Arial",
              size: 20,
              italics: true,
              color: "374151",
            }),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buffer);
console.log("Wrote", OUT, `(${buffer.length} bytes)`);
