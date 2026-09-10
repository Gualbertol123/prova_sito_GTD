// Shared domain types for the TEAM GTD board.
// These mirror the shape stored in Cosmos DB and broadcast over Web PubSub.

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
  updatedAt: number;
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

// The single board document — the entire shared state lives here.
export interface Board {
  id: "board";
  boardName: string;
  members: string[];
  tasks: Task[];
  weekly: Weekly;
  updatedAt: number;
  rev: number; // monotonically increasing revision, bumped on every write
}

// Operations the client sends to the API. The server applies them
// authoritatively against the current board (with optimistic-concurrency
// retries) so that concurrent edits from different users merge cleanly.
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
  | { type: "weeklyAdd"; column: keyof Weekly; item: WeeklyItem }
  | { type: "weeklyUpdate"; column: keyof Weekly; id: string; text: string }
  | { type: "weeklyDelete"; column: keyof Weekly; id: string }
  | { type: "weeklyClear" };
