import { beforeEach, describe, expect, it, vi } from "vitest";
import { board, task } from "./fixtures";

// A tiny stand-in for the Supabase client: records calls, answers as told.
const calls: { kind: string; args: unknown }[] = [];
let rpcError: { code?: string; message?: string } | null = null;

vi.mock("../supabaseClient", () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      calls.push({ kind: `rpc:${fn}`, args });
      return Promise.resolve({ data: null, error: rpcError });
    },
    from: (table: string) => ({
      update: (row: unknown) => ({
        eq: (_col: string, id: string) => {
          calls.push({ kind: `update:${table}:${id}`, args: row });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  },
}));

const { writeOp, nullsForUndefined } = await import("../db");

beforeEach(() => {
  calls.length = 0;
  rpcError = null;
});

describe("subtask writes", () => {
  const b = board({ tasks: [task("t", { subtasks: [{ id: "s1", text: "a", done: true, doneAt: 5 }] })] });

  it("go through the database function, sending null for removed fields", async () => {
    await writeOp({ type: "updateSubtask", taskId: "t", subtaskId: "s1", patch: { done: false, doneAt: undefined } }, b);
    expect(calls).toEqual([
      { kind: "rpc:subtask_update", args: { p_task: "t", p_id: "s1", p_patch: { done: false, doneAt: null } } },
    ]);
  });

  it("fall back to the whole-array write before migration 017", async () => {
    rpcError = { code: "PGRST202", message: "Could not find the function" };
    await writeOp({ type: "addSubtask", taskId: "t", subtask: { id: "s2", text: "b", done: false } }, b);
    expect(calls.map((c) => c.kind)).toEqual(["rpc:subtask_add", "update:tasks:t"]);
    const row = calls[1].args as { subtasks: { id: string }[] };
    expect(row.subtasks.map((s) => s.id)).toEqual(["s1", "s2"]);

    // Once known to be missing, it is not asked again.
    calls.length = 0;
    await writeOp({ type: "deleteSubtask", taskId: "t", subtaskId: "s1" }, b);
    expect(calls.map((c) => c.kind)).toEqual(["update:tasks:t"]);
  });
});

describe("nullsForUndefined", () => {
  it("turns undefined into null and keeps everything else", () => {
    expect(nullsForUndefined({ a: undefined, b: 0, c: false, d: "x" })).toEqual({ a: null, b: 0, c: false, d: "x" });
  });
});
