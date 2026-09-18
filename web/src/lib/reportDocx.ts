import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { Project, Subtask, Task } from "./types";
import { STATUS_LABEL } from "./constants";
import type { PlannerColumn, ReportData, ReportTask } from "./reportData";

// -----------------------------------------------------------------------------
// Weekly report → .docx
//
// The document is built ON TOP of the real Intesa Sanpaolo template shipped at
// public/report-template.docx: we unzip it, replace only the body of
// word/document.xml, and zip it back. Everything else is carried over
// untouched, which is what keeps the output identical to a hand-written report:
//
//   • styles.xml  → Garamond 11pt body text (the "same font" requirement)
//   • header1.xml → the letterhead: logo + BENCHMARKING & COMMERCIAL PLANNING
//   • footer1.xml → "PAGE {PAGE} OF {NUMPAGES}" — real Word fields, so the page
//                   numbers are automatic and renumber themselves
//
// The body reproduces the template's own layout, section for section:
//
//   page 1   Weekly Report / dd/mm/yyyy – dd/mm/yyyy
//            Done             → tasks completed in the period
//            Next             → the current NEXT column
//            Current Projects → the Projects tab, with each checklist
//   page 2   Planner / dd/mm/yyyy – dd/mm/yyyy   (landscape)
//            Backlog · Next · In Progress · Waiting, side by side
//
// House rules for the content: no owner names anywhere, no images, no tick
// marks — plain en-dash lists, restrained rules and greys only.
//
// Nothing spills across a page break: every row carries <w:cantSplit/>, an
// activity's subtask row is <w:keepNext>-anchored to its title row, and tables
// are fixed-layout so the structure is identical on every page.
// -----------------------------------------------------------------------------

const TEMPLATE_URL = `${import.meta.env.BASE_URL}report-template.docx`;

// Colours and metrics lifted from the template itself.
const GREEN = "00693E";
const ORANGE = "EE7203";
const GRAY = "6B6B6B";
const RULE = "D9D9D9";
const HEAD_FILL = "F2F2F2";
const SUB_FILL = "FAF9F6";

// Usable text width: A4 portrait / landscape minus the template's 1440 margins.
const CONTENT_W = 9026;
const CONTENT_W_LAND = 13958;

// Activity tables: activity | priority | date. No owner column — by design.
const COLS = [6350, 1100, 1576];

const esc = (s: string): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface RunOpts {
  b?: boolean;
  i?: boolean;
  color?: string;
  sz?: number; // half-points
  caps?: boolean;
  spacing?: number;
}

// A run. Newlines become real line breaks so multi-line text stays inside the
// cell instead of creating new paragraphs.
function run(text: string, o: RunOpts = {}): string {
  const rPr =
    "<w:rPr>" +
    (o.b ? "<w:b/><w:bCs/>" : "") +
    (o.i ? "<w:i/><w:iCs/>" : "") +
    (o.caps ? "<w:caps/>" : "") +
    (o.color ? `<w:color w:val="${o.color}"/>` : "") +
    (o.spacing ? `<w:spacing w:val="${o.spacing}"/>` : "") +
    (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : "") +
    "</w:rPr>";
  const body = String(text ?? "")
    .split("\n")
    .map((line) => `<w:t xml:space="preserve">${esc(line)}</w:t>`)
    .join("<w:br/>");
  return `<w:r>${rPr}${body}</w:r>`;
}

interface ParaOpts {
  style?: string;
  keepNext?: boolean;
  before?: number;
  after?: number;
  bottomBorder?: { color: string; sz: number; space: number };
  jc?: "left" | "center" | "right";
  ind?: number;
  sectPr?: string;
}

function para(runs: string, o: ParaOpts = {}): string {
  const pPr =
    "<w:pPr>" +
    (o.style ? `<w:pStyle w:val="${o.style}"/>` : "") +
    (o.keepNext ? "<w:keepNext/><w:keepLines/>" : "") +
    (o.bottomBorder
      ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.bottomBorder.sz}" w:space="${o.bottomBorder.space}" w:color="${o.bottomBorder.color}"/></w:pBdr>`
      : "") +
    (o.before != null || o.after != null
      ? `<w:spacing${o.before != null ? ` w:before="${o.before}"` : ""}${
          o.after != null ? ` w:after="${o.after}"` : ""
        }/>`
      : "") +
    (o.ind ? `<w:ind w:left="${o.ind}"/>` : "") +
    (o.jc ? `<w:jc w:val="${o.jc}"/>` : "") +
    (o.sectPr ?? "") +
    "</w:pPr>";
  return `<w:p>${pPr}${runs}</w:p>`;
}

