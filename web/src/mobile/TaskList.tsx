import type { Task } from "../lib/types";
import { TaskCard } from "./TaskCard";
import { useNav } from "./nav";
import { useTaskActions, type Send } from "./actions";

/** A column of task cards wired to the shell's open / move actions. */
export function TaskList({
  tasks,
  send,
  showStatus,
  swipe = true,
}: {
  tasks: Task[];
  send: Send;
  showStatus?: boolean;
  /** Card swipe actions; off on the Board, where sideways swipes change column. */
  swipe?: boolean;
}) {
  const nav = useNav();
  const { toggleDone } = useTaskActions(send);
  return (
    <div className="m-stack">
      {tasks.map((tk) => (
        <TaskCard
          key={tk.id}
          task={tk}
          showStatus={showStatus}
          swipe={swipe}
          onOpen={() => nav.openTask(tk.id)}
          onToggleDone={() => toggleDone(tk)}
          onMove={() => nav.moveTask(tk.id)}
        />
      ))}
    </div>
  );
}
