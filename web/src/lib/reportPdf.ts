// -----------------------------------------------------------------------------
// PDF export for the report editor: a real file download, no print dialog.
//
// SuperDoc only exports DOCX, but it lays every page out itself: each
// `.superdoc-page` is an exact A4 box of absolutely positioned lines, text runs,
// table-cell borders and fills, with the letterhead and footer drawn in. So the
// PDF is built by reading that layout back out of the DOM and redrawing it with
// jsPDF as real PDF content:
//
//   • text  → PDF text in embedded fonts (selectable, searchable, sharp at any zoom)
//   • fills and borders → vector rectangles
//   • <img> (the letterhead logo) → the image itself
//
// Each PDF page keeps the size and orientation of the page it came from, so the
// planner is a true landscape sheet.
//
// Fonts. The template's own fonts are commercial (Garamond, Trajan Pro), so the
// PDF embeds their open counterparts, self-hosted in /public/fonts: EB Garamond
// and Cinzel (both SIL OFL). The Google families in the editor's font menu are
// fetched from the fontsource CDN when a document uses them. Anything else maps
// to the PDF's built-in Helvetica / Times / Courier.
//
// Each run is placed at the exact position and width it has on screen: the
// small width difference between the screen font and the PDF font is absorbed
// by the character spacing, so centred and right-aligned text stays put.
//
// If the vector build fails for any reason, the old route — a picture of each
// page — is used instead, so the button always produces a file. The caller is
// told which one it got.
//
// Everything here is loaded on click only, so it costs nothing up front.
// -----------------------------------------------------------------------------

import type { jsPDF as JsPDF } from "jspdf";

export type PdfMode = "vector" | "image";

// 1 CSS px = 0.75 pt.
const PX_TO_PT = 0.75;

// Editor chrome that can sit inside a page box but is not document content.
const CHROME_SELECTOR = [
  ".superdoc__selection-layer",
  "[class*='selection-overlay']",
  "[class*='caret']",
  "[class*='cursor']",
].join(",");

// ---- Getting every page painted ---------------------------------------------

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// SuperDoc paints page content lazily, only for pages near the viewport: a
// page further down is an empty box until it has been scrolled to. So each
// page is brought into view and given time to paint before it is read.
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

// ---- Colours ----------------------------------------------------------------

type RGB = [number, number, number];

// Computed colours are always rgb()/rgba(). Translucent colours are blended onto
// white, which is what they sit on in this document.
function parseColor(css: string): RGB | null {
  const m = css.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/,
  );
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith("%")) a /= 100;
  if (a < 0.01) return null;
  const mix = (v: string) => Math.round(parseFloat(v) * a + 255 * (1 - a));
  return [mix(m[1]), mix(m[2]), mix(m[3])];
}

// ---- Fonts ------------------------------------------------------------------

type PdfStyle = "normal" | "bold" | "italic" | "bolditalic";
type Builtin = "helvetica" | "times" | "courier";

interface WebFont {
  id: string; // file / family name inside the PDF
  local: boolean; // self-hosted in /public/fonts, else fontsource CDN
  hasItalic: boolean;
  fallback: Builtin;
}

// Keyed by the lower-cased CSS family name.
const WEB_FONTS: Record<string, WebFont> = {
  garamond: { id: "eb-garamond", local: true, hasItalic: true, fallback: "times" },
  "eb garamond": { id: "eb-garamond", local: true, hasItalic: true, fallback: "times" },
  "trajan pro": { id: "cinzel", local: true, hasItalic: false, fallback: "times" },
  cinzel: { id: "cinzel", local: true, hasItalic: false, fallback: "times" },
  lora: { id: "lora", local: false, hasItalic: true, fallback: "times" },
  merriweather: { id: "merriweather", local: false, hasItalic: true, fallback: "times" },
  "source serif 4": { id: "source-serif-4", local: false, hasItalic: true, fallback: "times" },
  "ibm plex sans": { id: "ibm-plex-sans", local: false, hasItalic: true, fallback: "helvetica" },
  inter: { id: "inter", local: false, hasItalic: true, fallback: "helvetica" },
  lato: { id: "lato", local: false, hasItalic: true, fallback: "helvetica" },
  "open sans": { id: "open-sans", local: false, hasItalic: true, fallback: "helvetica" },
  roboto: { id: "roboto", local: false, hasItalic: true, fallback: "helvetica" },
};

const BUILTINS: Record<string, Builtin> = {
  arial: "helvetica",
  helvetica: "helvetica",
  calibri: "helvetica",
  "sans-serif": "helvetica",
  "system-ui": "helvetica",
  "ui-sans-serif": "helvetica",
  "times new roman": "times",
  times: "times",
  georgia: "times",
  cambria: "times",
  serif: "times",
  "courier new": "courier",
  courier: "courier",
  monospace: "courier",
};

