import { useState } from "react";
import type { Board, Op, Status, Task } from "../lib/types";
import { STATUS_HELP, STATUS_LABEL, STATUS_ORDER, genId } from "../lib/constants";
import { TaskCard } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { MembersBar } from "./MembersBar";
import { PriorityDistribution } from "./PriorityDistribution";

interface Props {
  board: Board;
  tasks: Task[]; // already filtered + sorted
  members: string[];
  send: (op: Op) => void;
}

export function BoardView({ board, tasks, members, send }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [quick, setQuick] = useState("");

  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const quickAdd = (status: Status = "NEXT") => {
    const title = quick.trim();
    if (!title) return;
    const task: Task = {
      id: genId(),
      title,
      desc: "",
      owner: "Unassigned",
      priority: "P3",
      status,
      notes: "",
      subtasks: [],
      updatedAt: Date.now(),
    };
    send({ type: "addTask", task });
    setQuick("");
  };

  const drop = (status: Status) => {
    if (dragId) send({ type: "moveTask", id: dragId, status });
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="space-y-4">
      {/* Help */}
      <div className="text-[12px] text-[#6B6B6B]">
        <span className="font-semibold text-[#0A1931]">Board:</span> trascina le
        card tra le colonne o aprile per modificare owner, priorità, scadenza e
        sotto-attività.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MembersBar board={board} send={send} />
        </div>
        <PriorityDistribution tasks={board.tasks} />
      </div>

      {/* Quick add */}
      <div className="flex gap-2">
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickAdd("NEXT")}
          placeholder="Nuova attività rapida…"
          className="flex-1 h-11 rounded-full bg-white border border-[#E8E6E1] px-5 text-[14px] outline-none focus:border-[#C9A96E]"
        />
        <button
          onClick={() => quickAdd("NEXT")}
          className="h-11 px-6 rounded-full bg-[#0A1931] text-[#C9A96E] text-[13px] font-semibold hover:bg-[#112040]"
        >
          + Crea task
        </button>
      </div>

      {/* Columns */}
      <div className="overflow-x-auto thin-scroll pb-2">
        <div className="flex gap-3 min-w-max">
          {STATUS_ORDER.map((status) => {
            const colTasks = tasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(status);
                }}
                onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                onDrop={() => drop(status)}
                className={`w-[280px] shrink-0 rounded-[14px] bg-[#EFECE6] p-2 ${
                  overCol === status ? "drop-target" : ""
                }`}
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <div>
                    <div className="font-trajan text-[12px] uppercase tracking-wide text-[#0A1931]">
                      {STATUS_LABEL[status]}
                    </div>
                    <div className="text-[10px] text-[#8A8A8A]">
                      {STATUS_HELP[status]}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#8A8A8A] bg-white rounded-full px-2 py-0.5 border border-[#E8E6E1]">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[40px]">
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onOpen={() => setOpenId(t.id)}
                      onDragStart={(e) => {
                        setDragId(t.id);
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                        (e.currentTarget as HTMLElement).classList.add("dragging");
                      }}
                      onDragEnd={(e) => {
                        (e.currentTarget as HTMLElement).classList.remove(
                          "dragging"
                        );
                        setDragId(null);
                      }}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-[11px] text-[#A8A29E] text-center py-4">
                      {status === "DONE" ? "Nessuna attività in DONE" : "Nessuna attività"}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const title = prompt(`Nuovo task per ${STATUS_LABEL[status]}?`)?.trim();
                    if (!title) return;
                    send({
                      type: "addTask",
                      task: {
                        id: genId(),
                        title,
                        desc: "",
                        owner: "Unassigned",
                        priority: "P3",
                        status,
                        notes: "",
                        subtasks: [],
                        updatedAt: Date.now(),
                      },
                    });
                  }}
                  className="w-full mt-2 h-8 rounded-lg border border-dashed border-[#D8D3CA] text-[11px] text-[#8A8A8A] hover:border-[#C9A96E] hover:text-[#8B6F3E]"
                >
                  + Nuovo task
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {openTask && (
        <TaskDetail
          task={openTask}
          members={members}
          send={send}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
