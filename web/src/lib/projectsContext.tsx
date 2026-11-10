import { createContext, useContext } from "react";
import type { Project, Task } from "./types";

// The board's projects, for components deep in the tree (task cards, the task
// editor) that would otherwise need them passed through every view.
interface ProjectsCtx {
  projects: Project[];
  /** Every board task (to number the steps of sequential projects). */
  tasks: Task[];
  /** Migration 015 is in: tasks can be linked to a project. */
  available: boolean;
}

const Ctx = createContext<ProjectsCtx>({ projects: [], tasks: [], available: false });

export const ProjectsProvider = Ctx.Provider;

export function useProjects(): ProjectsCtx {
  return useContext(Ctx);
}
