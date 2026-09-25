// -----------------------------------------------------------------------------
// PDF export for the Liquid Glass report: a real file download, no print
// dialog.
//
// Glass (translucency, blur, soft colour washes, gradient type) has no PDF
// equivalent, so each A4 page is captured as a high-resolution picture exactly
// as it looks on screen. On top of the picture every word is written again as
// invisible PDF text at the same place, so the PDF can still be searched and
// its text selected and copied.
//
// Loaded on click only, so it costs nothing up front.
// -----------------------------------------------------------------------------

import type { jsPDF as JsPDF } from "jspdf";

const PX_TO_PT = 0.75; // 1 CSS px = 0.75 pt

function isHidden(node: Node): boolean {
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest(".gr-noexport");
}

// Every word on the page, with its box relative to the page.
function wordsOf(page: HTMLElement): { text: string; x: number; y: number; w: number; h: number }[] {
  const origin = page.getBoundingClientRect();
  const out: { text: string; x: number; y: number; w: number; h: number }[] = [];
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? "";
    if (!text.trim() || isHidden(n)) continue;
    // The built-in PDF font covers Latin-1 only; symbols (✓, ·) are left out.
    for (const m of text.replace(/[^\u0020-\u00FF]/g, " ").matchAll(/\S+/g)) {
      range.setStart(n, m.index!);
      range.setEnd(n, m.index! + m[0].length);
      const r = range.getClientRects()[0];
      if (!r || r.width === 0) continue;
      out.push({ text: m[0], x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
    }
  }
  return out;
}

function addTextLayer(pdf: JsPDF, page: HTMLElement): void {
  pdf.setFont("helvetica", "normal");
  for (const w of wordsOf(page)) {
    const size = Math.max(4, w.h * PX_TO_PT * 0.78);
    pdf.setFontSize(size);
    // Stretch the word to the width it has on screen, so a selection lines up.
    const natural = pdf.getTextWidth(w.text) || 1;
    pdf.text(w.text, w.x * PX_TO_PT, (w.y + w.h * 0.78) * PX_TO_PT, {
      renderingMode: "invisible",
      horizontalScale: (w.w * PX_TO_PT) / natural,
    } as Parameters<JsPDF["text"]>[3]);
  }
}

/** Capture the given A4 page elements into one PDF and download it. */
export async function downloadGlassPdf(
  root: HTMLElement,
  pages: HTMLElement[],
  fileName: string,
  onPage?: (done: number, total: number) => void
): Promise<void> {
  const [{ domToJpeg }, { jsPDF }] = await Promise.all([import("modern-screenshot"), import("jspdf")]);
  await document.fonts?.ready;

  // Editing outlines, hide buttons and on-screen page shadows off while capturing.
  root.classList.add("gr-exporting");
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));

  try {
    let pdf: JsPDF | null = null;
    for (const [i, page] of pages.entries()) {
      const landscape = page.offsetWidth > page.offsetHeight;
      const orientation = landscape ? "landscape" : "portrait";
      // 2.5× of a 96-dpi page is 240 dpi: crisp type at a few hundred kB a page.
      const img = await domToJpeg(page, {
        width: page.offsetWidth,
        height: page.offsetHeight,
        scale: 2.5,
        quality: 0.92,
        backgroundColor: "#f5f5f7",
        filter: (node) => !(node instanceof Element && node.classList.contains("gr-noexport")),
      });
      if (!pdf) pdf = new jsPDF({ unit: "pt", format: "a4", orientation, compress: true });
      else pdf.addPage("a4", orientation);
      pdf.addImage(img, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, "FAST");
      addTextLayer(pdf, page);
      onPage?.(i + 1, pages.length);
    }
    if (!pdf) return;
    pdf.save(fileName);
  } finally {
    root.classList.remove("gr-exporting");
  }
}
