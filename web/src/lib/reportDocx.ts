import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { Lang } from "./i18n";
import type { Subtask, Task } from "./types";
import type { ReportData } from "./reportData";

// -----------------------------------------------------------------------------
// Weekly report → .docx
//
// The document is built ON TOP of the real Intesa Sanpaolo template shipped at
// public/report-template.docx: we unzip it, replace only the body of
// word/document.xml, and zip it back. Everything else is carried over
// untouched, which is what keeps the output identical to a hand-written report:
//
//   • styles.xml       → Garamond 11pt body text (the "same font" requirement)
//   • header1.xml      → the logo, the division line, Trajan Pro headings
//   • footer1.xml      → "PAGINA {PAGE} DI {NUMPAGES}" — the page numbers are
//                        real Word fields, so they renumber themselves
//   • the <w:sectPr>   → page size, margins and the header/footer references
//
// Layout rules that follow from "no data spilling between pages":
//   • every table row carries <w:cantSplit/>, so a row moves to the next page
//     whole rather than being cut in half
//   • each activity's detail row is <w:keepNext>-anchored to its title row
//   • tables use a FIXED layout with explicit column widths, so the structure
//     is identical on every page and for every data set
//   • the column header row repeats at the top of each page (<w:tblHeader/>)
// -----------------------------------------------------------------------------

const TEMPLATE_URL = `${import.meta.env.BASE_URL}report-template.docx`;

// Colours lifted from the template itself.
const GREEN = "00693E";
const ORANGE = "EE7203";
const GRAY = "6B6B6B";
const RULE = "D9D9D9";
const HEAD_FILL = "F2F2F2";
const SUB_FILL = "FAF9F6";

// Usable text width with the template's A4 page and 1440-twip side margins.
const CONTENT_W = 9026;
const COLS = [4250, 1700, 1250, 1826]; // activity | owner | priority | completed on

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

// A run. Newlines become real line breaks so multi-line notes stay inside the
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

// cantSplit is what stops a row being torn across a page break.
function row(cells: string, opts: { header?: boolean } = {}): string {
  const trPr = `<w:trPr><w:cantSplit/>${opts.header ? "<w:tblHeader/>" : ""}</w:trPr>`;
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

// ---- Wording ----------------------------------------------------------------

const LABELS = {
  it: {
    title: "Report Settimanale di Attività",
    subtitle: "Attività e sotto-attività completate nel periodo",
    periodo: "PERIODO",
    team: "TEAM",
    generato: "GENERATO IL",
    classificazione: "CLASSIFICAZIONE",
    classValue: "Uso interno",
    sintesi: "Sintesi",
    statTasks: "Attività completate",
    statSubtasks: "Sotto-attività completate",
    statOwners: "Referenti coinvolti",
    perReferente: "Ripartizione per referente",
    referente: "Referente",
    attivita: "Attività",
    sottoAttivita: "Sotto-attività",
    completate: "Attività completate",
    avanzamenti: "Avanzamenti su attività ancora in corso",
    avanzamentiHint:
      "Sotto-attività completate nel periodo su attività non ancora chiuse.",
    colAttivita: "Attività",
    colReferente: "Referente",
    colPriorita: "Priorità",
    colCompletata: "Completata il",
    colStato: "Stato",
    nessuna: "Nessuna attività completata nel periodo selezionato.",
    nessunAvanzamento: "Nessun avanzamento parziale registrato nel periodo.",
    nonAssegnato: "Non assegnato",
    file: "Report_Settimanale",
  },
  en: {
    title: "Weekly Activity Report",
    subtitle: "Tasks and subtasks completed in the period",
    periodo: "PERIOD",
    team: "TEAM",
    generato: "GENERATED ON",
    classificazione: "CLASSIFICATION",
    classValue: "Internal use",
    sintesi: "Summary",
    statTasks: "Tasks completed",
    statSubtasks: "Subtasks completed",
    statOwners: "People involved",
    perReferente: "Breakdown by owner",
    referente: "Owner",
    attivita: "Tasks",
    sottoAttivita: "Subtasks",
    completate: "Completed tasks",
    avanzamenti: "Progress on tasks still open",
    avanzamentiHint: "Subtasks completed in the period on tasks not yet closed.",
    colAttivita: "Task",
    colReferente: "Owner",
    colPriorita: "Priority",
    colCompletata: "Completed on",
    colStato: "Status",
    nessuna: "No task was completed in the selected period.",
    nessunAvanzamento: "No partial progress recorded in the period.",
    nonAssegnato: "Unassigned",
    file: "Weekly_Report",
  },
} as const;

const locale = (lang: Lang) => (lang === "it" ? "it-IT" : "en-GB");

function longDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleDateString(locale(lang), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function periodLabel(from: string, to: string, lang: Lang): string {
  return `${longDate(from, lang)} – ${longDate(to, lang)}`;
}

// ---- Document sections ------------------------------------------------------

function sectionHeading(text: string, L: (typeof LABELS)["it"] | (typeof LABELS)["en"]): string {
  void L;
  return para(run(text, { b: true, color: GREEN, sz: 28 }), {
    style: "Titolo1",
    keepNext: true,
    before: 360,
    after: 160,
    bottomBorder: { color: GREEN, sz: 4, space: 4 },
  });
}

// Subtasks laid out inside the activity's full-width detail row. Short items go
// into two columns so half the page is not left empty; long ones get the full
// width rather than being squeezed into a narrow column.
function subtaskBlock(items: Subtask[], showState: boolean): string {
  if (items.length === 0) return "";
  const longest = items.reduce((n, s) => Math.max(n, (s.text ?? "").length), 0);
  const cols = items.length > 1 && longest <= 46 ? 2 : 1;
  const colW = Math.floor((CONTENT_W - 300) / cols);

  const lineFor = (s: Subtask): string => {
    const mark = !showState || s.done ? "✓  " : "▫  ";
    return para(
      run(mark, { sz: 16, color: s.done || !showState ? GREEN : GRAY, b: true }) +
        run(s.text || "—", { sz: 16 }),
      { before: 10, after: 10 }
    );
  };

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += cols) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const item = items[i + c];
      cells.push(
        cell(item ? lineFor(item) : para(""), { w: colW, noBorders: true, vAlign: "top" })
      );
    }
    rows.push(row(cells.join("")));
  }
  return table(new Array(cols).fill(colW), rows.join(""), { ind: 150 });
}

