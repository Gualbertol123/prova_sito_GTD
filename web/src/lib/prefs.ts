// Per-viewer UI preferences (language, which columns are shown). These are
// personal display settings for THIS browser only — not board data — so
// localStorage is the right home for them. The board's actual content still
// lives only on the server and is never cached locally.

const KEYS = {
  lang: "gtd-lang",
  hidden: "gtd-hidden-cols",
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

// Columns the viewer has chosen to hide.
export function readHidden(): string[] {
  try {
    const raw = readPref("hidden");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeHidden(cols: string[]): void {
  writePref("hidden", JSON.stringify(cols));
}
