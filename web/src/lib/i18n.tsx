import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { readPref, writePref } from "./prefs";
import type { Priority, Status } from "./types";

export type Lang = "it" | "en";

type Dict = Record<string, string>;

const IT: Dict = {
  "app.subtitle": "Getting Things Done · Kanban",
  "app.renameHint": "Doppio click per rinominare",
  "app.mail": "Aggiorna via mail",
  "app.loadingTitle": "TEAM GTD",
  "app.connecting": "Connessione in corso…",
  "app.connectFailed": "Connessione al server non riuscita. Riprova.",

  "conn.connecting": "Connessione…",
  "conn.live": "Live",
  "conn.reconnecting": "Riconnessione…",
  "conn.offline": "Offline",
  "conn.title": "Stato sincronizzazione in tempo reale",

  "tabs.board": "BOARD",
  "tabs.weekly": "WEEKLY",
  "tabs.calendario": "CALENDARIO",
  "tabs.reflection": "RIFLESSIONE",
  "tabs.tracking": "TRACKING 🔒",
  "tabs.istruzioni": "ISTRUZIONI",
  "tabs.settings": "IMPOSTAZIONI",

  "filters.title": "Filtri",
  "filters.search": "Cerca attività…",
  "filters.allMembers": "Tutti i membri",
  "filters.allPriorities": "Tutte le priorità",
  "filters.focusP1": "Focus P1",
  "filters.reset": "Reset",
  "view.columns": "Colonne",
  "view.columnsHint": "Mostra o nascondi le colonne",
  "view.done": "Fatto",
  "view.board": "Bacheca",
  "view.list": "Elenco",
  "view.editLayout": "Modifica layout",
  "view.editLayoutOn": "Fine modifica",
  "view.editHint": "Trascina i bordi per ridimensionare le colonne. Le colonne vicine si adattano.",
  "view.resetWidths": "Reimposta larghezze",

  "list.task": "Attività",
  "list.owner": "Assegnatario",
  "list.priority": "Priorità",
  "list.status": "Stato",
  "list.due": "Scadenza",
  "list.subtasks": "Sotto-att.",
  "list.empty": "Nessuna attività nelle colonne visibili.",

  "auth.title": "Accesso team",
  "auth.prompt": "Inserisci la password condivisa per accedere alla bacheca.",
  "auth.password": "Password",
  "auth.enter": "Entra",
  "auth.wrong": "Password errata.",
  "auth.logout": "Esci",
  "auth.remember": "Accesso ricordato per {days} giorni su questo dispositivo.",

  "settings.title": "Impostazioni",
  "settings.subtitleSection": "Sottotitolo intestazione",
  "settings.subtitleIt": "Sottotitolo (Italiano)",
  "settings.subtitleEn": "Sottotitolo (Inglese)",
  "settings.access": "Accesso",
  "settings.accessPassword": "Password di accesso",
  "settings.loginDuration": "Durata accesso (giorni)",
  "settings.save": "Salva",
  "settings.saved": "Salvato ✓",
  "settings.migrationNote": "Per salvare queste impostazioni sul server è necessario aver eseguito la migrazione 'migration-002-settings.sql' su Supabase.",
  "settings.logoutNow": "Esci da questo dispositivo",

  "cal.selectHint": "Seleziona un'attività dal calendario per vederne i dettagli qui.",
  "cal.details": "Dettagli attività",
  "cal.more": "+{n} altre",

  "board.help": "Trascina le card tra le colonne o apri una card per modificarla. Nessun popup: tutto si espande qui.",
  "quick.title": "Nuova attività…",
  "quick.add": "Aggiungi",
  "quick.owner": "Assegnatario",
  "quick.priority": "Priorità",
  "quick.status": "Stato",
  "quick.due": "Scadenza",
  "quick.newTaskIn": "Nuovo task in",

  "col.empty": "Nessuna attività",
  "col.emptyDone": "Nessuna attività completata",
  "col.collapse": "Comprimi colonna",
  "col.expand": "Espandi colonna",

  "task.due": "Scadenza",
  "task.overdue": "in ritardo",
  "task.waiting": "in attesa",
  "task.days": "gg",
  "task.subtasks": "Sotto-attività",
  "task.addSubtask": "Aggiungi sotto-attività…",
  "task.add": "Aggiungi",
  "task.notes": "Note",
  "task.notesPlaceholder": "Aggiungi una nota…",
  "task.description": "Descrizione",
  "task.descPlaceholder": "Aggiungi una descrizione…",
  "task.delete": "Elimina",
  "task.confirmDelete": "Eliminare?",
  "task.yes": "Sì",
  "task.no": "No",
  "task.prev": "Stato precedente",
  "task.next": "Stato successivo",
  "task.expand": "Apri dettagli",
  "task.collapse": "Chiudi dettagli",

  "members.team": "Team",
  "members.add": "Membro",
  "members.newName": "Nome del nuovo membro",
  "members.remove": "Rimuovi",
  "members.unassigned": "Non assegnato",

  "prio.distribution": "Distribuzione per priorità",
  "prio.P1short": "Urgente",
  "prio.P2short": "Alta",
  "prio.P3short": "Media",
  "prio.P4short": "Bassa",
  "prio.P1desc": "Focus P1 filtra solo P1.",
  "prio.P2desc": "Priorità alta standard.",
  "prio.P3desc": "Da pianificare.",
  "prio.P4desc": "Nice-to-have.",

  "status.BACKLOG.help": "Idee non prioritarie",
  "status.NEXT.help": "Da fare a breve",
  "status.IN PROGRESS.help": "In lavorazione ora",
  "status.WAITING.help": "In attesa esterna, conta i giorni",
  "status.DONE.help": "Completata • alimenta la weekly",
  "status.MAYBE.help": "Forse più avanti",

  "cal.help": "Calendario: trascina un task su una data per impostare la scadenza.",
  "cal.noDue": "Senza scadenza",
  "cal.allHaveDate": "Tutti i task hanno una data.",

  "weekly.help": "Weekly Review: la sezione FATTO si aggiorna da DONE. Usa le 5 colonne per il retro.",
  "weekly.clear": "Svuota weekly",
  "weekly.confirmClear": "Svuotare tutte le colonne del weekly?",
  "weekly.doneThisWeek": "Recap — Tutto il completato",
  "weekly.noneDone": "Nessuna attività completata.",
  "weekly.add": "Aggiungi…",
  "weekly.recapByOwner": "Per assegnatario",
  "weekly.subtasksDone": "sotto-attività",

  "track.title": "Tracking",
  "track.prompt": "Inserisci la password per il monitoraggio del carico del team.",
  "track.password": "Password",
  "track.enter": "Entra",
  "track.wrong": "Password errata.",
  "track.help": "Tracking: carico di lavoro per membro (task attivi, esclusi DONE).",
  "track.ok": "Ok",
  "track.high": "Carico alto",
  "track.over": "Sovraccarico",
  "track.active": "Attivi",
  "track.inProgress": "In corso",
  "track.waiting": "Waiting",

  "instr.statiPrio": "Stati & Priorità",
  "instr.stati": "Stati",
  "instr.priorita": "Priorità",
  "instr.workflow": "Workflow",
  "instr.wf.board": "trascina le card tra le colonne. Ogni card ha assegnatario, priorità, scadenza e sotto-attività.",
  "instr.wf.weekly": "la sezione FATTO si aggiorna da DONE. Usa le 5 colonne WINS, LEARNINGS, TO IMPROVE, BLOCKERS, FOCUS.",
  "instr.wf.calendar": "trascina un task su una data per impostare la scadenza.",
  "instr.wf.tracking": "protetto da password per il monitoraggio del carico del team.",
  "instr.wf.mail": "genera solo Lavori completati (DONE) + Prossimi step (FOCUS).",
  "instr.collabTitle": "Collaborazione",
  "instr.collab": "La board è condivisa in tempo reale: ogni modifica è salvata sul server e propagata istantaneamente a tutti gli utenti collegati. Nulla è salvato in locale sul browser — solo la lingua e il layout preferito restano su questo dispositivo.",

  "mail.title": "Aggiornamento via mail",
  "mail.completed": "Lavori completati:",
  "mail.nextSteps": "Prossimi step:",
  "mail.none": "(nessuno)",
  "mail.openClient": "Apri client mail",
  "mail.copy": "Copia testo",
  "mail.copied": "Copiato ✓",
  "mail.subject": "aggiornamento",

  "filters.section": "Cerca / Filtra",
  "quick.section": "Nuova attività",
  "team.button": "Team",

  "task.fileDir": "Cartella file",
  "task.fileDirPlaceholder": "Percorso del file di rete condiviso…",
  "task.copy": "Copia",
  "task.copied": "Copiato ✓",

  "settings.branding": "Logo e favicon",
  "settings.logo": "Logo (riquadro rotondo)",
  "settings.favicon": "Favicon (icona scheda)",
  "settings.upload": "Carica",
  "settings.remove": "Rimuovi",
  "settings.logoHint": "PNG, JPG, SVG o WebP. Max {mb} MB.",
  "settings.faviconHint": "PNG, SVG o ICO. Max {mb} MB.",
  "settings.imageTooBig": "Immagine troppo grande.",
  "settings.imageBad": "Formato non supportato.",

  "reflection.title": "Riflessione quotidiana",
  "reflection.me": "Sei",
  "reflection.pickMe": "Seleziona il tuo nome",
  "reflection.done": "Fatto oggi",
  "reflection.well": "Cosa è andato bene",
  "reflection.improve": "Cosa migliorare",
  "reflection.learning": "Note di apprendimento",
  "reflection.save": "Salva riflessione",
  "reflection.saved": "Salvato ✓",
  "reflection.editingToday": "Stai modificando la voce di oggi",
  "reflection.recent": "Riflessioni recenti",
  "reflection.none": "Ancora nessuna riflessione.",
  "reflection.today": "Oggi",

  "review.title": "Ripasso a intervalli",
  "review.hint": "Rivedi gli apprendimenti passati per fissarli meglio (ripetizione dilazionata).",
  "review.none": "Niente da ripassare oggi. Ottimo lavoro!",
  "review.markReviewed": "Segna come ripassato",
  "review.reviewed": "Ripassato ✓",
  "review.random": "Ripasso casuale",
  "review.daysAgo": "{n} giorni fa",
  "review.yesterday": "Ieri",

  "common.close": "Chiudi",
};

