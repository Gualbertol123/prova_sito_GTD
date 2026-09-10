"use strict";

// Authoritative board reducer. Must stay in sync with the client copy at
// web/src/lib/reducer.ts — same operations, same semantics.
function applyOp(board, op) {
  const now = Date.now();
  const b = {
    ...board,
    tasks: board.tasks.map((t) => ({ ...t, subtasks: [...(t.subtasks || [])] })),
    weekly: {
      well: [...(board.weekly.well || [])],
      learnings: [...(board.weekly.learnings || [])],
      improve: [...(board.weekly.improve || [])],
      blockers: [...(board.weekly.blockers || [])],
      focus: [...(board.weekly.focus || [])],
    },
    members: [...board.members],
    updatedAt: now,
    rev: (board.rev || 0) + 1,
  };

  const find = (id) => b.tasks.find((t) => t.id === id);

  switch (op.type) {
    case "addTask":
      b.tasks = [{ ...op.task, updatedAt: now }, ...b.tasks];
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
      b.boardName = String(op.name || "").slice(0, 80) || b.boardName;
      break;
    case "weeklyAdd":
      if (b.weekly[op.column]) b.weekly[op.column] = [...b.weekly[op.column], op.item];
      break;
    case "weeklyUpdate":
      if (b.weekly[op.column])
        b.weekly[op.column] = b.weekly[op.column].map((i) =>
          i.id === op.id ? { ...i, text: op.text } : i
        );
      break;
    case "weeklyDelete":
      if (b.weekly[op.column])
        b.weekly[op.column] = b.weekly[op.column].filter((i) => i.id !== op.id);
      break;
    case "weeklyClear":
      b.weekly = { well: [], learnings: [], improve: [], blockers: [], focus: [] };
      break;
    default:
      throw new Error(`Unknown op: ${op && op.type}`);
  }

  return b;
}

const KNOWN_OPS = new Set([
  "addTask",
  "updateTask",
  "deleteTask",
  "moveTask",
  "setDueDate",
  "addSubtask",
  "updateSubtask",
  "deleteSubtask",
  "setMembers",
  "renameBoard",
  "weeklyAdd",
  "weeklyUpdate",
  "weeklyDelete",
  "weeklyClear",
]);

function isValidOp(op) {
  return !!op && typeof op.type === "string" && KNOWN_OPS.has(op.type);
}

module.exports = { applyOp, isValidOp };
