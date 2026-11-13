import type { Board, Project, Task } from "../types";

export function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    desc: "",
    owner: "Anna",
    priority: "P2",
    status: "NEXT",
    notes: "",
    subtasks: [],
    updatedAt: 1,
    createdAt: 1,
    ...over,
  };
}

export function project(id: string, over: Partial<Project> = {}): Project {
  return { id, name: `Project ${id}`, items: [], ...over };
}

export function board(over: Partial<Board> = {}): Board {
  return {
    id: "board",
    boardName: "Test",
    members: ["Anna", "Marco"],
    tasks: [],
    weekly: { well: [], learnings: [], improve: [], blockers: [], focus: [] },
    reflections: [],
    projects: [],
    personalNotes: [],
    updatedAt: 0,
    ...over,
  };
}