const EN: Dict = {
  "app.subtitle": "Getting Things Done · Kanban",
  "app.renameHint": "Double-click to rename",
  "app.mail": "Mail update",
  "app.loadingTitle": "TEAM GTD",
  "app.connecting": "Connecting…",
  "app.connectFailed": "Could not reach the server. Please retry.",

  "conn.connecting": "Connecting…",
  "conn.live": "Live",
  "conn.reconnecting": "Reconnecting…",
  "conn.offline": "Offline",
  "conn.title": "Real-time sync status",

  "tabs.board": "BOARD",
  "tabs.weekly": "WEEKLY",
  "tabs.calendario": "CALENDAR",
  "tabs.reflection": "REFLECTION",
  "tabs.tracking": "TRACKING 🔒",
  "tabs.istruzioni": "INSTRUCTIONS",
  "tabs.settings": "SETTINGS",

  "filters.title": "Filters",
  "filters.search": "Search tasks…",
  "filters.allMembers": "All members",
  "filters.allPriorities": "All priorities",
  "filters.focusP1": "Focus P1",
  "filters.reset": "Reset",
  "view.columns": "Columns",
  "view.columnsHint": "Show or hide columns",
  "view.done": "Done",
  "view.board": "Board",
  "view.list": "List",
  "view.editLayout": "Edit layout",
  "view.editLayoutOn": "Done editing",
  "view.editHint": "Drag the edges to resize columns. Neighbouring columns adjust.",
  "view.resetWidths": "Reset widths",

  "list.task": "Task",
  "list.owner": "Owner",
  "list.priority": "Priority",
  "list.status": "Status",
  "list.due": "Due",
  "list.subtasks": "Subtasks",
  "list.empty": "No tasks in the visible columns.",

  "auth.title": "Team access",
  "auth.prompt": "Enter the shared password to open the board.",
  "auth.password": "Password",
  "auth.enter": "Enter",
  "auth.wrong": "Wrong password.",
  "auth.logout": "Log out",
  "auth.remember": "Access remembered for {days} days on this device.",

  "settings.title": "Settings",
  "settings.subtitleSection": "Header subtitle",
  "settings.subtitleIt": "Subtitle (Italian)",
  "settings.subtitleEn": "Subtitle (English)",
  "settings.access": "Access",
  "settings.accessPassword": "Access password",
  "settings.loginDuration": "Login duration (days)",
  "settings.save": "Save",
  "settings.saved": "Saved ✓",
  "settings.migrationNote": "Saving these settings to the server requires running 'migration-002-settings.sql' on Supabase first.",
  "settings.logoutNow": "Log out this device",

  "cal.selectHint": "Select a task from the calendar to see its details here.",
  "cal.details": "Task details",
  "cal.more": "+{n} more",

  "board.help": "Drag cards between columns or open a card to edit it. No popups: everything expands right here.",
  "quick.title": "New task…",
  "quick.add": "Add",
  "quick.owner": "Owner",
  "quick.priority": "Priority",
  "quick.status": "Status",
  "quick.due": "Due date",
  "quick.newTaskIn": "New task in",

  "col.empty": "No tasks",
  "col.emptyDone": "No completed tasks",
  "col.collapse": "Collapse column",
  "col.expand": "Expand column",

  "task.due": "Due",
  "task.overdue": "overdue",
  "task.waiting": "waiting",
  "task.days": "d",
  "task.subtasks": "Subtasks",
  "task.addSubtask": "Add subtask…",
  "task.add": "Add",
  "task.notes": "Notes",
  "task.notesPlaceholder": "Add a note…",
  "task.description": "Description",
  "task.descPlaceholder": "Add a description…",
  "task.delete": "Delete",
  "task.confirmDelete": "Delete?",
  "task.yes": "Yes",
  "task.no": "No",
  "task.prev": "Previous status",
  "task.next": "Next status",
  "task.expand": "Open details",
  "task.collapse": "Close details",

  "members.team": "Team",
  "members.add": "Member",
  "members.newName": "New member name",
  "members.remove": "Remove",
  "members.unassigned": "Unassigned",

  "prio.distribution": "Priority distribution",
  "prio.P1short": "Urgent",
  "prio.P2short": "High",
  "prio.P3short": "Medium",
  "prio.P4short": "Low",
  "prio.P1desc": "Focus P1 shows only P1.",
  "prio.P2desc": "Standard high priority.",
  "prio.P3desc": "To be planned.",
  "prio.P4desc": "Nice-to-have.",

  "status.BACKLOG.help": "Non-priority ideas",
  "status.NEXT.help": "To do soon",
  "status.IN PROGRESS.help": "In progress now",
  "status.WAITING.help": "Waiting on others, counts days",
  "status.DONE.help": "Completed • feeds the weekly",
  "status.MAYBE.help": "Maybe later",

  "cal.help": "Calendar: drag a task onto a date to set its due date.",
  "cal.noDue": "No due date",
  "cal.allHaveDate": "All tasks have a date.",

  "weekly.help": "Weekly Review: the DONE section fills from DONE tasks. Use the 5 columns for the retro.",
  "weekly.clear": "Clear weekly",
  "weekly.confirmClear": "Clear every weekly column?",
  "weekly.doneThisWeek": "Recap — Everything completed",
  "weekly.noneDone": "No completed tasks.",
  "weekly.add": "Add…",
  "weekly.recapByOwner": "By owner",
  "weekly.subtasksDone": "subtasks",

  "track.title": "Tracking",
  "track.prompt": "Enter the password to view team workload monitoring.",
  "track.password": "Password",
  "track.enter": "Enter",
  "track.wrong": "Wrong password.",
  "track.help": "Tracking: workload per member (active tasks, DONE excluded).",
  "track.ok": "OK",
  "track.high": "High load",
  "track.over": "Overloaded",
  "track.active": "Active",
  "track.inProgress": "In progress",
  "track.waiting": "Waiting",

  "instr.statiPrio": "Statuses & Priorities",
  "instr.stati": "Statuses",
  "instr.priorita": "Priorities",
  "instr.workflow": "Workflow",
  "instr.wf.board": "drag cards between columns. Each card has owner, priority, due date and subtasks.",
  "instr.wf.weekly": "the DONE section fills from DONE. Use the 5 columns WINS, LEARNINGS, TO IMPROVE, BLOCKERS, FOCUS.",
  "instr.wf.calendar": "drag a task onto a date to set its due date.",
  "instr.wf.tracking": "password-protected team workload monitoring.",
  "instr.wf.mail": "generates only Completed work (DONE) + Next steps (FOCUS).",
  "instr.collabTitle": "Collaboration",
  "instr.collab": "The board is shared in real time: every change is saved on the server and pushed instantly to everyone connected. Nothing is saved locally in the browser — only your language and preferred layout stay on this device.",

  "mail.title": "Mail update",
  "mail.completed": "Completed work:",
  "mail.nextSteps": "Next steps:",
  "mail.none": "(none)",
  "mail.openClient": "Open mail client",
  "mail.copy": "Copy text",
  "mail.copied": "Copied ✓",
  "mail.subject": "update",

  "filters.section": "Search / Filter",
  "quick.section": "New task",
  "team.button": "Team",

  "task.fileDir": "File Directory",
  "task.fileDirPlaceholder": "Shared network file path…",
  "task.copy": "Copy",
  "task.copied": "Copied ✓",

  "settings.branding": "Logo & favicon",
  "settings.logo": "Logo (round box)",
  "settings.favicon": "Favicon (tab icon)",
  "settings.upload": "Upload",
  "settings.remove": "Remove",
  "settings.logoHint": "PNG, JPG, SVG or WebP. Max {mb} MB.",
  "settings.faviconHint": "PNG, SVG or ICO. Max {mb} MB.",
  "settings.imageTooBig": "Image too large.",
  "settings.imageBad": "Unsupported format.",

  "reflection.title": "Daily Reflection",
  "reflection.me": "You are",
  "reflection.pickMe": "Select your name",
  "reflection.done": "Done today",
  "reflection.well": "What went well",
  "reflection.improve": "What to improve",
  "reflection.learning": "Learning notes",
  "reflection.save": "Save reflection",
  "reflection.saved": "Saved ✓",
  "reflection.editingToday": "You are editing today's entry",
  "reflection.recent": "Recent reflections",
  "reflection.none": "No reflections yet.",
  "reflection.today": "Today",

  "review.title": "Spaced review",
  "review.hint": "Revisit past learnings to retain them better (spaced repetition).",
  "review.none": "Nothing to review today. Nice work!",
  "review.markReviewed": "Mark as reviewed",
  "review.reviewed": "Reviewed ✓",
  "review.random": "Random review",
  "review.daysAgo": "{n} days ago",
  "review.yesterday": "Yesterday",

  "common.close": "Close",
};

