// -----------------------------------------------------------------------------
// SuperDoc — the in-browser Word editor for the generated report.
//
// SuperDoc is big (~12 MB installed), so nothing here is in the main bundle.
// Everything loads through `preloadSuperDoc()`, which is kicked off the moment
// the REPORT tab opens — i.e. in parallel with building the .docx — so by the
// time a report exists the editor is usually already in memory.
//
// Caching: the dynamic import puts SuperDoc in its own content-hashed chunk
// (see `manualChunks` in vite.config.ts). That chunk's name only changes when
// SuperDoc itself changes, so ordinary app deploys leave the browser's copy
// valid, and a SuperDoc upgrade invalidates that one chunk and nothing else.
// The promises below are module-level, so within a session it loads once
// however many times the editor is opened and closed.
// -----------------------------------------------------------------------------

import type { SuperDoc as SuperDocClass } from "superdoc";

export type SuperDocInstance = InstanceType<typeof SuperDocClass>;

type SuperDocModule = typeof import("superdoc");

let modulePromise: Promise<SuperDocModule> | null = null;
let fontsPromise: Promise<void> | null = null;

/**
 * Start (or join) the SuperDoc download. Safe to call repeatedly — the work
 * happens once per page load. Call it early; await it late.
 */
export function preloadSuperDoc(): Promise<SuperDocModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const [mod] = await Promise.all([import("superdoc"), import("superdoc/style.css")]);
      return mod;
    })();
    // A failed load must not be cached forever — let the next attempt retry.
    modulePromise.catch(() => {
      modulePromise = null;
    });
  }
  return modulePromise;
}

// ---- Fonts ------------------------------------------------------------------
// Google Fonts, loaded from the same CDN the app already uses for Cinzel and
// Inter. EB Garamond leads the list because it is the open counterpart of the
// template's Garamond, so a document restyled with it still looks like itself.

export const GOOGLE_FONTS = [
  "EB Garamond",
  "Lora",
  "Merriweather",
  "Source Serif 4",
  "IBM Plex Sans",
  "Inter",
  "Lato",
  "Open Sans",
  "Roboto",
] as const;

// Fonts already in the document or on a typical corporate desktop. Listed so a
// user can always get back to what the template ships with.
const DOCUMENT_FONTS = [
  "Garamond",
  "Trajan Pro",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
] as const;

export const FONT_OPTIONS = [...GOOGLE_FONTS, ...DOCUMENT_FONTS]
  .slice()
  .sort((a, b) => a.localeCompare(b))
  .map((f) => ({ value: f, label: f, previewFamily: f }));

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  GOOGLE_FONTS.map(
    (f) => `family=${f.replace(/ /g, "+")}:ital,wght@0,400;0,700;1,400;1,700`
  ).join("&") +
  "&display=swap";

/**
 * Add the Google Fonts stylesheet once and wait for the faces to be usable.
 *
 * Deliberately non-fatal: if the network (or a corporate proxy) blocks Google,
 * the editor still opens and the document still renders in its own fonts —
 * only the extra families in the dropdown are unavailable.
 */
export function ensureReportFonts(): Promise<void> {
  if (!fontsPromise) {
    fontsPromise = new Promise<void>((resolve) => {
      const existing = document.querySelector<HTMLLinkElement>("link[data-report-fonts]");
      if (existing) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      link.dataset.reportFonts = "1";
      link.onload = () => resolve();
      link.onerror = () => resolve(); // offline / blocked — carry on regardless
      document.head.appendChild(link);
    }).then(async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* no Font Loading API — nothing to wait for */
      }
    });
  }
  return fontsPromise;
}

// ---- Editor lifecycle -------------------------------------------------------

export interface CreateEditorOptions {
  editorEl: HTMLElement;
  toolbarEl: HTMLElement;
  file: File;
  onReady?: () => void;
}

/**
 * Mount the editor on an already-generated .docx. Resolves once SuperDoc has
 * signalled that the document is ready.
 */
export async function createReportEditor({
  editorEl,
  toolbarEl,
  file,
  onReady,
}: CreateEditorOptions): Promise<SuperDocInstance> {
  const [{ SuperDoc }] = await Promise.all([preloadSuperDoc(), ensureReportFonts()]);

  return new Promise<SuperDocInstance>((resolve, reject) => {
    try {
      const instance = new SuperDoc({
        selector: editorEl,
        toolbar: toolbarEl,
        document: file,
        documentMode: "editing",
        role: "editor",
        // No document ever leaves the browser: SuperDoc's "document open"
        // telemetry is off, so report contents and filenames are not reported
        // to a third party.
        telemetry: { enabled: false },
        fonts: { families: GOOGLE_FONTS.map((family) => ({ family })) },
        ui: {
          toolbar: { fontOptions: FONT_OPTIONS },
          search: true,
          ruler: true,
        },
        uiDisplayFallbackFont: '"Inter", ui-sans-serif, system-ui, sans-serif',
        onReady: () => {
          onReady?.();
          resolve(instance);
        },
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** The edited document as a .docx blob. DOCX is SuperDoc's only export format. */
export async function exportEditedDocx(instance: SuperDocInstance): Promise<Blob> {
  return instance.export({ exportType: ["docx"], triggerDownload: false });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- PDF via the browser's print dialog -------------------------------------

/**
 * "Save as PDF" through the browser's own print pipeline.
 *
 * The rendered pages are already exact A4 boxes with the letterhead and footer
 * drawn in, so printing them is the whole conversion. `print.css` hides the
 * rest of the app; the only thing that cannot be done from code is Chrome's
 * own header/footer, which the caller warns the user to untick.
 *
 * Pages are tagged portrait/landscape from their measured aspect first, so the
 * planner sheet prints landscape via its own named @page rule.
 */
export function printForPdf(): void {
  const pages = document.querySelectorAll<HTMLElement>(".superdoc-page");
  pages.forEach((page) => {
    const { width, height } = page.getBoundingClientRect();
    page.classList.toggle("sd-print-landscape", width > height);
  });

  // Flatten the app layout between <body> and the pages. They have to stay in
  // normal flow — Chrome only honours a named @page (the landscape planner
  // sheet) for flowed boxes — so their ancestors' padding and max-widths are
  // neutralised instead of the pages being lifted out.
  const tagged: HTMLElement[] = [];
  let node = document.querySelector<HTMLElement>(".report-print-root")?.parentElement ?? null;
  while (node && node !== document.body) {
    node.classList.add("report-print-passthrough");
    tagged.push(node);
    node = node.parentElement;
  }
  document.body.classList.add("printing-report");
  // The canvas colour comes from the root element, so html needs it too.
  document.documentElement.classList.add("printing-report");

  const cleanup = () => {
    document.body.classList.remove("printing-report");
    document.documentElement.classList.remove("printing-report");
    tagged.forEach((el) => el.classList.remove("report-print-passthrough"));
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Safety net: some browsers never fire afterprint when the dialog is cancelled.
  setTimeout(cleanup, 60000);

  window.print();
}
