// Client-side image handling for the custom logo / favicon.
//
// Accepts input files up to 5 MB each, then ALWAYS rasterises + downscales them
// to a small icon before storing. The logo/favicon are saved (as data URLs) in
// the shared board_meta row, which the live board re-reads on its refresh
// cycle — so the stored image must stay small regardless of the input size.

export const INPUT_MAX_MB = 5;
const INPUT_MAX_BYTES = INPUT_MAX_MB * 1024 * 1024;

// Target dimension and stored-size cap for each kind (display sizes are tiny).
const DIM = { logo: 320, favicon: 128 } as const;
const STORED_MAX_BYTES = 400 * 1024;

export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const FAVICON_ACCEPT =
  "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico";

const ALLOWED: Record<"logo" | "favicon", RegExp> = {
  logo: /^image\/(png|jpeg|webp|svg\+xml)$/,
  favicon: /^image\/(png|svg\+xml|x-icon|vnd\.microsoft\.icon)$/,
};

export class ImageError extends Error {
  code: "bad" | "big";
  constructor(code: "bad" | "big") {
    super(code);
    this.code = code;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new ImageError("bad"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("bad"));
    img.src = src;
  });
}

// Rasterise onto a canvas at maxDim, shrinking further if the PNG still exceeds
// the stored cap. Works for raster, SVG and ICO alike (all render into <img>).
async function rasterise(dataUrl: string, maxDim: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const natural = Math.max(img.naturalWidth || img.width || 0, img.naturalHeight || img.height || 0);
  const baseW = img.naturalWidth || img.width || maxDim; // SVGs may report 0 → square
  const baseH = img.naturalHeight || img.height || maxDim;

  let dim = natural > 0 ? Math.min(maxDim, natural) : maxDim;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = dim / Math.max(baseW, baseH);
    const w = Math.max(1, Math.round(baseW * scale));
    const h = Math.max(1, Math.round(baseH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("bad");
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    let out: string;
    try {
      out = canvas.toDataURL("image/png");
    } catch {
      throw new ImageError("bad"); // tainted canvas
    }
    if (out.length * 0.75 <= STORED_MAX_BYTES || dim <= 32) return out;
    dim = Math.round(dim * 0.75);
  }
  throw new ImageError("big");
}

export async function processImage(file: File, kind: "logo" | "favicon"): Promise<string> {
  if (!ALLOWED[kind].test(file.type || "") && !/\.ico$/i.test(file.name)) {
    throw new ImageError("bad");
  }
  if (file.size > INPUT_MAX_BYTES) throw new ImageError("big");
  const dataUrl = await readAsDataUrl(file);
  return rasterise(dataUrl, DIM[kind]);
}
