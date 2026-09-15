import { useEffect, useRef, useState } from "react";
import type { Subtask } from "../lib/types";

function Grip({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" className={`text-[#C9C5BE] shrink-0 ${className}`} aria-hidden>
      {[3, 8, 13].map((cy) =>
        [3, 7].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill="currentColor" />)
      )}
    </svg>
  );
}

interface Props {
  items: Subtask[];
  onReorder: (items: Subtask[]) => void;
  onToggle: (id: string, done: boolean) => void;
  onText: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

// Pointer-based drag-to-reorder. The grabbed row lifts and follows the cursor,
// the rest reflow live as you move, and the target slot is highlighted.
export function SortableSubtasks({ items, onReorder, onToggle, onText, onDelete }: Props) {
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [pointerY, setPointerY] = useState(0);

  const orderRef = useRef(order);
  orderRef.current = order;
  const dragRef = useRef<{ id: string; grabOffset: number; left: number; width: number } | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const idsKey = items.map((i) => i.id).join("|");
  // Re-sync from props whenever the set/order of items changes — but never mid-drag.
  useEffect(() => {
    if (!dragRef.current) setOrder(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const byId: Record<string, Subtask> = {};
  for (const it of items) byId[it.id] = it;
  const ordered = order.map((id) => byId[id]).filter(Boolean) as Subtask[];

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPointerY(e.clientY);
    const without = orderRef.current.filter((id) => id !== d.id);
    let insert = without.length;
    for (let i = 0; i < without.length; i++) {
      const r = rowRefs.current[without[i]]?.getBoundingClientRect();
      if (r && e.clientY < r.top + r.height / 2) {
        insert = i;
        break;
      }
    }
    const next = [...without.slice(0, insert), d.id, ...without.slice(insert)];
    if (next.join("|") !== orderRef.current.join("|")) setOrder(next);
  };

  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const d = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    document.body.style.userSelect = "";
    if (d) {
      const cur = orderRef.current;
      const orig = itemsRef.current.map((i) => i.id);
      if (cur.join("|") !== orig.join("|")) {
        const map: Record<string, Subtask> = {};
        for (const it of itemsRef.current) map[it.id] = it;
        onReorder(cur.map((id) => map[id]).filter(Boolean) as Subtask[]);
      }
    }
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const row = rowRefs.current[id]?.getBoundingClientRect();
    const cont = containerRef.current?.getBoundingClientRect();
    dragRef.current = {
      id,
      grabOffset: row ? e.clientY - row.top : 12,
      left: cont?.left ?? 0,
      width: cont?.width ?? 0,
    };
    setDragId(id);
    setPointerY(e.clientY);
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const d = dragRef.current;
  const dragItem = dragId ? byId[dragId] : null;

  return (
    <div ref={containerRef} className="space-y-1 relative">
      {ordered.map((s) => {
        const isDragging = s.id === dragId;
        return (
          <div
            key={s.id}
            ref={(el) => {
              rowRefs.current[s.id] = el;
            }}
            className={`group flex items-center gap-1.5 rounded-md ${
              isDragging
                ? "border border-dashed border-[#C9A96E] bg-[#FBF6EC] opacity-70"
                : "border border-transparent"
            }`}
          >
            <span
              onPointerDown={(e) => startDrag(e, s.id)}
              title="↕"
              className="cursor-grab active:cursor-grabbing touch-none px-0.5 py-1"
              style={{ touchAction: "none" }}
            >
              <Grip />
            </span>
            <input
              type="checkbox"
              checked={s.done}
              onChange={(e) => onToggle(s.id, e.target.checked)}
              className="accent-[#C9A96E]"
            />
            <input
              defaultValue={s.text}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.text) onText(s.id, v);
              }}
              className={`flex-1 bg-transparent text-[12px] outline-none ${
                s.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"
              }`}
            />
            <button
              onClick={() => onDelete(s.id)}
              className="opacity-0 group-hover:opacity-100 text-[#DC2626] text-[12px]"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Floating clone that follows the cursor */}
      {dragItem && d && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: d.left, top: pointerY - d.grabOffset, width: d.width }}
        >
          <div className="flex items-center gap-1.5 rounded-md bg-white border border-[#C9A96E] shadow-lg px-0.5 py-0.5">
            <span className="px-0.5 py-1">
              <Grip />
            </span>
            <input type="checkbox" checked={dragItem.done} readOnly className="accent-[#C9A96E]" />
            <span className={`flex-1 text-[12px] ${dragItem.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"}`}>
              {dragItem.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