const DICTS: Record<Lang, Dict> = { it: IT, en: EN };

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    readPref("lang") === "en" ? "en" : "it"
  );

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writePref("lang", l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
        }
      }
      return s;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useT must be used within LangProvider");
  return c;
}

// Localized labels for statuses / priorities / owners.
export function statusLabel(_lang: Lang, s: Status): string {
  // Column names stay canonical (English) in both languages — they are the
  // shared vocabulary of the board.
  const map: Record<Status, string> = {
    BACKLOG: "Backlog",
    NEXT: "Next",
    "IN PROGRESS": "In Progress",
    WAITING: "Waiting",
    DONE: "Done",
    MAYBE: "Maybe",
  };
  return map[s];
}

export function priorityLabel(
  t: (k: string) => string,
  p: Priority
): string {
  return `${p} • ${t(`prio.${p}short`)}`;
}

export function ownerLabel(t: (k: string) => string, owner: string): string {
  return owner === "Unassigned" ? t("members.unassigned") : owner;
}

const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthName(lang: Lang, i: number): string {
  return (lang === "it" ? MONTHS_IT : MONTHS_EN)[i];
}
export function weekdayNames(lang: Lang): string[] {
  return lang === "it" ? WEEKDAYS_IT : WEEKDAYS_EN;
}
export function localeCode(lang: Lang): string {
  return lang === "it" ? "it-IT" : "en-GB";
}
