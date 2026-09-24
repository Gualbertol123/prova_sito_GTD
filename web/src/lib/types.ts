// Shared domain types for the TEAM GTD board.
// These mirror the rows stored in Supabase and streamed live via Postgres realtime.

export type Status =
  | "BACKLOG"
  | "NEXT"
  | "IN PROGRESS"
  | "WAITING"
  | "DONE"
  | "MAYBE";

export type Priority = "P1" | "P2" | "P3" | "P4";

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  doneAt?: number; // set when ticked, cleared when unticked — drives the weekly report
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  owner: string; // member name or "Unassigned"
  priority: Priority;
  status: Status;
  notes: string;
  subtasks: Subtask[];
  dueDate?: string; // ISO yyyy-mm-dd
  waitingSince?: string; // ISO yyyy-mm-dd
  fileDir?: string; // shared network file path
  doneAt?: number; // set when it enters DONE; drives auto-archiving
  updatedAt: number;
  createdAt?: number; // ordering within a column (oldest first)
}

export interface WeeklyItem {
  id: string;
  text: string;
}

export interface Weekly {
  well: WeeklyItem[]; // WINS
  learnings: WeeklyItem[];
  improve: WeeklyItem[]; // TO IMPROVE
  blockers: WeeklyItem[];
  focus: WeeklyItem[]; // FOCUS NEXT WEEK
}

// One team member's reflection for a given day (one per member per day).
export interface Reflection {
  id: string; // "<date>::<member>"
  member: string;
  date: string; // yyyy-mm-dd
  done: string; // Done today
  well: string; // What went well
  improve: string; // What to improve
  learning: string; // Learning notes
  updatedAt?: number;
  createdAt?: number;
}

// A project — simply a named checklist of items (same shape as subtasks).
export interface Project {
  id: string;
  name: string;
  items: Subtask[];
  createdAt?: number;
  updatedAt?: number;
}

// An anonymous suggestion for improving the site. No author is stored anywhere
// — the posting device keeps its own ids locally so it can delete them again.
export interface Suggestion {
  id: string;
  body: string;
  createdAt: number;
}

// The assembled board — the entire shared state, rebuilt from the Supabase
// tables (board_meta + tasks + weekly + reflections + projects + suggestions)
// and kept live.
export interface Board {
  id: "board";
  boardName: string;
  members: string[];
  tasks: Task[];
  weekly: Weekly;
  reflections: Reflection[];
  projects: Project[];
  suggestions: Suggestion[];
  /** Set when the suggestions read failed, so the IDEAS tab can say why. */
  suggestionsError?: string;
  reflectionPasswords: Record<string, string>; // member -> password (soft gate)
  updatedAt: number;
  rev?: number; // optional; not used by the Supabase backend
  // Editable settings (nullable until the settings migration is applied).
  subtitleIt?: string;
  subtitleEn?: string;
  accessPassword?: string;
  loginDays?: number;
  logoUrl?: string;
  faviconUrl?: string;
}

// Operations the UI dispatches. The data layer translates each into the
// corresponding Supabase write; realtime propagates the result to everyone.
export type Op =
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "deleteTask"; id: string }
  | { type: "moveTask"; id: string; status: Status }
  | { type: "setDueDate"; id: string; dueDate?: string }
  | { type: "addSubtask"; taskId: string; subtask: Subtask }
  | { type: "updateSubtask"; taskId: string; subtaskId: string; patch: Partial<Subtask> }
  | { type: "deleteSubtask"; taskId: string; subtaskId: string }
  | { type: "setMembers"; members: string[] }
  | { type: "renameBoard"; name: string }
  | { type: "setSubtitle"; lang: "it" | "en"; text: string }
  | { type: "setAccess"; password?: string; loginDays?: number }
  | { type: "setBranding"; logoUrl?: string | null; faviconUrl?: string | null }
  | { type: "weeklyAdd"; column: keyof Weekly; item: WeeklyItem }
  | { type: "weeklyUpdate"; column: keyof Weekly; id: string; text: string }
  | { type: "weeklyDelete"; column: keyof Weekly; id: string }
  | { type: "weeklyClear" }
  | { type: "reflectionSave"; reflection: Reflection }
  | { type: "reflectionDelete"; id: string }
  | { type: "projectAdd"; project: Project }
  | { type: "projectUpdate"; id: string; patch: Partial<Project> }
  | { type: "projectDelete"; id: string }
  | { type: "reflectionPasswordSet"; member: string; password: string }
  | { type: "suggestionAdd"; suggestion: Suggestion }
  | { type: "suggestionDelete"; id: string };