// What a run asks for, resolved to something the PDF can draw.
type FontChoice = { kind: "web"; font: WebFont } | { kind: "builtin"; name: Builtin };

function chooseFont(cssFamilies: string): FontChoice {
  const names = cssFamilies
    .split(",")
    .map((f) =>
      f
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    )
    .filter((f) => f && !f.startsWith("__")); // SuperDoc's private symbol font
  for (const n of names) {
    if (WEB_FONTS[n]) return { kind: "web", font: WEB_FONTS[n] };
    if (BUILTINS[n]) return { kind: "builtin", name: BUILTINS[n] };
  }
  return { kind: "builtin", name: "helvetica" };
}

const pdfStyle = (bold: boolean, italic: boolean): PdfStyle =>
  bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";

// Font files as base64, cached for the page's lifetime. `null` = unavailable.
const fontFiles = new Map<string, Promise<string | null>>();

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fontUrl(font: WebFont, file: string): string {
  return font.local
    ? `${import.meta.env.BASE_URL}fonts/${font.id}-${file}.ttf`
    : `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}@latest/latin-${file}.ttf`;
}

function loadFontFile(font: WebFont, file: string): Promise<string | null> {
  const key = `${font.id}-${file}`;
  let p = fontFiles.get(key);
  if (!p) {
    p = fetch(fontUrl(font, file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(toBase64)
      .catch(() => null); // offline / blocked — the caller falls back
    fontFiles.set(key, p);
  }
  return p;
}

/**
 * Registers the fonts a jsPDF document needs and hands back what to call
 * `setFont` with for each run. One instance per document: jsPDF keeps its
 * fonts per document.
 */
class FontBook {
  private registered = new Map<string, [string, PdfStyle] | null>();
  constructor(private pdf: JsPDF) {}

  async resolve(choice: FontChoice, bold: boolean, italic: boolean): Promise<[string, PdfStyle]> {
    if (choice.kind === "builtin") return [choice.name, pdfStyle(bold, italic)];
    const { font } = choice;
    const it = italic && font.hasItalic;
    const style = pdfStyle(bold, it);
    const key = `${font.id}/${style}`;
    if (!this.registered.has(key)) {
      const file = `${bold ? 700 : 400}-${it ? "italic" : "normal"}`;
      const data = await loadFontFile(font, file);
      if (data) {
        const vfsName = `${font.id}-${file}.ttf`;
        this.pdf.addFileToVFS(vfsName, data);
        this.pdf.addFont(vfsName, font.id, style);
        this.registered.set(key, [font.id, style]);
      } else {
        this.registered.set(key, null);
      }
    }
    return this.registered.get(key) ?? [font.fallback, pdfStyle(bold, italic)];
  }
}

// Distance from the top of a text run's box to its baseline, for the font the
// browser actually used on screen. Cached per CSS font.
const ascents = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

function ascentOf(cssFont: string, sizePx: number): number {
  let a = ascents.get(cssFont);
  if (a === undefined) {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (measureCtx) {
      measureCtx.font = cssFont;
      const m = measureCtx.measureText("Hg");
      a = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    }
    if (!a || !isFinite(a)) a = sizePx * 0.8;
    ascents.set(cssFont, a);
  }
  return a;
}

// ---- Reading a page back out of the DOM -------------------------------------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Op =
  | ({ kind: "rect"; color: RGB } & Box)
  | ({ kind: "image"; src: HTMLImageElement } & Box)
  | ({
      kind: "text";
      text: string;
      font: FontChoice;
      bold: boolean;
      italic: boolean;
      sizePt: number;
      color: RGB;
      baseline: number; // pt from the top of the page
      letterSpacingPt: number;
      underline: boolean;
      strike: boolean;
      ascentPt: number;
    } & Box);

function applyTextTransform(text: string, transform: string): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize")
    return text.replace(/(^|\s)(\S)/g, (_, s, c) => s + c.toUpperCase());
  return text;
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Walk one rendered page and return what to draw, in painting order, with all
 * coordinates in PDF points from the page's top-left corner.
 */
function readPage(page: HTMLElement): Op[] {
  const origin = page.getBoundingClientRect();
  // The editor may be zoomed; offsetWidth is the unzoomed layout width.
  const zoom = origin.width / page.offsetWidth || 1;
  const toBox = (r: DOMRect): Box => ({
    x: ((r.left - origin.left) / zoom) * PX_TO_PT,
    y: ((r.top - origin.top) / zoom) * PX_TO_PT,
    w: (r.width / zoom) * PX_TO_PT,
    h: (r.height / zoom) * PX_TO_PT,
  });
  const pageBox: Box = toBox(origin);
  pageBox.x = pageBox.y = 0;

  const ops: Op[] = [];

  const visit = (el: Element, clip: Box) => {
    if (el.matches(CHROME_SELECTOR)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return;

    const rect = el.getBoundingClientRect();
    const box = toBox(rect);

    if (el !== page && box.w > 0 && box.h > 0) {
      // Fill, then the four borders drawn as thin filled rectangles — exact,
      // and immune to how a PDF viewer joins stroked line ends.
      const bg = parseColor(cs.backgroundColor);
      if (bg && !(bg[0] === 255 && bg[1] === 255 && bg[2] === 255)) {
        ops.push({ kind: "rect", color: bg, ...box });
      }
      const side = (w: string, style: string, color: string) => {
        const width = parseFloat(w) * PX_TO_PT;
        if (!width || style === "none" || style === "hidden") return null;
        const c = parseColor(color);
        return c ? { width, c } : null;
      };
      const t = side(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor);
      const r = side(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor);
      const b = side(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor);
      const l = side(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor);
      if (t) ops.push({ kind: "rect", color: t.c, x: box.x, y: box.y, w: box.w, h: t.width });
      if (b)
        ops.push({
          kind: "rect",
          color: b.c,
          x: box.x,
          y: box.y + box.h - b.width,
          w: box.w,
          h: b.width,
        });
      if (l) ops.push({ kind: "rect", color: l.c, x: box.x, y: box.y, w: l.width, h: box.h });
      if (r)
        ops.push({
          kind: "rect",
          color: r.c,
          x: box.x + box.w - r.width,
          y: box.y,
          w: r.width,
          h: box.h,
        });

      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
        ops.push({ kind: "image", src: el, ...box });
      }
    }

    const childClip =
      el !== page && cs.overflow !== "visible" && box.w > 0 && box.h > 0 ? box : clip;

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child as Element, childClip);
      } else if (child.nodeType === Node.TEXT_NODE) {
        readText(child as Text, cs, childClip);
      }
    }
  };

  const readText = (node: Text, cs: CSSStyleDeclaration, clip: Box) => {
    const raw = node.data;
    if (!raw.trim()) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    if (rects.length === 0) return;

    // SuperDoc lays lines out itself, so a run is one line — one rect. If a run
    // ever wraps, split it character by character into one piece per line.
    const pieces: Array<{ text: string; rect: DOMRect }> = [];
    if (rects.length === 1) {
      pieces.push({ text: raw, rect: rects[0] });
    } else {
      let start = 0;
      let top: number | null = null;
      for (let i = 0; i < raw.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (top !== null && Math.abs(r.top - top) > 1) {
          range.setStart(node, start);
          range.setEnd(node, i);
          pieces.push({ text: raw.slice(start, i), rect: range.getBoundingClientRect() });
          start = i;
        }
        if (r.width > 0 || top === null) top = r.top;
      }
      range.setStart(node, start);
      range.setEnd(node, raw.length);
      pieces.push({ text: raw.slice(start), rect: range.getBoundingClientRect() });
    }

    const sizePx = parseFloat(cs.fontSize);
    if (!sizePx) return;
    const cssFont = `${cs.fontStyle} ${cs.fontWeight} ${sizePx}px ${cs.fontFamily}`;
    const ascentPx = ascentOf(cssFont, sizePx);
    const color = parseColor(cs.color) ?? [0, 0, 0];
    const deco = cs.textDecorationLine || cs.textDecoration || "";
    const ls = parseFloat(cs.letterSpacing);

    for (const { text, rect } of pieces) {
      const t = applyTextTransform(text, cs.textTransform);
      if (!t.trim()) continue;
      const box = toBox(rect);
      if (!intersects(box, clip)) continue;
      ops.push({
        kind: "text",
        text: t,
        font: chooseFont(cs.fontFamily),
        bold: parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === "bold",
        italic: cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique"),
        sizePt: sizePx * PX_TO_PT,
        color,
        baseline: box.y + ascentPx * PX_TO_PT,
        letterSpacingPt: isFinite(ls) ? ls * PX_TO_PT : 0,
        underline: deco.includes("underline"),
        strike: deco.includes("line-through"),
        ascentPt: ascentPx * PX_TO_PT,
        ...box,
      });
    }
  };

  visit(page, pageBox);
  return ops;
}

