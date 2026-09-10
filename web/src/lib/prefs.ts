// Per-viewer UI preferences (language, board layout). These are personal
// display settings for THIS browser only — not board data — so localStorage is
// the right home for them. The board's actual content still lives only on the
// server and is never cached locally.

const KEYS = {
  lang: "gtd-lang",
  density: "gtd-board-density",
  collapsed: "gtd-collapsed-cols",
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

export type Density = "compact" | "normal" | "wide";

export function readDensity(): Density {
  const v = readPref("density");
  return v === "compact" || v === "wide" ? v : "normal";
}

export function readCollapsed(): string[] {
  try {
    const raw = readPref("collapsed");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeCollapsed(cols: string[]): void {
  writePref("collapsed", JSON.stringify(cols));
}
