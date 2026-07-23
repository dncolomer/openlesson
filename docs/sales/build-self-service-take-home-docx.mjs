/**
 * Build docs/sales/self-service-take-home-assignment.docx for Google Drive upload.
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
const OUT = path.join(__dirname, "self-service-take-home-assignment.docx");
const CONTENT_W = 10224; // letter with 0.7" margins

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

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text, font: "Arial", size: 24, bold: true, color: "222222" }),
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
    rows: rows.map((row, i) => {
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
              cell(c, widths[i], { bold: i === 0, fill: i === 0 ? labelFill : undefined }),
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
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "222222" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
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
                bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 },
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
                top: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 4 },
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
        h1("Self-service Take-Home Assignment"),

        h2("In One line"),
        body(
          "Candidates complete an open-ended, multi-block assignment inside the tool (discussion, diagrams, notes, and more); the client gets a role ranking and per-applicant strengths/weaknesses without the classic take-home cost curve.",
        ),

        h2("What it is"),
        body(
          "A self-service take-home where candidates work through multiple blocks in the browser.",
        ),
        bullet("Interactive discussion"),
        bullet("Diagrams"),
        bullet("Written notes"),
        bullet("Other real work artifacts produced in-session"),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        body(
          "Built for depth (assignment / project-style judgment) while remaining structured and scoreable across a full hiring cohort.",
        ),
        twoColTable([
          { 0: "Attribute", 1: "Detail", isHeader: true },
          ["Format", "Private assignment journey (multi-block)"],
          ["Scope", "Open-ended work sample across several blocks"],
          ["Mode", "Candidate-led, async-friendly"],
          [
            "Core activity",
            "Real work in-tool: dialog, diagrams, notes, multi-step reasoning",
          ],
          [
            "Who reviews",
            "Product produces rankings and reports; humans review selectively",
          ],
        ]),

        h2("Inputs"),
        threeColTable(
          ["Input", "Required?", "Notes"],
          [
            [
              "Signals from Early Self-Service Screening",
              "Optional",
              "Rankings and strength/weakness packs from the first product used to personalize depth, route candidates, or calibrate the take-home bar.",
            ],
            [
              "Take-home exercise description",
              "Recommended, but optional",
              "Your brief for the multi-block assignment. If you do not have one, we can design the exercise ourselves from the role (and optional screening signals).",
            ],
          ],
        ),
        new Paragraph({ spacing: { before: 140 }, children: [] }),
        body(
          "You can start with only a job/role context and let us author the blocks, or bring an existing take-home and we turn it into a structured multi-block interactive experience.",
        ),

        h2("Candidate experience"),
        numbered("Receive access to the assignment (link / invitation)."),
        numbered("Progress through multiple blocks that mirror real role work."),
        numbered("Interact with the environment: discuss, sketch, note, iterate."),
        numbered(
          "Complete the journey with full process visibility not only a final deliverable.",
        ),
        new Paragraph({ spacing: { before: 80 }, children: [] }),
        body(
          "Unlike a classic take-home, the system captures how the candidate works, not only what they produce at the end.",
        ),

        h2("What the client gets"),
        body("Same reporting model as Early Self-Service Screening:"),
        twoColTable([
          { 0: "Deliverable", 1: "Description", isHeader: true },
          [
            "Job-position report",
            "Ranking of candidates on expected role performance.",
          ],
          [
            "Per-applicant report",
            "Strengths and weaknesses for human review and process design.",
          ],
          [
            "Comparable cohort",
            "Same blocks and markers for every candidate on that role.",
          ],
        ]),

        h2("Two ways this product creates value"),
        h3("A. Take-homes where they were not viable before"),
        body(
          "For high-volume roles, classic take-homes fail economics: too many submissions, too much senior review time, slow cycle time.",
        ),
        body(
          "Self-Service Take-Home makes a real work sample economically viable because evaluation is structured and report-driven. You can run take-homes on roles that previously skipped them.",
        ),
        h3("B. Lower cost on high-profile offers"),
        body(
          "For senior / premium roles, take-homes still burn expensive reviewer hours and calendar lag.",
        ),
        body(
          "Use this product to reduce cost and resources to run and evaluate take-homes without lowering the bar. Same ranking + per-person report, less ad-hoc grading.",
        ),

        h2("When to use it"),
        bullet(
          "After a light screen or Early Self-Service Screening, as a work sample",
          "bullets2",
        ),
        bullet(
          "For roles that should have a take-home but review cost blocked it",
          "bullets2",
        ),
        bullet(
          "For high-profile pipelines where take-home quality matters and reviewer load is painful",
          "bullets2",
        ),
        bullet(
          "Anytime you need depth + consistency across many applicants for the same job position",
          "bullets2",
        ),

        h2('Why it fits "hire a lot, fast"'),
        twoColTable([
          {
            0: "Without this product",
            1: "With Self-service Take-Home",
            isHeader: true,
          },
          [
            "Take-homes only for a few premium roles",
            "Viable work samples at higher volume",
          ],
          [
            "Multi-day lag and uneven grading",
            "Structured multi-block journey + role ranking",
          ],
          [
            "AI-polished PDFs with no process",
            "In-tool work + interactive signal",
          ],
          [
            "Senior engineers grade every packet",
            "Reports first; humans on exceptions and finals",
          ],
        ]),

        new Paragraph({ spacing: { before: 360 }, children: [] }),
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Uncertain Systems — work samples that scale without scaling review chaos.",
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