interface CellOpts {
  w: number;
  span?: number;
  fill?: string;
  vAlign?: "center" | "top";
  noBorders?: boolean;
}

function cell(content: string, o: CellOpts): string {
  const tcPr =
    "<w:tcPr>" +
    `<w:tcW w:w="${o.w}" w:type="dxa"/>` +
    (o.span ? `<w:gridSpan w:val="${o.span}"/>` : "") +
    (o.noBorders
      ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
      : "") +
    (o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "") +
    (o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : "") +
    "</w:tcPr>";
  return `<w:tc>${tcPr}${content}</w:tc>`;
}

// cantSplit is what stops a row being torn across a page break. The planner's
// single body row opts out: it is a board snapshot, not an atomic activity, and
// a tall unsplittable row would be bumped to a page of its own.
function row(
  cells: string,
  opts: { header?: boolean; height?: number; split?: boolean } = {}
): string {
  const trPr =
    "<w:trPr>" +
    (opts.split ? "" : "<w:cantSplit/>") +
    (opts.height ? `<w:trHeight w:val="${opts.height}" w:hRule="atLeast"/>` : "") +
    (opts.header ? "<w:tblHeader/>" : "") +
    "</w:trPr>";
  return `<w:tr>${trPr}${cells}</w:tr>`;
}

function table(grid: number[], rows: string, opts: { borders?: boolean; ind?: number } = {}): string {
  const borders = opts.borders
    ? `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
        .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="${RULE}"/>`)
        .join("")}</w:tblBorders>`
    : "";
  const total = grid.reduce((a, b) => a + b, 0);
  return (
    "<w:tbl><w:tblPr>" +
    `<w:tblW w:w="${total}" w:type="dxa"/>` +
    (opts.ind ? `<w:tblInd w:w="${opts.ind}" w:type="dxa"/>` : "") +
    borders +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>' +
    "</w:tblPr>" +
    `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    rows +
    "</w:tbl>"
  );
}

// ---- Template wording -------------------------------------------------------
// The template is written in English, so the document is too, whatever the UI
// language happens to be — it is a corporate deliverable, not a UI surface.

const L = {
  weeklyReport: "Weekly Report",
  done: "Done",
  next: "Next",
  currentProjects: "Current Projects",
  planner: "Planner",
  colActivity: "Activity",
  colPriority: "Priority",
  colCompleted: "Completed",
  colDue: "Due",
  colProject: "Project",
  colProgress: "Progress",
  noneDone: "No activity was completed in this period.",
  noneNext: "No activity is currently scheduled as Next.",
  noneProjects: "No project is currently open.",
  noneTasks: "—",
};

// dd/mm/yyyy, as the template's own placeholder spells it.
function ddmmyyyy(value: string | number): string {
  const d =
    typeof value === "number"
      ? new Date(value)
      : (() => {
          const [y, m, dd] = value.split("-").map(Number);
          return new Date(y, m - 1, dd);
        })();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function periodLabel(from: string, to: string): string {
  return `${ddmmyyyy(from)} – ${ddmmyyyy(to)}`;
}

// ---- Building blocks --------------------------------------------------------

// Page title + the period rule beneath it, matching the template exactly.
function pageTitle(title: string, period: string, keepNext = false): string {
  return (
    para(run(title, { b: true, sz: 52 }), { before: 200, after: 120, keepNext }) +
    para(run(period, { i: true, color: GRAY, sz: 20 }), {
      after: 280,
      keepNext,
      bottomBorder: { color: ORANGE, sz: 8, space: 10 },
    })
  );
}

function sectionHeading(text: string): string {
  return para(run(text, { b: true, color: GREEN, sz: 28 }), {
    style: "Titolo1",
    keepNext: true,
    before: 200,
    after: 160,
    bottomBorder: { color: GREEN, sz: 4, space: 4 },
  });
}

// Sub-items (subtasks, project checklist items) laid out inside a full-width
// row. Short entries go two to a line so half the page is not left empty; long
// ones get the full width. Plain en-dash lead — no tick marks.
function itemBlock(items: Subtask[], width: number): string {
  if (items.length === 0) return "";
  const longest = items.reduce((n, s) => Math.max(n, (s.text ?? "").length), 0);
  const cols = items.length > 1 && longest <= 46 ? 2 : 1;
  const colW = Math.floor((width - 300) / cols);

  const line = (s: Subtask) =>
    para(run("–  ", { sz: 17, color: GRAY }) + run(s.text || L.noneTasks, { sz: 17 }), {
      before: 10,
      after: 10,
    });

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += cols) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const item = items[i + c];
      cells.push(cell(item ? line(item) : para(""), { w: colW, noBorders: true, vAlign: "top" }));
    }
    rows.push(row(cells.join("")));
  }
  return table(new Array(cols).fill(colW), rows.join(""), { ind: 150 });
}

