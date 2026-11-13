import { createContext, useContext } from "react";
import type { Status } from "../lib/types";

export type MobileTab = "today" | "board" | "projects" | "agenda" | "more";

/** What any screen can ask the shell to open. */
export interface MobileNav {
  go: (tab: MobileTab) => void;
  openTask: (id: string) => void;
  moveTask: (id: string) => void;
  openProject: (id: string) => void;
  add: (opts?: { status?: Status; projectId?: string; dueDate?: string }) => void;
  openMe: () => void;
}

export const NavCtx = createContext<MobileNav | null>(null);

export function useNav(): MobileNav {
  const n = useContext(NavCtx);
  if (!n) throw new Error("useNav must be used within the mobile app");
  return n;
}