// One activity = a title row plus (when it has subtasks) a full-width detail
// row. Both rows are cantSplit and the title row keeps with the next, so an
// activity and its subtasks never land on two different pages.
function activityRows(
  task: Task,
  completedAt: number | null,
  subtasks: Subtask[],
  lang: Lang,
  L: (typeof LABELS)["it"] | (typeof LABELS)["en"],
  showState: boolean
): string {
  const owner = task.owner && task.owner !== "Unassigned" ? task.owner : L.nonAssegnato;
  const titleCell = cell(
    para(run(task.title || "—", { b: true, sz: 20 }), { keepNext: true, before: 20, after: 0 }) +
      (task.desc?.trim()
        ? para(run(task.desc.trim(), { i: true, sz: 16, color: GRAY }), {
            keepNext: true,
            before: 20,
            after: 20,
          })
        : ""),
    { w: COLS[0], vAlign: "top" }
  );
  const head = row(
    titleCell +
      cell(para(run(owner, { sz: 18 })), { w: COLS[1], vAlign: "center" }) +
      cell(para(run(task.priority, { sz: 18, b: true }), { jc: "center" }), {
        w: COLS[2],
        vAlign: "center",
      }) +
      cell(
        para(
          run(completedAt ? shortDate(completedAt, lang) : task.status, {
            sz: 18,
            color: completedAt ? undefined : GRAY,
          }),
          { jc: "center" }
        ),
        { w: COLS[3], vAlign: "center" }
      )
  );

  if (subtasks.length === 0) return head;
  const detail = row(
    cell(subtaskBlock(subtasks, showState) + para("", { before: 0, after: 0 }), {
      w: CONTENT_W,
      span: 4,
      fill: SUB_FILL,
      vAlign: "top",
    })
  );
  return head + detail;
}

function activityTable(
  rows: string,
  L: (typeof LABELS)["it"] | (typeof LABELS)["en"],
  lastCol: string
): string {
  const h = (text: string, w: number, jc?: "center") =>
    cell(para(run(text, { b: true, sz: 15, color: GRAY, caps: true, spacing: 10 }), { jc }), {
      w,
      fill: HEAD_FILL,
      vAlign: "center",
    });
  const header = row(
    h(L.colAttivita, COLS[0]) +
      h(L.colReferente, COLS[1]) +
      h(L.colPriorita, COLS[2], "center") +
      h(lastCol, COLS[3], "center"),
    { header: true }
  );
  return table(COLS, header + rows, { borders: true });
}

