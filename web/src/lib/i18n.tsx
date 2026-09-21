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
  "tabs.report": "REPORT",
  "tabs.projects": "PROGETTI",
  "tabs.calendario": "CALENDARIO",
  "tabs.reflection": "RIFLESSIONE",
  "tabs.tracking": "TRACKING 🔒",
  "tabs.suggestions": "IDEE",
  "tabs.settings": "IMPOSTAZIONI",

  "filters.title": "Filtri",
  "filters.search": "Cerca attività…",
  "filters.allMembers": "Tutti i membri",
  "filters.allPriorities": "Tutte le priorità",
  "filters.focusP1": "Focus P1",
  "filters.reset": "Reset",
  "view.columns": "Colonne",
  "view.columnsHint": "Mostra o nascondi le colonne",
  "view.names": "Nomi",
  "view.namesHint": "Nascondi i nomi dei referenti sulla bacheca (utile per uno screenshot). Tornano visibili al ricaricamento.",
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
  "archived.title": "Archiviate",
  "archived.hint": "Completate da più di una settimana.",
  "archived.none": "Niente in archivio.",
  "archived.search": "Cerca in archivio…",
  "doneBar.title": "Fatte",
  "doneBar.hint": "Completate in questa settimana.",
  "doneBar.none": "Niente completato in questa settimana.",
  "doneBar.search": "Cerca tra le fatte…",

  "task.due": "Scadenza",
  "task.overdue": "in ritardo",
  "task.waiting": "in attesa",
  "task.days": "gg",
  "task.subtasks": "Sotto-attività",
  "task.addSubtask": "Aggiungi sotto-attività…",
  "task.subtaskEditHint": "Clicca per modificare · Invio per salvare · Esc per annullare",
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

  "report.title": "Report settimanale (Word)",
  "report.hint": "Modello Intesa Sanpaolo. Genera, correggi tutto nell’editor e scarica in Word o PDF.",
  "report.generate": "Genera e modifica",
  "report.downloadDirect": "Scarica senza modificare",
  "report.downloadWord": "Scarica Word (.docx)",
  "report.downloadPdf": "Scarica PDF",
  "report.pdfHint": "Si apre la stampa del browser: scegli «Salva come PDF», margini «Nessuno» e togli «Intestazioni e piè di pagina».",
  "report.close": "Chiudi editor",
  "report.buildingEditor": "Preparazione del report e dell’editor…",
  "report.period": "Periodo",
  "report.thisWeek": "questa settimana",
  "report.lastWeek": "settimana scorsa",
  "report.custom": "Periodo personalizzato…",
  "report.from": "Dal",
  "report.to": "Al",
  "report.download": "Scarica report",
  "report.generating": "Generazione…",
  "report.preview": "Attività completate: {t} · Sotto-attività completate: {s}",
  "report.empty": "Nessuna attività completata nel periodo — il report includerà comunque Next, Progetti e Planner.",
  "report.error": "Generazione non riuscita",

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


  "mail.title": "Aggiornamento via mail",
  "mail.completed": "Lavori completati:",
  "mail.nextSteps": "Prossimi step:",
  "mail.none": "(nessuno)",
  "mail.openClient": "Apri client mail",
  "mail.copy": "Copia testo",
  "mail.copied": "Copiato ✓",
  "mail.subject": "aggiornamento",

  "sugg.title": "Idee per migliorare il sito",
  "sugg.intro": "Proposte anonime: non viene salvato né il nome né alcun riferimento a chi scrive. Scrivi liberamente cosa cambieresti.",
  "sugg.placeholder": "Cosa miglioreresti? Un'idea alla volta…",
  "sugg.send": "Invia in anonimo",
  "sugg.sent": "Grazie! Idea inviata ✓",
  "sugg.none": "Ancora nessuna idea. Scrivi la prima.",
  "sugg.count": "{n} idee",
  "sugg.count1": "1 idea",
  "sugg.mine": "La tua",
  "sugg.delete": "Elimina",
  "sugg.confirmDelete": "Eliminare questa idea?",
  "sugg.anon": "Anonimo",
  "sugg.privacy": "Nessun nome, nessun indirizzo, nessun orario di login viene registrato. Solo il testo e la data.",
  "sugg.migrationNote": "Le idee richiedono la migrazione 'migration-008-suggestions.sql' su Supabase.",

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

  "reflAuth.title": "Riflessioni personali",
  "reflAuth.prompt": "Scegli il tuo nome e inserisci la tua password.",
  "reflAuth.user": "Utente",
  "reflAuth.password": "Password",
  "reflAuth.enter": "Entra",
  "reflAuth.wrong": "Password errata.",
  "reflAuth.hint": "Password iniziale per tutti: «password».",
  "reflAuth.remember": "Ricorda su questo dispositivo per",
  "reflAuth.d1": "1 giorno",
  "reflAuth.d7": "1 settimana",
  "reflAuth.d30": "1 mese",
  "reflAuth.d365": "1 anno",
  "reflAuth.never": "Per sempre",
  "reflAuth.logout": "Esci",
  "reflAuth.you": "Sei",
  "reflAuth.account": "La tua password",
  "reflAuth.show": "Mostra",
  "reflAuth.hide": "Nascondi",
  "reflAuth.newPassword": "Nuova password",
  "reflAuth.changed": "Password aggiornata ✓",

  "projects.title": "Progetti",
  "projects.new": "Nuovo progetto",
  "projects.newName": "Nome del progetto",
  "projects.none": "Nessun progetto. Creane uno.",
  "projects.empty": "Seleziona o crea un progetto.",
  "projects.rename": "Rinomina",
  "projects.delete": "Elimina progetto",
  "projects.confirmDelete": "Eliminare questo progetto?",
  "projects.addItem": "Aggiungi voce…",
  "projects.items": "Voci",

  "track.reflections": "Riflessioni del team",
  "track.reflAll": "Tutti",
  "track.reflNone": "Nessuna riflessione registrata.",
  "track.reflEmptyMember": "Nessuna riflessione per questo membro.",

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
  "tabs.report": "REPORT",
  "tabs.projects": "PROJECTS",
  "tabs.calendario": "CALENDAR",
  "tabs.reflection": "REFLECTION",
  "tabs.tracking": "TRACKING 🔒",
  "tabs.suggestions": "IDEAS",
  "tabs.settings": "SETTINGS",

  "filters.title": "Filters",
  "filters.search": "Search tasks…",
  "filters.allMembers": "All members",
  "filters.allPriorities": "All priorities",
  "filters.focusP1": "Focus P1",
  "filters.reset": "Reset",
  "view.columns": "Columns",
  "view.columnsHint": "Show or hide columns",
  "view.names": "Names",
  "view.namesHint": "Hide owner names on the board (handy for a screenshot). They come back on reload.",
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
  "archived.title": "Archived",
  "archived.hint": "Completed more than a week ago.",
  "archived.none": "Nothing archived.",
  "archived.search": "Search the archive…",
  "doneBar.title": "Done",
  "doneBar.hint": "Completed this week.",
  "doneBar.none": "Nothing completed this week.",
  "doneBar.search": "Search done…",

  "task.due": "Due",
  "task.overdue": "overdue",
  "task.waiting": "waiting",
  "task.days": "d",
  "task.subtasks": "Subtasks",
  "task.addSubtask": "Add subtask…",
  "task.subtaskEditHint": "Click to edit · Enter to save · Esc to cancel",
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

  "report.title": "Weekly report (Word)",
  "report.hint": "Intesa Sanpaolo template. Generate, fix anything in the editor, then download Word or PDF.",
  "report.generate": "Generate and edit",
  "report.downloadDirect": "Download without editing",
  "report.downloadWord": "Download Word (.docx)",
  "report.downloadPdf": "Download PDF",
  "report.pdfHint": "Opens the browser print dialog: pick “Save as PDF”, set Margins to “None” and untick “Headers and footers”.",
  "report.close": "Close editor",
  "report.buildingEditor": "Preparing the report and the editor…",
  "report.period": "Period",
  "report.thisWeek": "this week",
  "report.lastWeek": "last week",
  "report.custom": "Custom period…",
  "report.from": "From",
  "report.to": "To",
  "report.download": "Download report",
  "report.generating": "Generating…",
  "report.preview": "Tasks completed: {t} · Subtasks completed: {s}",
  "report.empty": "Nothing was completed in the period — the report still includes Next, Projects and the Planner.",
  "report.error": "Generation failed",

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


  "mail.title": "Mail update",
  "mail.completed": "Completed work:",
  "mail.nextSteps": "Next steps:",
  "mail.none": "(none)",
  "mail.openClient": "Open mail client",
  "mail.copy": "Copy text",
  "mail.copied": "Copied ✓",
  "mail.subject": "update",

  "sugg.title": "Ideas to improve the site",
  "sugg.intro": "Anonymous suggestions: no name and no reference to the author is ever stored. Say freely what you would change.",
  "sugg.placeholder": "What would you improve? One idea at a time…",
  "sugg.send": "Send anonymously",
  "sugg.sent": "Thanks! Idea sent ✓",
  "sugg.none": "No ideas yet. Write the first one.",
  "sugg.count": "{n} ideas",
  "sugg.count1": "1 idea",
  "sugg.mine": "Yours",
  "sugg.delete": "Delete",
  "sugg.confirmDelete": "Delete this idea?",
  "sugg.anon": "Anonymous",
  "sugg.privacy": "No name, no address, no login time is recorded. Only the text and the date.",
  "sugg.migrationNote": "Ideas require the 'migration-008-suggestions.sql' migration on Supabase.",

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

  "reflAuth.title": "Personal reflections",
  "reflAuth.prompt": "Choose your name and enter your password.",
  "reflAuth.user": "User",
  "reflAuth.password": "Password",
  "reflAuth.enter": "Enter",
  "reflAuth.wrong": "Wrong password.",
  "reflAuth.hint": "Initial password for everyone: “password”.",
  "reflAuth.remember": "Remember on this device for",
  "reflAuth.d1": "1 day",
  "reflAuth.d7": "1 week",
  "reflAuth.d30": "1 month",
  "reflAuth.d365": "1 year",
  "reflAuth.never": "Forever",
  "reflAuth.logout": "Log out",
  "reflAuth.you": "You are",
  "reflAuth.account": "Your password",
  "reflAuth.show": "Show",
  "reflAuth.hide": "Hide",
  "reflAuth.newPassword": "New password",
  "reflAuth.changed": "Password updated ✓",

  "projects.title": "Projects",
  "projects.new": "New project",
  "projects.newName": "Project name",
  "projects.none": "No projects yet. Create one.",
  "projects.empty": "Select or create a project.",
  "projects.rename": "Rename",
  "projects.delete": "Delete project",
  "projects.confirmDelete": "Delete this project?",
  "projects.addItem": "Add item…",
  "projects.items": "Items",

  "track.reflections": "Team reflections",
  "track.reflAll": "All",
  "track.reflNone": "No reflections logged yet.",
  "track.reflEmptyMember": "No reflections for this member.",

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