// ---- Drawing into the PDF ---------------------------------------------------

function imageData(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c.toDataURL("image/png");
}

async function drawPage(pdf: JsPDF, fonts: FontBook, ops: Op[]): Promise<void> {
  for (const op of ops) {
    if (op.kind === "rect") {
      pdf.setFillColor(...op.color);
      pdf.rect(op.x, op.y, op.w, op.h, "F");
    } else if (op.kind === "image") {
      try {
        pdf.addImage(imageData(op.src), "PNG", op.x, op.y, op.w, op.h, undefined, "FAST");
      } catch {
        /* a cross-origin or broken image is left out rather than failing the page */
      }
    } else {
      const [family, style] = await fonts.resolve(op.font, op.bold, op.italic);
      pdf.setFont(family, style);
      pdf.setFontSize(op.sizePt);
      pdf.setTextColor(...op.color);

      // Place the run exactly where it sits on screen and give it the same
      // width: whatever the PDF font's natural width differs by is spread over
      // the character spacing (capped, so a missing screen font never makes it
      // look strange). Glyph shapes are never stretched.
      const n = Array.from(op.text).length;
      const natural = pdf.getTextWidth(op.text) + op.letterSpacingPt * n;
      let charSpace = op.letterSpacingPt;
      if (n > 1) {
        const extra = (op.w - natural) / n;
        const cap = op.sizePt * 0.12;
        charSpace += Math.max(-cap, Math.min(cap, extra));
      }
      pdf.text(op.text, op.x, op.baseline, { baseline: "alphabetic", charSpace });

      if (op.underline || op.strike) {
        pdf.setFillColor(...op.color);
        const thick = Math.max(0.4, op.sizePt * 0.05);
        if (op.underline) pdf.rect(op.x, op.baseline + op.sizePt * 0.1, op.w, thick, "F");
        if (op.strike) pdf.rect(op.x, op.baseline - op.ascentPt * 0.3, op.w, thick, "F");
      }
    }
  }
  // Leave the text state clean for the next page.
  pdf.setCharSpace(0);
}