// One activity = a title row plus, when it has sub-items, a full-width detail
// row. Both are cantSplit and the title keeps with the next, so an activity and
// its subtasks never land on two different pages.
function activityRows(task: Task, dateMs: number | null, dueIso: string | undefined, subtasks: Subtask[]): string {
  const dateText = dateMs != null ? ddmmyyyy(dateMs) : dueIso ? ddmmyyyy(dueIso) : "—";
  const head = row(
    cell(
      para(run(task.title || L.noneTasks, { b: true, sz: 20 }), {
        keepNext: true,
        before: 20,
        after: 0,
      }) +
        (task.desc?.trim()
          ? para(run(task.desc.trim(), { i: true, sz: 17, color: GRAY }), {
              keepNext: true,
              before: 20,
              after: 20,
            })
          : ""),
      { w: COLS[0], vAlign: "top" }
    ) +
      cell(para(run(task.priority, { sz: 18 }), { jc: "center" }), {
        w: COLS[1],
        vAlign: "center",
      }) +
      cell(para(run(dateText, { sz: 18, color: dateText === "—" ? GRAY : undefined }), { jc: "center" }), {
        w: COLS[2],
        vAlign: "center",
      })
  );
  if (subtasks.length === 0) return head;
  return (
    head +
    row(
      cell(itemBlock(subtasks, CONTENT_W) + para("", { before: 0, after: 0 }), {
        w: CONTENT_W,
        span: 3,
        fill: SUB_FILL,
        vAlign: "top",
      })
    )
  );
}

function headerCell(text: string, w: number, jc?: "center"): string {
  return cell(para(run(text, { b: true, sz: 15, color: GRAY, caps: true, spacing: 10 }), { jc }), {
    w,
    fill: HEAD_FILL,
    vAlign: "center",
  });
}

function activityTable(items: ReportTask[], dateHeading: string, empty: string): string {
  if (items.length === 0) return para(run(empty, { i: true, color: GRAY }), { after: 260 });
  const header = row(
    headerCell(L.colActivity, COLS[0]) +
      headerCell(L.colPriority, COLS[1], "center") +
      headerCell(dateHeading, COLS[2], "center"),
    { header: true }
  );
  const body = items
    .map((r) => activityRows(r.task, r.completedAt, r.task.dueDate, r.subtasks))
    .join("");
  return table(COLS, header + body, { borders: true }) + para("", { after: 260 });
}

function projectsTable(projects: Project[]): string {
  if (projects.length === 0)
    return para(run(L.noneProjects, { i: true, color: GRAY }), { after: 260 });
  const w = [CONTENT_W - 1600, 1600];
  const header = row(headerCell(L.colProject, w[0]) + headerCell(L.colProgress, w[1], "center"), {
    header: true,
  });
  const body = projects
    .map((p) => {
      const items = p.items ?? [];
      const done = items.filter((i) => i.done).length;
      const head = row(
        cell(
          para(run(p.name || L.noneTasks, { b: true, sz: 20 }), {
            keepNext: true,
            before: 20,
            after: 20,
          }),
          { w: w[0], vAlign: "top" }
        ) +
          cell(
            para(run(items.length ? `${done} / ${items.length}` : "—", { sz: 18 }), {
              jc: "center",
            }),
            { w: w[1], vAlign: "center" }
          )
      );
      if (items.length === 0) return head;
      return (
        head +
        row(
          cell(itemBlock(items, CONTENT_W) + para("", { before: 0, after: 0 }), {
            w: CONTENT_W,
            span: 2,
            fill: SUB_FILL,
            vAlign: "top",
          })
        )
      );
    })
    .join("");
  return table(w, header + body, { borders: true }) + para("", { after: 260 });
}

