// -----------------------------------------------------------------------------
// Who a task belongs to.
//
// A task used to have exactly one `owner`. It can now be shared between several
// people, held in `assignees`. `owner` is kept as the first name in that list so
// every older read path — and every row written before migration 009 — still
// means what it always did.
//
// Nothing outside this file should compare `task.owner` directly: a task shared
// between two people would answer "no" for the second one. Go through
// taskOwners() / isOwnedBy() instead.
// -----------------------------------------------------------------------------

import { UNASSIGNED } from "./constants";
import type { Task } from "./types";

/** Everyone a task is assigned to. Never empty — falls back to Unassigned. */
export function taskOwners(task: Pick<Task, "owner" | "assignees">): string[] {
  const list = task.assignees?.filter((name) => name.trim().length > 0) ?? [];
  if (list.length) return list;
  return [task.owner || UNASSIGNED];
}

/** True when `member` is one of the people a task is assigned to. */
export function isOwnedBy(task: Pick<Task, "owner" | "assignees">, member: string): boolean {
  return taskOwners(task).includes(member);
}

/** True when more than one person holds the task. */
export function isShared(task: Pick<Task, "owner" | "assignees">): boolean {
  return taskOwners(task).length > 1;
}

/**
 * The fields to patch so a task is held by exactly `list`. Both fields move
 * together: `owner` is the first name, which is what keeps single-assignee
 * consumers and pre-migration rows honest.
 */
export function ownersPatch(list: string[]): Pick<Task, "owner" | "assignees"> {
  const clean = list.map((name) => name.trim()).filter(Boolean);
  const unique = clean.filter((name, i) => clean.indexOf(name) === i);
  // Unassigned is a statement that nobody holds it, so it never shares.
  const final = unique.filter((name) => name !== UNASSIGNED);
  if (final.length === 0) return { owner: UNASSIGNED, assignees: [UNASSIGNED] };
  return { owner: final[0], assignees: final };
}

/** Drop a member from a task, falling back to Unassigned if they were the last. */
export function withoutOwner(
  task: Pick<Task, "owner" | "assignees">,
  member: string
): Pick<Task, "owner" | "assignees"> {
  return ownersPatch(taskOwners(task).filter((name) => name !== member));
}

/** "Anna" · "Anna, Bruno" · "Anna, Bruno +2" — for one line of text. */
export function ownersLabel(
  task: Pick<Task, "owner" | "assignees">,
  translate: (name: string) => string,
  max = 2
): string {
  const names = taskOwners(task).map(translate);
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
}

/** First letter of each name, for the little avatar circles. */
export function ownerInitial(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}
