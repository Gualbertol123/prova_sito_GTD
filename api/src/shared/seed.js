"use strict";

// Initial board — faithfully recovered from the original artifact.
// Used only once, when the Cosmos container has no board document yet.
function seedBoard() {
  const now = Date.now();
  const sub = [
    { id: "s1", text: "Aggiornamento pricing in file Ambition Q4", done: false },
    { id: "s2", text: "Aggiungere Market Share", done: false },
    { id: "s3", text: "Check risultanze", done: false },
    { id: "s4", text: "Adjustments sui TCD (con Robi)", done: false },
  ];

  const tasks = [
    { id: "1", title: "BU Pivot loans", desc: "Aggiornamento pricing, Market Share, Check risultanze, Adjustments TCD", owner: "Francesco", priority: "P1", status: "NEXT", notes: "Pricing: Ambition Q4.xlsx col M - TCD 2.5% con Robi", subtasks: sub, dueDate: "2026-05-12", updatedAt: now },
    { id: "2", title: "Retail Q3 Ambition", desc: "Unirlo con BU pivot loans?", owner: "Chiara", priority: "P1", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-15", updatedAt: now },
    { id: "3", title: "Completare check vs TBD per chief dashboard", desc: "Corporate, Retail Loans vs BOY entro mercoledì", owner: "Francesco", priority: "P2", status: "IN PROGRESS", notes: "", subtasks: [], dueDate: "2026-05-10", updatedAt: now },
    { id: "4", title: "Efficientare l'update dei cambi", desc: "Rimozione collegamento Dashboard Preparation", owner: "Chiara", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-20", updatedAt: now },
    { id: "5", title: "Cambiare corporate con legal entities", desc: "Entro mercoledì", owner: "Francesco", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-14", updatedAt: now },
    { id: "6", title: "VUB - spostare SB", desc: "", owner: "Gualberto", priority: "P2", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-18", updatedAt: now },
    { id: "7", title: "BU_LOANS_DEPO_PIVOT_luglio_v9", desc: "Rinominare togliendo luglio", owner: "Francesco", priority: "P3", status: "BACKLOG", notes: "", subtasks: [], updatedAt: now },
    { id: "8", title: "Integrazione DB esterno per PJT", desc: "Integrazione SB e SME", owner: "Unassigned", priority: "P1", status: "WAITING", notes: "Attesa delivery esterna", subtasks: [], waitingSince: "2026-05-01", dueDate: "2026-05-08", updatedAt: now },
    { id: "9", title: "Chief dashboard ppt artificiale", desc: "", owner: "Chiara", priority: "P4", status: "MAYBE", notes: "", subtasks: [], updatedAt: now },
    { id: "10", title: "Mind Map macroambiti", desc: "", owner: "Francesco", priority: "P4", status: "MAYBE", notes: "", subtasks: [], updatedAt: now },
    { id: "11", title: "Allineamento pricing Q4", desc: "Conferma tassi finali", owner: "Gonzalo", priority: "P1", status: "NEXT", notes: "", subtasks: [], dueDate: "2026-05-13", updatedAt: now },
  ];

  const weekly = {
    well: [
      { id: "w1", text: "Chiuso BU Pivot pricing" },
      { id: "w2", text: "Allineamento con Gualberto su VUB ok" },
    ],
    improve: [
      { id: "i1", text: "Handoff con team esterno troppo lento - serve SLA chiaro" },
    ],
    focus: [
      { id: "f1", text: "Corporate vs Legal entities entro mercoledì" },
      { id: "f2", text: "Check TBD chief dashboard" },
    ],
    blockers: [
      { id: "b1", text: "Integrazione DB esterno in attesa - blocca PJT" },
    ],
    learnings: [{ id: "l1", text: "TBD file va versionato meglio" }],
  };

  return {
    id: "board",
    boardName: "TEAM GTD FINALE",
    members: ["Francesco", "Chiara", "Gonzalo", "Gualberto"],
    tasks,
    weekly,
    updatedAt: now,
    rev: 1,
  };
}

module.exports = { seedBoard };