// The planner board: the four kanban columns side by side, filling the
// landscape page. Rendered as a real Word table — no screenshot, no image.
function plannerTable(columns: PlannerColumn[]): string {
  const colW = Math.floor(CONTENT_W_LAND / columns.length);
  const grid = new Array(columns.length).fill(colW);

  const header = row(
    columns
      .map((c) =>
        cell(
          para(
            run(STATUS_LABEL[c.status], { b: true, sz: 18, color: GREEN, caps: true, spacing: 12 }),
            { jc: "center", before: 40, after: 40 }
          ),
          { w: colW, fill: HEAD_FILL, vAlign: "center" }
        )
      )
      .join(""),
    { header: true }
  );

  // One body row holding every column's cards, so the columns sit beside each
  // other and stretch down the page. atLeast height makes it fill the sheet.
  const bodyCells = columns
    .map((c) => {
      const content =
        c.tasks.length === 0
          ? para(run(L.noneTasks, { sz: 17, color: GRAY }), { jc: "center", before: 60 })
          : c.tasks
              .map((t) =>
                para(
                  run(t.priority + "   ", { sz: 15, color: GRAY }) + run(t.title, { sz: 17 }),
                  { before: 40, after: 40, keepNext: false }
                )
              )
              .join("");
      return cell(content, { w: colW, vAlign: "top" });
    })
    .join("");

  // Landscape A4 leaves ~8880 twips of text height; the title block and the
  // header row take roughly 1900 of it, so this fills the rest of the sheet
  // without bumping the table onto a page of its own.
  return table(grid, header + row(bodyCells, { height: 6300, split: true }), { borders: true });
}

// ---- The body ---------------------------------------------------------------

// A copy of the template's own section properties, optionally turned landscape.
function sectPr(template: string, landscape: boolean): string {
  if (!landscape) return template;
  return template
    .replace(
      /<w:pgSz[^/]*\/>/,
      '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
    )
    .replace(/<w:sectPr[^>]*>/, (m) => m); // keep the header/footer references
}

function buildBody(data: ReportData, templateSectPr: string): string {
  const period = periodLabel(data.period.from, data.period.to);
  const out: string[] = [];

  // ---- Page 1
  out.push(pageTitle(L.weeklyReport, period));

  out.push(sectionHeading(L.done));
  out.push(activityTable(data.done, L.colCompleted, L.noneDone));

  out.push(sectionHeading(L.next));
  out.push(activityTable(data.next, L.colDue, L.noneNext));

  out.push(sectionHeading(L.currentProjects));
  out.push(projectsTable(data.projects));

  // Section break: page 1 keeps the template's portrait setup, the planner
  // page turns landscape so four columns actually fill the sheet.
  const portrait = sectPr(templateSectPr, false).replace(
    "<w:pgSz",
    '<w:type w:val="nextPage"/><w:pgSz'
  );
  out.push(para("", { sectPr: portrait }));

  // ---- Page 2 (landscape)
  out.push(pageTitle(L.planner, period, true));
  out.push(plannerTable(data.planner));

  return out.join("");
}

// ---- Packaging --------------------------------------------------------------

export function reportFileName(data: ReportData): string {
  return `Weekly_Report_${data.period.from}_${data.period.to}.docx`;
}

// Fetch the template, swap the body of word/document.xml, zip it back up.
export async function buildReportDocx(data: ReportData): Promise<Blob> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`template ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const docPath = "word/document.xml";
  const original = strFromU8(zip[docPath]);

  const bodyOpen = original.indexOf("<w:body>");
  const sectStart = original.lastIndexOf("<w:sectPr");
  if (bodyOpen < 0 || sectStart < 0) throw new Error("unexpected template layout");
  const head = original.slice(0, bodyOpen + "<w:body>".length);
  const tail = original.slice(sectStart); // <w:sectPr>…</w:sectPr></w:body></w:document>

  // The template's section properties, reused for the portrait section and
  // flipped to landscape for the final (planner) one.
  const templateSectPr = tail.slice(0, tail.indexOf("</w:sectPr>") + "</w:sectPr>".length);
  const closing = tail.slice(templateSectPr.length);

  zip[docPath] = strToU8(
    head + buildBody(data, templateSectPr) + sectPr(templateSectPr, true) + closing
  );

  const out = zipSync(zip, { level: 6 });
  // Copy into a fresh buffer: the zip may be a view onto a larger allocation.
  return new Blob([out.slice().buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadReportDocx(data: ReportData): Promise<void> {
  const blob = await buildReportDocx(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFileName(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
