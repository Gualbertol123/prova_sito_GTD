// -----------------------------------------------------------------------------
// PDF export for the report editor: a real file download, no print dialog.
//
// SuperDoc only exports DOCX, but it already draws every page as an exact A4
// box with the letterhead and footer painted in. So each rendered page is
// captured as an image (modern-screenshot, which lets the browser itself do the
// painting through an SVG foreignObject, so fonts and table borders come out
// exactly as on screen) and placed full-bleed on its own PDF page (jsPDF).
//
// Each PDF page takes the orientation of the page it came from, so the planner
// is a true landscape sheet here, which the old print route could not manage.
//
// Trade-off: the text in the PDF is an image, so it cannot be selected or
// searched. When that matters, download the Word file and use Word's own
// "Save as PDF".
//
// Both libraries are loaded on click only, so they cost nothing up front.
// -----------------------------------------------------------------------------

// Render at this multiple of CSS pixels. 2× of a 96-dpi A4 page is ~190 dpi,
// which keeps 11pt Garamond crisp at a couple of hundred kB per page.
const SCALE = 2;
const JPEG_QUALITY = 0.92;

// 1 CSS px = 0.75 pt.
const PX_TO_PT = 0.75;

// Editor chrome that can sit inside a page box but is not document content.
const CHROME_SELECTOR = [
  ".superdoc__selection-layer",
  "[class*='selection-overlay']",
  "[class*='caret']",
  "[class*='cursor']",
].join(",");

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// SuperDoc paints page content lazily, only for pages near the viewport: a
// page further down is an empty box until it has been scrolled to. So each
// page is brought into view and given time to paint before it is captured.
async function paintPage(page: HTMLElement): Promise<void> {
  page.scrollIntoView({ block: "center" });
  const deadline = Date.now() + 5000;
  while (!page.querySelector(".superdoc-fragment") && Date.now() < deadline) {
    await nextFrame();
  }
  // One more frame pair so late layout (images, fonts) settles.
  await nextFrame();
  await nextFrame();
}

// Every scrollable ancestor's position, so the view can be put back afterwards.
function saveScroll(el: HTMLElement): () => void {
  const saved: Array<[Element, number, number]> = [];
  for (let n: Element | null = el; n; n = n.parentElement) {
    saved.push([n, n.scrollTop, n.scrollLeft]);
  }
  const winX = window.scrollX;
  const winY = window.scrollY;
  return () => {
    saved.forEach(([n, top, left]) => {
      n.scrollTop = top;
      n.scrollLeft = left;
    });
    window.scrollTo(winX, winY);
  };
}

/**
 * Capture every `.superdoc-page` inside `root` and download them as one PDF.
 * `onProgress(done, total)` fires after each page, for a counter on the button.
 * Throws if the editor has not rendered any page yet.
 */
export async function downloadPagesAsPdf(
  root: HTMLElement,
  filename: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const [{ domToJpeg }, { jsPDF }] = await Promise.all([
    import("modern-screenshot"),
    import("jspdf"),
  ]);

  // Drop the caret and selection highlight so they are not photographed.
  (document.activeElement as HTMLElement | null)?.blur?.();
  window.getSelection()?.removeAllRanges();
  try {
    await document.fonts.ready;
  } catch {
    /* no Font Loading API — nothing to wait for */
  }

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".superdoc-page"));
  if (pages.length === 0) throw new Error("No rendered pages to export");

  let pdf: InstanceType<typeof jsPDF> | null = null;
  const restoreScroll = saveScroll(pages[0]);

  try {
    onProgress?.(0, pages.length);
    for (const [i, page] of pages.entries()) {
      await paintPage(page);
      // offsetWidth/Height are the unzoomed layout size, whatever the editor zoom.
      const wPx = page.offsetWidth;
      const hPx = page.offsetHeight;
      const wPt = wPx * PX_TO_PT;
      const hPt = hPx * PX_TO_PT;
      const orientation = wPx > hPx ? "landscape" : "portrait";

      const img = await domToJpeg(page, {
        width: wPx,
        height: hPx,
        scale: SCALE,
        quality: JPEG_QUALITY,
        backgroundColor: "#ffffff",
        filter: (node) => !(node instanceof Element && node.matches(CHROME_SELECTOR)),
        // The page's own inline offsets would shift it inside the capture.
        style: { margin: "0", boxShadow: "none", transform: "none" },
      });

      if (!pdf) {
        pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation, compress: true });
      } else {
        pdf.addPage([wPt, hPt], orientation);
      }
      pdf.addImage(img, "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
      onProgress?.(i + 1, pages.length);
    }
  } finally {
    restoreScroll();
  }

  pdf!.save(filename);
}
