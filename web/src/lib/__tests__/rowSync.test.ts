import { describe, expect, it } from "vitest";
import { applyRowChange } from "../rowSync";
import { board, project, task } from "./fixtures";

describe("applyRowChange", () => {
  it("replaces a changed task in place", () => {
    const b = board({ tasks: [task("a"), task("b")] });
    const next = applyRowChange(b, { table: "tasks", id: "a", row: task("a", { title: "new" }) });
    expect(next.tasks.map((t) => t.title)).toEqual(["new", "Task b"]);
  });

  it("inserts a new task in createdAt order", () => {
    const b = board({ tasks: [task("a", { createdAt: 10 }), task("c", { createdAt: 30 })] });
    const next = applyRowChange(b, { table: "tasks", id: "b", row: task("b", { createdAt: 20 }) });
    expect(next.tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("removes a deleted task, and ignores deleting one it does not have", () => {
    const b = board({ tasks: [task("a"), task("b")] });
    expect(applyRowChange(b, { table: "tasks", id: "a", row: null }).tasks.map((t) => t.id)).toEqual(["b"]);
    expect(applyRowChange(b, { table: "tasks", id: "zz", row: null }).tasks).toBe(b.tasks);
  });

  it("updates projects the same way", () => {
    const b = board({ projects: [project("p")] });
    const next = applyRowChange(b, { table: "projects", id: "p", row: project("p", { name: "Renamed" }) });
    expect(next.projects[0].name).toBe("Renamed");
  });

  it("adds, edits and deletes weekly items in their bucket", () => {
    let b = board();
    b = applyRowChange(b, { table: "weekly", id: "w", row: { bucket: "well", item: { id: "w", text: "one" } } });
    b = applyRowChange(b, { table: "weekly", id: "w", row: { bucket: "well", item: { id: "w", text: "two" } } });
    expect(b.weekly.well).toEqual([{ id: "w", text: "two" }]);
    b = applyRowChange(b, { table: "weekly", id: "w", row: null });
    expect(b.weekly.well).toEqual([]);
  });

  it("merges board settings", () => {
    const b = board();
    const next = applyRowChange(b, { table: "board_meta", meta: { boardName: "New", members: ["X"] } });
    expect(next.boardName).toBe("New");
    expect(next.members).toEqual(["X"]);
    expect(next.tasks).toBe(b.tasks);
  });
});
