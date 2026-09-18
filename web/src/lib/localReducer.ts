import type { Board, Op, Task } from "./types";

// Optimistic, in-memory only. Applies an op to the current board so the UI
// updates instantly; the authoritative state is then reloaded from Supabase
// when the realtime event for this change arrives.
export function applyOpLocal(board: Board, op: Op): Board {
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
    reflections: [...(board.reflections ?? [])],
    projects: [...(board.projects ?? [])],
    suggestions: [...(board.suggestions ?? [])],
    reflectionPasswords: { ...(board.reflectionPasswords ?? {}) },
    updatedAt: now,
  };

  const find = (id: string): Task | undefined => b.tasks.find((t) => t.id === id);

  switch (op.type) {
    case "addTask":
      b.tasks = [
        ...b.tasks,
        {
          ...op.task,
          createdAt: op.task.createdAt ?? now,
          doneAt: op.task.status === "DONE" ? op.task.doneAt ?? now : op.task.doneAt,
        },
      ];
      break;
    case "updateTask": {
      const t = find(op.id);
      if (t) Object.assign(t, op.patch, { updatedAt: now });
      break;
    }
    case "deleteTask":
      b.tasks = b.tasks.filter((t) => t.id !== op.id);
      break;
    case "moveTask": {
      const t = find(op.id);
      if (t) {
        t.status = op.status;
        t.updatedAt = now;
        if (op.status === "WAITING" && !t.waitingSince) {
          t.waitingSince = new Date().toISOString().slice(0, 10);
        } else if (op.status !== "WAITING") {
          delete t.waitingSince;
        }
        if (op.status === "DONE") {
          if (!t.doneAt) t.doneAt = now;
        } else {
          delete t.doneAt;
        }
      }
      break;
    }
    case "setDueDate": {
      const t = find(op.id);
      if (t) {
        if (op.dueDate) t.dueDate = op.dueDate;
        else delete t.dueDate;
        t.updatedAt = now;
      }
      break;
    }
    case "addSubtask": {
      const t = find(op.taskId);
      if (t) t.subtasks = [...t.subtasks, op.subtask];
      break;
    }
    case "updateSubtask": {
      const t = find(op.taskId);
      if (t)
        t.subtasks = t.subtasks.map((s) =>
          s.id === op.subtaskId ? { ...s, ...op.patch } : s
        );
      break;
    }
    case "deleteSubtask": {
      const t = find(op.taskId);
      if (t) t.subtasks = t.subtasks.filter((s) => s.id !== op.subtaskId);
      break;
    }
    case "setMembers":
      b.members = op.members;
      break;
    case "renameBoard":
      b.boardName = op.name;
      break;
    case "setSubtitle":
      if (op.lang === "it") b.subtitleIt = op.text;
      else b.subtitleEn = op.text;
      break;
    case "setAccess":
      if (op.password !== undefined) b.accessPassword = op.password;
      if (op.loginDays !== undefined) b.loginDays = op.loginDays;
      break;
    case "setBranding":
      if (op.logoUrl !== undefined) b.logoUrl = op.logoUrl ?? undefined;
      if (op.faviconUrl !== undefined) b.faviconUrl = op.faviconUrl ?? undefined;
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
    case "reflectionSave": {
      const i = b.reflections.findIndex((r) => r.id === op.reflection.id);
      if (i >= 0) b.reflections[i] = op.reflection;
      else b.reflections = [op.reflection, ...b.reflections];
      break;
    }
    case "reflectionDelete":
      b.reflections = b.reflections.filter((r) => r.id !== op.id);
      break;
    case "projectAdd":
      b.projects = [...b.projects, op.project];
      break;
    case "projectUpdate":
      b.projects = b.projects.map((p) =>
        p.id === op.id ? { ...p, ...op.patch, updatedAt: now } : p
      );
      break;
    case "projectDelete":
      b.projects = b.projects.filter((p) => p.id !== op.id);
      break;
    case "suggestionAdd":
      b.suggestions = [op.suggestion, ...b.suggestions];
      break;
    case "suggestionDelete":
      b.suggestions = b.suggestions.filter((s) => s.id !== op.id);
      break;
    case "reflectionPasswordSet":
      b.reflectionPasswords = { ...b.reflectionPasswords, [op.member]: op.password };
      break;
  }

  return b;
}
