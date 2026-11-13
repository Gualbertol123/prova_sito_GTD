import { describe, expect, it } from "vitest";
import { applyOpLocal, reorderByIds } from "../localReducer";
import { board, task } from "./fixtures";

describe("applyOpLocal", () => {
  it("stamps doneAt on entering DONE and clears it on leaving", () => {
    let b = board({ tasks: [task("a")] });
    b = applyOpLocal(b, { type: "moveTask", id: "a", status: "DONE" });
    expect(b.tasks[0].doneAt).toBeTypeOf("number");
    b = applyOpLocal(b, { type: "moveTask", id: "a", status: "NEXT" });
    expect(b.tasks[0].doneAt).toBeUndefined();
  });

  it("keeps the original waitingSince while WAITING, clears it after", () => {
    let b = board({ tasks: [task("a", { status: "WAITING", waitingSince: "2026-01-02" })] });
    b = applyOpLocal(b, { type: "moveTask", id: "a", status: "WAITING" });
    expect(b.tasks[0].waitingSince).toBe("2026-01-02");
    b = applyOpLocal(b, { type: "moveTask", id: "a", status: "NEXT" });
    expect(b.tasks[0].waitingSince).toBeUndefined();
  });

  it("does not mutate the board it was given", () => {
    const b = board({ tasks: [task("a")] });
    applyOpLocal(b, { type: "addSubtask", taskId: "a", subtask: { id: "s", text: "x", done: false } });
    expect(b.tasks[0].subtasks).toEqual([]);
  });

  it("adds, updates, reorders and deletes subtasks", () => {
    let b = board({ tasks: [task("a")] });
    for (const id of ["1", "2", "3"])
      b = applyOpLocal(b, { type: "addSubtask", taskId: "a", subtask: { id, text: id, done: false } });
    b = applyOpLocal(b, { type: "updateSubtask", taskId: "a", subtaskId: "2", patch: { done: true } });
    b = applyOpLocal(b, { type: "reorderSubtasks", taskId: "a", ids: ["3", "1", "2"] });
    expect(b.tasks[0].subtasks.map((s) => s.id)).toEqual(["3", "1", "2"]);
    expect(b.tasks[0].subtasks[2].done).toBe(true);
    b = applyOpLocal(b, { type: "deleteSubtask", taskId: "a", subtaskId: "1" });
    expect(b.tasks[0].subtasks.map((s) => s.id)).toEqual(["3", "2"]);
  });
});

describe("reorderByIds", () => {
  it("keeps items the order does not mention at the end, in their order", () => {
    const items = ["a", "b", "new1", "c", "new2"].map((id) => ({ id }));
    expect(reorderByIds(items, ["c", "a", "b"]).map((x) => x.id)).toEqual(["c", "a", "b", "new1", "new2"]);
  });

  it("ignores ids that no longer exist", () => {
    expect(reorderByIds([{ id: "a" }, { id: "b" }], ["gone", "b", "a"]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
