// -----------------------------------------------------------------------------
// PDF export for the Liquid Glass report: a real file download, no print
// dialog.
//
// Glass (translucency, soft colour washes, gradient type) has no PDF
// equivalent, so each A4 page is captured as a high-resolution picture. The
// capture (html2canvas) paints every box and word at the position it has on
// screen — it never lays the page out again — so text cannot wrap differently
// and cards cannot be squashed, whatever the browser. Gradient lettering, which
// html2canvas cannot paint, is drawn on top word by word. On top of the picture
// every word is written again as invisible PDF text at the same place, so the
// PDF can still be searched and its text selected and copied.
//
// Loaded on click only, so it costs nothing up front.
// -----------------------------------------------------------------------------

import type { jsPDF as JsPDF } from "jspdf";

const PX_TO_PT = 0.75; // 1 CSS px = 0.75 pt

function isHidden(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest(".gr-noexport");
}

// Gradient lettering: the same stops as in glassReport.css.
const GRADIENTS: Record<string, string[]> = {
  "gr-h1": ["#1d1d1f", "#3a3a8c", "#7d3fd1", "#d6336c"],
  "gr-big-pct": ["#5856d6", "#af52de"],
};

/** One word as it sits on the page, with everything needed to paint it. */
interface Run {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  color: string;
  letterSpacing: string;
  /** Gradient across the whole element: stops + its left/right edge. */
  gradient?: { stops: string[]; from: number; to: number };
}

// Every word on the page, read from the live layout.
function runsOf(page: HTMLElement): Run[] {
  const origin = page.getBoundingClientRect();
  const out: Run[] = [];
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const raw = n.textContent ?? "";
    const el = n.parentElement;
    if (!el || !raw.trim() || isHidden(n)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const upper = cs.textTransform === "uppercase";
    const gradEl = el.closest<HTMLElement>(".gr-gradtext");
    let gradient: Run["gradient"];
    if (gradEl) {
      const stops = Object.entries(GRADIENTS).find(([cls]) => gradEl.classList.contains(cls))?.[1];
      const b = gradEl.getBoundingClientRect();
      if (stops) gradient = { stops, from: b.left - origin.left, to: b.right - origin.left };
    }
    for (const m of raw.matchAll(/\S+/g)) {
      range.setStart(n, m.index!);
      range.setEnd(n, m.index! + m[0].length);
      const r = range.getClientRects()[0];
      if (!r || r.width === 0) continue;
      out.push({
        text: upper ? m[0].toUpperCase() : m[0],
        x: r.left - origin.left,
        y: r.top - origin.top,
        w: r.width,
        h: r.height,
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
        color: cs.color,
        letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
        gradient,
      });
    }
  }
  return out;
}

// Paint the words onto the captured page, each exactly where it was.
function paintRuns(canvas: HTMLCanvasElement, runs: Run[], scale: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = "alphabetic";
  for (const r of runs) {
    ctx.font = r.font;
    // letterSpacing is a newer canvas property; older browsers just skip it.
    (ctx as unknown as { letterSpacing: string }).letterSpacing = r.letterSpacing;
    if (r.gradient) {
      const g = ctx.createLinearGradient(r.gradient.from, 0, r.gradient.to, 0);
      r.gradient.stops.forEach((c, i) => g.addColorStop(i / (r.gradient!.stops.length - 1), c));
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = r.color;
    }
    const m = ctx.measureText(r.text);
    const size = parseFloat(r.font.split(" ")[2]) || r.h;
    const ascent = m.fontBoundingBoxAscent || size * 0.97;
    const descent = m.fontBoundingBoxDescent || size * 0.24;
    // The word's box is the font's content area: centre the glyphs in it.
    const baseline = r.y + (r.h - (ascent + descent)) / 2 + ascent;
    ctx.fillText(r.text, r.x, baseline);
  }
  ctx.restore();
}

function addTextLayer(pdf: JsPDF, runs: Run[]): void {
  pdf.setFont("helvetica", "normal");
  for (const w of runs) {
    // The built-in PDF font covers Latin-1 only; symbols (✓, ·) are left out.
    const text = w.text.replace(/[^\u0020-\u00FF]/g, "");
    if (!text) continue;
    const size = Math.max(4, w.h * PX_TO_PT * 0.78);
    pdf.setFontSize(size);
    // Stretch the word to the width it has on screen, so a selection lines up.
    const natural = pdf.getTextWidth(text) || 1;
    pdf.text(text, w.x * PX_TO_PT, (w.y + w.h * 0.78) * PX_TO_PT, {
      renderingMode: "invisible",
      horizontalScale: (w.w * PX_TO_PT) / natural,
    } as Parameters<JsPDF["text"]>[3]);
  }
}

const SCALE = 2.5; // 2.5× of a 96-dpi page is 240 dpi: crisp type, a few hundred kB a page

/** Capture the given A4 page elements into one PDF and download it. */
export async function downloadGlassPdf(
  root: HTMLElement,
  pages: HTMLElement[],
  fileName: string,
  onPage?: (done: number, total: number) => void
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts?.ready;

  // Editing outlines, hide buttons, backdrop blur and on-screen page shadows
  // off while capturing.
  root.classList.add("gr-exporting");
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  await frame();
  await frame();

  try {
    let pdf: JsPDF | null = null;
    for (const [i, page] of pages.entries()) {
      const landscape = page.offsetWidth > page.offsetHeight;
      const orientation = landscape ? "landscape" : "portrait";
      // Read every word first; then capture the page with text switched off
      // (html2canvas places text a few pixels off) and paint the words back.
      const runs = runsOf(page);
      root.classList.add("gr-textless");
      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(page, {
          scale: SCALE,
          backgroundColor: "#f5f5f7",
          logging: false,
          useCORS: true,
          width: page.offsetWidth,
          height: page.offsetHeight,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
          ignoreElements: (el) => el.classList.contains("gr-noexport"),
        });
      } finally {
        root.classList.remove("gr-textless");
      }
      paintRuns(canvas, runs, SCALE);
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (!pdf) pdf = new jsPDF({ unit: "pt", format: "a4", orientation, compress: true });
      else pdf.addPage("a4", orientation);
      pdf.addImage(img, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, "FAST");
      addTextLayer(pdf, runs);
      onPage?.(i + 1, pages.length);
    }
    if (!pdf) return;
    pdf.save(fileName);
  } finally {
    root.classList.remove("gr-exporting");
  }
}
