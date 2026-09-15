// Client-side image handling for the custom logo / favicon. Validates the file
// type, downsizes raster images onto a canvas to keep the stored data URL
// small, and passes SVG/ICO through (size-checked). Returns a data URL string.

export const LOGO_MAX_KB = 250;
export const FAVICON_MAX_KB = 100;

export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const FAVICON_ACCEPT =
  "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico";

export class ImageError extends Error {
  code: "bad" | "big";
  constructor(code: "bad" | "big") {
    super(code);
    this.code = code;
  }
}

const RASTER = new Set(["image/png", "image/jpeg", "image/webp"]);
const PASSTHROUGH = new Set([
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

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

// Downscale a raster image to fit maxDim, exporting a PNG data URL. Shrinks
// further if it still exceeds maxBytes.
async function downscale(dataUrl: string, maxDim: number, maxBytes: number): Promise<string> {
  const img = await loadImage(dataUrl);
  let dim = Math.min(maxDim, Math.max(img.width, img.height) || maxDim);
  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = dim / Math.max(img.width, img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("bad");
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/png");
    if (out.length * 0.75 <= maxBytes || dim <= 32) return out;
    dim = Math.round(dim * 0.75);
  }
  throw new ImageError("big");
}

export async function processImage(
  file: File,
  kind: "logo" | "favicon"
): Promise<string> {
  const type = file.type || "";
  const maxBytes = (kind === "logo" ? LOGO_MAX_KB : FAVICON_MAX_KB) * 1024;
  const maxDim = kind === "logo" ? 256 : 128;

  const isIco = /\.ico$/i.test(file.name) || PASSTHROUGH.has(type);

  if (RASTER.has(type)) {
    const dataUrl = await readAsDataUrl(file);
    return downscale(dataUrl, maxDim, maxBytes);
  }
  if (type === "image/svg+xml" || isIco) {
    if (file.size > maxBytes) throw new ImageError("big");
    return readAsDataUrl(file);
  }
  throw new ImageError("bad");
}
