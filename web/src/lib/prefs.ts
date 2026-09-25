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
  prio: "gtd-prio-collapsed",
  reflauth: "gtd-refl-auth",
  mysugg: "gtd-my-suggestions",
  reflpane: "gtd-reflection-pane",
  skin: "gtd-skin",
  appearance: "gtd-appearance",
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

// When this device's team login ends: { exp: epoch-ms }. The session itself
// is Supabase's (lib/supabaseClient.ts); AuthGate ends it at this time.
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

// Priority-distribution collapsed state (default collapsed to save space).
export function readPrioCollapsed(): boolean {
  const v = readPref("prio");
  return v === null ? true : v === "1";
}
export function writePrioCollapsed(v: boolean): void {
  writePref("prio", v ? "1" : "0");
}

// Per-device reflection login cache: member -> expiry epoch ms, or "never"
// (indefinite). A member is authed while their value is "never" or in the future.
type ReflAuthMap = Record<string, number | "never">;

function reflAuthMap(): ReflAuthMap {
  const m = readJson<ReflAuthMap>("reflauth", {});
  return m && typeof m === "object" ? m : {};
}
export function isReflAuthed(member: string): boolean {
  const v = reflAuthMap()[member];
  return v === "never" || (typeof v === "number" && v > Date.now());
}
export function reflAuthValue(member: string): number | "never" | null {
  const v = reflAuthMap()[member];
  return v === "never" || typeof v === "number" ? v : null;
}
// days: a number of days, or "never" for indefinite.
export function setReflAuth(member: string, days: number | "never"): void {
  const m = reflAuthMap();
  m[member] = days === "never" ? "never" : Date.now() + days * 86400000;
  writePref("reflauth", JSON.stringify(m));
}
export function clearReflAuth(member: string): void {
  const m = reflAuthMap();
  delete m[member];
  writePref("reflauth", JSON.stringify(m));
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

// Ids of the suggestions posted from THIS browser. Suggestions are anonymous —
// the server stores no author — so this local list is the only thing that lets
// someone delete their own. It never leaves the device.
export function readMySuggestions(): string[] {
  return readJson<string[]>("mysugg", []).filter((x) => typeof x === "string");
}
export function addMySuggestion(id: string): void {
  writePref("mysugg", JSON.stringify([...readMySuggestions(), id]));
}
export function removeMySuggestion(id: string): void {
  writePref("mysugg", JSON.stringify(readMySuggestions().filter((x) => x !== id)));
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
