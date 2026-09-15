// Per-viewer UI preferences. Personal display settings for THIS browser only —
// not board data — so localStorage is the right home. Board content still lives
// only on the server and is never cached locally.

const KEYS = {
  lang: "gtd-lang",
  hidden: "gtd-hidden-cols",
  view: "gtd-view-mode",
  weights: "gtd-col-weights",
  auth: "gtd-auth",
  me: "gtd-me",
  reviewed: "gtd-reviewed",
} as const;

export function readPref(key: keyof typeof KEYS): string | null {
  try {
    return localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export function writePref(key: keyof typeof KEYS, value: string): void {
  try {
    localStorage.setItem(KEYS[key], value);
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

export function removePref(key: keyof typeof KEYS): void {
  try {
    localStorage.removeItem(KEYS[key]);
  } catch {
    /* ignore */
  }
}

// Columns the viewer has chosen to hide.
export function readHidden(): string[] {
  return readJson<string[]>("hidden", []).filter((x) => typeof x === "string");
}
export function writeHidden(cols: string[]): void {
  writePref("hidden", JSON.stringify(cols));
}

// Board vs list view.
export type ViewMode = "board" | "list";
export function readViewMode(): ViewMode {
  return readPref("view") === "list" ? "list" : "board";
}
export function writeViewMode(v: ViewMode): void {
  writePref("view", v);
}

// Per-column flex-grow weights for the resizable board.
export function readWeights(): Record<string, number> {
  const w = readJson<Record<string, number>>("weights", {});
  return w && typeof w === "object" ? w : {};
}
export function writeWeights(w: Record<string, number>): void {
  writePref("weights", JSON.stringify(w));
}

// Cached login token: { exp: epoch-ms }.
export function readAuthExp(): number | null {
  const a = readJson<{ exp?: number }>("auth", {});
  return typeof a?.exp === "number" ? a.exp : null;
}
export function writeAuth(exp: number): void {
  writePref("auth", JSON.stringify({ exp }));
}
export function clearAuth(): void {
  removePref("auth");
}

// Which member "I" am (per device), for the Daily Reflection form.
export function readMe(): string {
  return readPref("me") ?? "";
}
export function writeMe(name: string): void {
  writePref("me", name);
}

// Learnings the viewer has marked reviewed today (per device, resets daily).
export function readReviewedToday(date: string): Set<string> {
  const v = readJson<{ date?: string; ids?: string[] }>("reviewed", {});
  if (v?.date === date && Array.isArray(v.ids)) return new Set(v.ids);
  return new Set();
}
export function writeReviewedToday(date: string, ids: string[]): void {
  writePref("reviewed", JSON.stringify({ date, ids }));
}

function readJson<T>(key: keyof typeof KEYS, fallback: T): T {
  try {
    const raw = readPref(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