function buildBody(data: ReportData, lang: Lang): string {
  const L = LABELS[lang];
  const period = periodLabel(data.period.from, data.period.to, lang);
  const out: string[] = [];

  // Title + subtitle, mirroring the template's own opening.
  out.push(para("", { before: 400 }));
  out.push(para(run(L.title, { b: true, sz: 44 }), { before: 200, after: 120 }));
  out.push(
    para(run(`${L.subtitle} — ${period}`, { i: true, color: GRAY, sz: 24 }), {
      after: 300,
      bottomBorder: { color: ORANGE, sz: 8, space: 10 },
    })
  );

  // Metadata block — same two-column shape as the template's.
  const META_LABEL_W = 2400;
  const metaRow = (label: string, value: string) =>
    row(
      cell(para(run(label, { b: true, color: GRAY, sz: 18 })), { w: META_LABEL_W, vAlign: "center" }) +
        cell(para(run(value, { sz: 18 })), { w: CONTENT_W - META_LABEL_W, vAlign: "center" })
    );
  out.push(
    table(
      [META_LABEL_W, CONTENT_W - META_LABEL_W],
      metaRow(L.periodo, period) +
        metaRow(L.team, data.boardName) +
        metaRow(L.generato, longDate(new Date().toISOString().slice(0, 10), lang)) +
        metaRow(L.classificazione, L.classValue)
    )
  );

  // ---- Summary
  out.push(sectionHeading(L.sintesi, L));
  const statW = Math.floor(CONTENT_W / 3);
  const stat = (n: number, label: string) =>
    cell(
      para(run(String(n), { b: true, sz: 40, color: GREEN }), { jc: "center", before: 60, after: 0 }) +
        para(run(label, { sz: 15, color: GRAY, caps: true, spacing: 10 }), {
          jc: "center",
          before: 0,
          after: 60,
        }),
      { w: statW, vAlign: "center" }
    );
  out.push(
    table(
      [statW, statW, statW],
      row(
        stat(data.totalTasks, L.statTasks) +
          stat(data.totalSubtasks, L.statSubtasks) +
          stat(data.byOwner.length, L.statOwners)
      ),
      { borders: true }
    )
  );

  if (data.byOwner.length > 0) {
    out.push(
      para(run(L.perReferente, { b: true, sz: 18, color: GRAY, caps: true, spacing: 10 }), {
        keepNext: true,
        before: 240,
        after: 80,
      })
    );
    const w = [CONTENT_W - 3400, 1600, 1800];
    const hdr = row(
      cell(para(run(L.referente, { b: true, sz: 15, color: GRAY, caps: true, spacing: 10 })), {
        w: w[0],
        fill: HEAD_FILL,
      }) +
        cell(
          para(run(L.attivita, { b: true, sz: 15, color: GRAY, caps: true, spacing: 10 }), {
            jc: "center",
          }),
          { w: w[1], fill: HEAD_FILL }
        ) +
        cell(
          para(run(L.sottoAttivita, { b: true, sz: 15, color: GRAY, caps: true, spacing: 10 }), {
            jc: "center",
          }),
          { w: w[2], fill: HEAD_FILL }
        ),
      { header: true }
    );
    const body = data.byOwner
      .map((o) =>
        row(
          cell(para(run(o.owner === "Unassigned" ? L.nonAssegnato : o.owner, { sz: 18 })), {
            w: w[0],
          }) +
            cell(para(run(String(o.tasks), { sz: 18 }), { jc: "center" }), { w: w[1] }) +
            cell(para(run(String(o.subtasks), { sz: 18 }), { jc: "center" }), { w: w[2] })
        )
      )
      .join("");
    out.push(table(w, hdr + body, { borders: true }));
  }

  // ---- Completed activities
  out.push(sectionHeading(L.completate, L));
  if (data.completed.length === 0) {
    out.push(para(run(L.nessuna, { i: true, color: GRAY }), { after: 260 }));
  } else {
    const rows = data.completed
      .map((c) => activityRows(c.task, c.completedAt, c.subtasks, lang, L, true))
      .join("");
    out.push(activityTable(rows, L, L.colCompletata));
  }

  // ---- Partial progress
  out.push(sectionHeading(L.avanzamenti, L));
  out.push(
    para(run(L.avanzamentiHint, { i: true, sz: 18, color: GRAY }), { keepNext: true, after: 140 })
  );
  if (data.progress.length === 0) {
    out.push(para(run(L.nessunAvanzamento, { i: true, color: GRAY }), { after: 260 }));
  } else {
    const rows = data.progress
      .map((p) => activityRows(p.task, null, p.subtasks, lang, L, false))
      .join("");
    out.push(activityTable(rows, L, L.colStato));
  }

  return out.join("");
}

// ---- Packaging --------------------------------------------------------------

export function reportFileName(data: ReportData, lang: Lang): string {
  return `${LABELS[lang].file}_${data.period.from}_${data.period.to}.docx`;
}

// Fetch the template, swap the body of word/document.xml, zip it back up.
export async function buildReportDocx(data: ReportData, lang: Lang): Promise<Blob> {
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`template ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const docPath = "word/document.xml";
  const original = strFromU8(zip[docPath]);

  // Keep everything up to <w:body> and from <w:sectPr> on: the section
  // properties carry the page setup and the header/footer relationship ids.
  const bodyOpen = original.indexOf("<w:body>");
  const sectStart = original.lastIndexOf("<w:sectPr");
  if (bodyOpen < 0 || sectStart < 0) throw new Error("unexpected template layout");
  const head = original.slice(0, bodyOpen + "<w:body>".length);
  const tail = original.slice(sectStart);

  zip[docPath] = strToU8(head + buildBody(data, lang) + tail);

  const out = zipSync(zip, { level: 6 });
  // Copy into a fresh buffer: the zip may be a view onto a larger allocation.
  return new Blob([out.slice().buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function downloadReportDocx(data: ReportData, lang: Lang): Promise<void> {
  const blob = await buildReportDocx(data, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFileName(data, lang);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