async function buildVectorPdf(pages: HTMLElement[], onPage: (i: number) => void): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  let pdf: JsPDF | null = null;
  let fonts: FontBook | null = null;

  for (const [i, page] of pages.entries()) {
    await paintPage(page);
    const wPt = page.offsetWidth * PX_TO_PT;
    const hPt = page.offsetHeight * PX_TO_PT;
    const orientation = wPt > hPt ? "landscape" : "portrait";
    if (!pdf) {
      pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation, compress: true });
      fonts = new FontBook(pdf);
    } else {
      pdf.addPage([wPt, hPt], orientation);
    }
    await drawPage(pdf, fonts!, readPage(page));
    onPage(i);
  }
  return pdf!;
}

// ---- Fallback: a picture of each page ---------------------------------------
// The previous export route, kept so the button still produces a file if the
// vector build ever fails (an unexpected layout, a browser without an API it
// relies on). Text in this version is an image.

async function buildImagePdf(pages: HTMLElement[], onPage: (i: number) => void): Promise<JsPDF> {
  const [{ domToJpeg }, { jsPDF }] = await Promise.all([
    import("modern-screenshot"),
    import("jspdf"),
  ]);
  let pdf: JsPDF | null = null;

  for (const [i, page] of pages.entries()) {
    await paintPage(page);
    const wPx = page.offsetWidth;
    const hPx = page.offsetHeight;
    const wPt = wPx * PX_TO_PT;
    const hPt = hPx * PX_TO_PT;
    const orientation = wPx > hPx ? "landscape" : "portrait";

    // 2× of a 96-dpi A4 page is ~190 dpi: crisp 11pt text at a couple of
    // hundred kB per page.
    const img = await domToJpeg(page, {
      width: wPx,
      height: hPx,
      scale: 2,
      quality: 0.92,
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
    onPage(i);
  }
  return pdf!;
}

// ---- Entry point ------------------------------------------------------------

/**
 * Turn every `.superdoc-page` inside `root` into one PDF and download it.
 * `onProgress(done, total)` fires after each page, for a counter on the button.
 * Resolves to which kind of PDF was produced; throws if nothing could be made.
 */
export async function downloadPagesAsPdf(
  root: HTMLElement,
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfMode> {
  // Drop the caret and selection highlight so they are not drawn.
  (document.activeElement as HTMLElement | null)?.blur?.();
  window.getSelection()?.removeAllRanges();
  try {
    await document.fonts.ready;
  } catch {
    /* no Font Loading API — nothing to wait for */
  }

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".superdoc-page"));
  if (pages.length === 0) throw new Error("No rendered pages to export");

  const restoreScroll = saveScroll(pages[0]);
  const report = (i: number) => onProgress?.(i + 1, pages.length);
  try {
    onProgress?.(0, pages.length);
    try {
      (await buildVectorPdf(pages, report)).save(filename);
      return "vector";
    } catch (e) {
      console.warn("Vector PDF failed, falling back to page images:", e);
      onProgress?.(0, pages.length);
      (await buildImagePdf(pages, report)).save(filename);
      return "image";
    }
  } finally {
    restoreScroll();
  }
}
