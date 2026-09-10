import type { Task, Weekly } from "./types";

// Initial content — recovered from the original artifact. Used once, to seed an
// empty Supabase project on first load.

export const SEED_BOARD_NAME = "TEAM GTD FINALE";
export const SEED_MEMBERS = ["Francesco", "Chiara", "Gonzalo", "Gualberto"];

export function seedTasks(): Task[] {
  const now = Date.now();
  const sub = [
    { id: "s1", text: "Aggiornamento pricing in file Ambition Q4", done: false },
    { id: "s2", text: "Aggiungere Market Share", done: false },
    { id: "s3", text: "Check risultanze", done: false },
    { id: "s4", text: "Adjustments sui TCD (con Robi)", done: false },
  ];
  const t = (i: number): number => now + i; // stable ascending order

  return [
    { id: "1", title: "BU Pivot loans", desc: "Aggiornamento pricing, Market Share, Check risultanze, Adjustments TCD", owner: "Francesco", priority: "P1", status: "NEXT", notes: "Pricing: Ambition Q4.xlsx col M - TCD 2.5% con Robi", subtasks: sub, dueDate: "2026-05-12", updatedAt: now, createdAt: t(1) },
    { id: "2", title: "Retail Q3 Ambition", desc: "Unirlo con BU pivot loans?", owner: "Chiara", priority: "P1", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-15", updatedAt: now, createdAt: t(2) },
    { id: "3", title: "Completare check vs TBD per chief dashboard", desc: "Corporate, Retail Loans vs BOY entro mercoledì", owner: "Francesco", priority: "P2", status: "IN PROGRESS", notes: "", subtasks: [], dueDate: "2026-05-10", updatedAt: now, createdAt: t(3) },
    { id: "4", title: "Efficientare l'update dei cambi", desc: "Rimozione collegamento Dashboard Preparation", owner: "Chiara", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-20", updatedAt: now, createdAt: t(4) },
    { id: "5", title: "Cambiare corporate con legal entities", desc: "Entro mercoledì", owner: "Francesco", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-14", updatedAt: now, createdAt: t(5) },
    { id: "6", title: "VUB - spostare SB", desc: "", owner: "Gualberto", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-18", updatedAt: now, createdAt: t(6) },
    { id: "7", title: "BU_LOANS_DEPO_PIVOT_luglio_v9", desc: "Rinominare togliendo luglio", owner: "Francesco", priority: "P3", status: "BACKLOG", notes: "", subtasks: [], updatedAt: now, createdAt: t(7) },
    { id: "8", title: "Integrazione DB esterno per PJT", desc: "Integrazione SB e SME", owner: "Unassigned", priority: "P1", status: "WAITING", notes: "Attesa delivery esterna", subtasks: [], waitingSince: "2026-05-01", dueDate: "2026-05-08", updatedAt: now, createdAt: t(8) },
    { id: "9", title: "Chief dashboard ppt artificiale", desc: "", owner: "Chiara", priority: "P4", status: "MAYBE", notes: "", subtasks: [], updatedAt: now, createdAt: t(9) },
    { id: "10", title: "Mind Map macroambiti", desc: "", owner: "Francesco", priority: "P4", status: "MAYBE", notes: "", subtasks: [], updatedAt: now, createdAt: t(10) },
    { id: "11", title: "Allineamento pricing Q4", desc: "Conferma tassi finali", owner: "Gonzalo", priority: "P1", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-13", updatedAt: now, createdAt: t(11) },
  ];
}

// Weekly seed as flat rows: { id, bucket, body, createdAt }
export function seedWeeklyRows(): {
  id: string;
  bucket: keyof Weekly;
  body: string;
  createdAt: number;
}[] {
  const now = Date.now();
  const rows: { id: string; bucket: keyof Weekly; body: string; createdAt: number }[] = [
    { id: "w1", bucket: "well", body: "Chiuso BU Pivot pricing", createdAt: now + 1 },
    { id: "w2", bucket: "well", body: "Allineamento con Gualberto su VUB ok", createdAt: now + 2 },
    { id: "i1", bucket: "improve", body: "Handoff con team esterno troppo lento - serve SLA chiaro", createdAt: now + 3 },
    { id: "f1", bucket: "focus", body: "Corporate vs Legal entities entro mercoledì", createdAt: now + 4 },
    { id: "f2", bucket: "focus", body: "Check TBD chief dashboard", createdAt: now + 5 },
    { id: "b1", bucket: "blockers", body: "Integrazione DB esterno in attesa - blocca PJT", createdAt: now + 6 },
    { id: "l1", bucket: "learnings", body: "TBD file va versionato meglio", createdAt: now + 7 },
  ];
  return rows;
}
