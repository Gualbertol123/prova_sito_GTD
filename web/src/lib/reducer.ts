import type { Board, Op, Task } from "./types";

// Pure board reducer. Used on the client for instant optimistic updates.
// The Azure Function keeps an authoritative copy of this exact logic
// (api/src/shared/board.js) — keep the two in sync.
export function applyOp(board: Board, op: Op): Board {
  const now = Date.now();
  const b: Board = {
    ...board,
    tasks: board.tasks.map((t) => ({ ...t, subtasks: [...t.subtasks] })),
    weekly: {
      well: [...board.weekly.well],
      learnings: [...board.weekly.learnings],
      improve: [...board.weekly.improve],
      blockers: [...board.weekly.blockers],
      focus: [...board.weekly.focus],
    },
    members: [...board.members],
    updatedAt: now,
    rev: board.rev + 1,
  };

  const findTask = (id: string): Task | undefined => b.tasks.find((t) => t.id === id);

  switch (op.type) {
    case "addTask":
      b.tasks = [{ ...op.task, updatedAt: now }, ...b.tasks];
      break;
    case "updateTask": {
      const t = findTask(op.id);
      if (t) Object.assign(t, op.patch, { updatedAt: now });
      break;
    }
    case "deleteTask":
      b.tasks = b.tasks.filter((t) => t.id !== op.id);
      break;
    case "moveTask": {
      const t = findTask(op.id);
      if (t) {
        t.status = op.status;
        t.updatedAt = now;
        // Entering WAITING stamps the waiting start; leaving clears it.
        if (op.status === "WAITING" && !t.waitingSince) {
          t.waitingSince = new Date().toISOString().slice(0, 10);
        } else if (op.status !== "WAITING") {
          delete t.waitingSince;
        }
      }
      break;
    }
    case "setDueDate": {
      const t = findTask(op.id);
      if (t) {
        if (op.dueDate) t.dueDate = op.dueDate;
        else delete t.dueDate;
        t.updatedAt = now;
      }
      break;
    }
    case "addSubtask": {
      const t = findTask(op.taskId);
      if (t) t.subtasks = [...t.subtasks, op.subtask];
      break;
    }
    case "updateSubtask": {
      const t = findTask(op.taskId);
      if (t)
        t.subtasks = t.subtasks.map((s) =>
          s.id === op.subtaskId ? { ...s, ...op.patch } : s
        );
      break;
    }
    case "deleteSubtask": {
      const t = findTask(op.taskId);
      if (t) t.subtasks = t.subtasks.filter((s) => s.id !== op.subtaskId);
      break;
    }
    case "setMembers":
      b.members = op.members;
      break;
    case "renameBoard":
      b.boardName = op.name;
      break;
    case "weeklyAdd":
      b.weekly[op.column] = [...b.weekly[op.column], op.item];
      break;
    case "weeklyUpdate":
      b.weekly[op.column] = b.weekly[op.column].map((i) =>
        i.id === op.id ? { ...i, text: op.text } : i
      );
      break;
    case "weeklyDelete":
      b.weekly[op.column] = b.weekly[op.column].filter((i) => i.id !== op.id);
      break;
    case "weeklyClear":
      b.weekly = { well: [], learnings: [], improve: [], blockers: [], focus: [] };
      break;
  }

  return b;
}
