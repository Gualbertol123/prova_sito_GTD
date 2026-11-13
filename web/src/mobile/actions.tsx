import { useCallback } from "react";
import type { Op, Status, Task } from "../lib/types";
import { STATUS_ORDER } from "../lib/constants";
import { useT } from "../lib/i18n";
import { Sheet, STATUS_VAR, useToast } from "./ui";
import { IconCheck } from "./icons";

export type Send = (op: Op, onError?: (message: string) => void) => void;

/**
 * The quick actions every task list offers. Each one says what it did in a
 * toast with an Undo, instead of asking "are you sure?" first.
 */
export function useTaskActions(send: Send) {
  const { t } = useT();
  const toast = useToast();
  const fail = useCallback((m: string) => toast(`${t("m.notSaved")} ${m}`), [toast, t]);

  const moveTo = useCallback(
    (task: Task, status: Status) => {
      if (task.status === status) return;
      const prev = task.status;
      send({ type: "moveTask", id: task.id, status }, fail);
      const text =
        status === "DONE"
          ? t("m.toast.done").replace("{title}", task.title)
          : t("m.toast.moved").replace("{status}", t(`m.status.${status}`));
      toast(text, () => send({ type: "moveTask", id: task.id, status: prev }, fail));
    },
    [send, toast, t, fail]
  );

  const toggleDone = useCallback(
    (task: Task) => moveTo(task, task.status === "DONE" ? "NEXT" : "DONE"),
    [moveTo]
  );

  const remove = useCallback(
    (task: Task) => {
      send({ type: "deleteTask", id: task.id }, fail);
      toast(t("m.toast.deleted"), () => send({ type: "addTask", task }, fail));
    },
    [send, toast, t, fail]
  );

  return { moveTo, toggleDone, remove, fail };
}

/** "Move to…": every column, the current one ticked. */
export function MoveSheet({ task, onPick, onClose }: { task: Task; onPick: (s: Status) => void; onClose: () => void }) {
  const { t } = useT();
  return (
    <Sheet title={t("m.moveTo")} onClose={onClose}>
      <div className="m-panel m-list">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            className="m-row"
            onClick={() => {
              onPick(s);
              onClose();
            }}
          >
            <span className="m-dot" style={{ background: STATUS_VAR[s], width: 10, height: 10 }} />
            <span className="m-row__main">
              <span className="m-row__title">{t(`m.status.${s}`)}</span>
              <span className="m-row__hint" style={{ display: "block" }}>
                {t(`m.statusHint.${s}`)}
              </span>
            </span>
            {task.status === s && (
              <span style={{ color: "var(--m-gold)" }}>
                <IconCheck size={20} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
