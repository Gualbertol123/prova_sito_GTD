import { createContext, useContext } from "react";
import type { Project } from "./types";

// The board's projects, for components deep in the tree (task cards, the task
// editor) that would otherwise need them passed through every view.
interface ProjectsCtx {
  projects: Project[];
  /** Migration 015 is in: tasks can be linked to a project. */
  available: boolean;
}

const Ctx = createContext<ProjectsCtx>({ projects: [], available: false });

export const ProjectsProvider = Ctx.Provider;

export function useProjects(): ProjectsCtx {
  return useContext(Ctx);
}
