import type { Priority, Status, Task } from "./types";

// A DONE task becomes "archived" once it has been done for this long.
export const ARCHIVE_DAYS = 7;
export function isArchived(t: Task, now = Date.now()): boolean {
  if (t.status !== "DONE") return false;
  const at = t.doneAt ?? t.updatedAt ?? 0;
  return at > 0 && now - at >= ARCHIVE_DAYS * 86400000;
}

// Column order and display labels — recovered from the original artifact.
export const STATUS_ORDER: Status[] = [
  "BACKLOG",
  "NEXT",
  "IN PROGRESS",
  "WAITING",
  "DONE",
  "MAYBE",
];

export const STATUS_LABEL: Record<Status, string> = {
  BACKLOG: "Backlog",
  NEXT: "Next",
  "IN PROGRESS": "In Progress",
  WAITING: "Waiting",
  DONE: "Done",
  MAYBE: "Maybe",
};

export const STATUS_HELP: Record<Status, string> = {
  BACKLOG: "Idee non prioritarie",
  NEXT: "Da fare a breve",
  "IN PROGRESS": "In lavorazione ora",
  WAITING: "In attesa esterna, conta gg",
  DONE: "Completata • alimenta weekly auto",
  MAYBE: "Forse più avanti",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: "P1 • Urgente",
  P2: "P2 • Alta",
  P3: "P3 • Media",
  P4: "P4 • Bassa",
};

// Dot / pill colours per priority — from the original artifact.
export const PRIORITY_DOT: Record<Priority, string> = {
  P1: "bg-[#DC2626]",
  P2: "bg-[#C9A96E]",
  P3: "bg-[#C9C5BE]",
  P4: "bg-transparent border border-dashed border-[#E8E6E1]",
};

export const UNASSIGNED = "Unassigned";

// How long a device stays logged in when Settings has no value yet. (No
// password lives in the code: they are all checked by Supabase — lib/auth.ts.)
export const DEFAULT_LOGIN_DAYS = 7;

// Weekly-review columns config (key, label, colour classes).
export const WEEKLY_COLUMNS: {
  key: "well" | "learnings" | "improve" | "blockers" | "focus";
  label: string;
  color: string;
}[] = [
  { key: "well", label: "WINS", color: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" },
  { key: "learnings", label: "LEARNINGS", color: "bg-[#0A1931] text-[#C9A96E] border-[#0A1931]" },
  { key: "improve", label: "TO IMPROVE", color: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
  { key: "blockers", label: "BLOCKERS", color: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]" },
  { key: "focus", label: "FOCUS NEXT WEEK", color: "bg-white text-[#0A1931] border-[#E8E6E1]" },
];

export type TabId =
  | "board"
  | "projects"
  | "weekly"
  | "report"
  | "products"
  | "calendario"
  | "reflection"
  | "tracking"
  | "suggestions"
  | "settings";

export const TABS: { id: TabId; label: string }[] = [
  { id: "board", label: "BOARD" },
  { id: "projects", label: "PROGETTI" },
  { id: "weekly", label: "WEEKLY" },
  { id: "report", label: "REPORT" },
  { id: "products", label: "PRODOTTI" },
  { id: "calendario", label: "CALENDARIO" },
  { id: "reflection", label: "RIFLESSIONE" },
  { id: "tracking", label: "TRACKING 🔒" },
  { id: "suggestions", label: "IDEE" },
  { id: "settings", label: "IMPOSTAZIONI" },
];

// Small helper: unique-ish id (used only for optimistic new items;
// the server keeps whatever id the client sends).
export const genId = () => Math.random().toString(36).slice(2, 9);
