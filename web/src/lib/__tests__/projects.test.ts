import { describe, expect, it } from "vitest";
import { boardTasks, hiddenFromBoard, orderedProjectTasks, projectStats, stepOf } from "../projects";
import { project, task } from "./fixtures";

const p = (mode: "all" | "sequential" | "none", order: string[] = []) =>
  project("p", { boardMode: mode, taskOrder: order });

describe("project task order", () => {
  it("puts ordered tasks first, then the rest oldest first", () => {
    const tasks = [
      task("x", { projectId: "p", createdAt: 3 }),
      task("y", { projectId: "p", createdAt: 1 }),
      task("z", { projectId: "p", createdAt: 2 }),
      task("other", { createdAt: 0 }),
    ];
    expect(orderedProjectTasks(p("sequential", ["x"]), tasks).map((t) => t.id)).toEqual(["x", "y", "z"]);
  });
});

describe("which tasks reach the board", () => {
  const tasks = [
    task("1", { projectId: "p", createdAt: 1, status: "DONE" }),
    task("2", { projectId: "p", createdAt: 2 }),
    task("3", { projectId: "p", createdAt: 3 }),
    task("free"),
  ];

  it("all: hides nothing", () => {
    expect(hiddenFromBoard([p("all")], tasks).size).toBe(0);
  });

  it("sequential: only the first open step (and finished ones) show", () => {
    expect([...hiddenFromBoard([p("sequential")], tasks)]).toEqual(["3"]);
    expect(boardTasks({ projects: [p("sequential")], tasks }).map((t) => t.id)).toEqual(["1", "2", "free"]);
    expect(stepOf(tasks[1], [p("sequential")], tasks)).toEqual({ n: 2, total: 3 });
  });

  it("none: keeps every project task off the board", () => {
    expect(boardTasks({ projects: [p("none")], tasks }).map((t) => t.id)).toEqual(["free"]);
  });
});

describe("projectStats", () => {
  it("is ongoing with no tasks, and completed when every task is DONE", () => {
    expect(projectStats(p("all"), []).status).toBe("ongoing");
    const done = [
      task("1", { projectId: "p", status: "DONE", doneAt: 100 }),
      task("2", { projectId: "p", status: "DONE", doneAt: 200 }),
    ];
    const s = projectStats(p("all"), done, 300);
    expect(s.status).toBe("done");
    expect(s.completedAt).toBe(200);
    expect(s.share).toBe(1);
    expect(s.recent).toBe(true);
  });

  it("counts overdue open tasks and flags the project", () => {
    const tasks = [task("1", { projectId: "p", dueDate: "2000-01-01" })];
    const s = projectStats(p("all"), tasks);
    expect(s.overdueTasks).toBe(1);
    expect(s.health).toBe("atRisk");
  });

  it("is overdue once the target date has passed", () => {
    const tasks = [task("1", { projectId: "p" })];
    expect(projectStats(project("p", { targetDate: "2000-01-01" }), tasks).health).toBe("overdue");
  });
});
