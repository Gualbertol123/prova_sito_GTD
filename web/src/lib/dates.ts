// Date helpers mirroring the original artifact's behaviour.

// Whole days between an ISO date and today (>= 0). Used for "waiting since".
export function daysSince(iso?: string): number {
  if (!iso) return 0;
  const n = new Date(iso);
  const t = new Date();
  n.setHours(0, 0, 0, 0);
  t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t.getTime() - n.getTime()) / 86400000));
}

// Days until a due date (can be negative if overdue).
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const n = new Date(iso);
  const t = new Date();
  n.setHours(0, 0, 0, 0);
  t.setHours(0, 0, 0, 0);
  return Math.floor((n.getTime() - t.getTime()) / 86400000);
}

// Short IT date, e.g. "12 mag"
export function formatShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export function monthLabel(d: Date): string {
  return `${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`;
}

// Short dates with fixed month names ("21 set", "21 Sep"), the same on every
// device: toLocaleDateString depends on each browser's locale data.
const MONTHS_SHORT = {
  it: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

export function shortDate(d: Date, lang: "it" | "en", withYear = false, twoDigitDay = false): string {
  const day = twoDigitDay ? String(d.getDate()).padStart(2, "0") : String(d.getDate());
  return `${day} ${MONTHS_SHORT[lang][d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}
