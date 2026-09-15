import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Subtask } from "../lib/types";
import { useSyncedField } from "../lib/useSyncedField";
import { AutoTextarea } from "./AutoTextarea";

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" className="text-[#C9C5BE] shrink-0" aria-hidden>
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

// Pointer-based drag-to-reorder styled like a small kanban column: each subtask
// is a white card that grows with its text. The grabbed card lifts and follows
// the cursor; the others slide (FLIP-animated) to their new positions; the
// target slot is highlighted.
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
  const prevTops = useRef<Record<string, number>>({});

  const idsKey = items.map((i) => i.id).join("|");
  useEffect(() => {
    if (!dragRef.current) setOrder(items.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const byId: Record<string, Subtask> = {};
  for (const it of items) byId[it.id] = it;
  const ordered = order.map((id) => byId[id]).filter(Boolean) as Subtask[];

  // FLIP: animate rows sliding to their new positions — only when the ORDER
  // changes (not on every pointer move), measuring with transforms cleared so
  // in-flight animations don't corrupt the positions.
  const orderKey = order.join("|");
  useLayoutEffect(() => {
    const tops: Record<string, number> = {};
    for (const id of order) {
      const el = rowRefs.current[id];
      if (!el) continue;
      el.style.transition = "none";
      el.style.transform = "";
    }
    for (const id of order) {
      const el = rowRefs.current[id];
      if (el) tops[id] = el.getBoundingClientRect().top;
    }
    for (const id of order) {
      if (id === dragId) continue;
      const el = rowRefs.current[id];
      if (!el) continue;
      const prev = prevTops.current[id];
      const cur = tops[id];
      if (prev != null && cur != null && Math.abs(prev - cur) > 0.5) {
        el.style.transform = `translateY(${prev - cur}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 260ms cubic-bezier(0.2,0.7,0.2,1)";
          el.style.transform = "";
        });
      }
    }
    prevTops.current = tops;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPointerY(e.clientY);
    const cont = containerRef.current;
    if (!cont) return;
    // Use layout coordinates (offsetTop/offsetHeight) — immune to the in-flight
    // animation transforms — so hit-testing never fights the animation.
    const y = e.clientY - cont.getBoundingClientRect().top;
    const without = orderRef.current.filter((id) => id !== d.id);
    let insert = without.length;
    for (let i = 0; i < without.length; i++) {
      const el = rowRefs.current[without[i]];
      if (!el) continue;
      if (y < el.offsetTop + el.offsetHeight / 2) {
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
    const el = rowRefs.current[id];
    const row = el?.getBoundingClientRect();
    const cont = containerRef.current?.getBoundingClientRect();
    if (el) {
      el.style.transition = "none";
      el.style.transform = "";
    }
    dragRef.current = {
      id,
      grabOffset: row ? e.clientY - row.top : 16,
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
    <div ref={containerRef} className="space-y-1.5 relative">
      {ordered.map((s) => (
        <SubtaskRow
          key={s.id}
          s={s}
          isDragging={s.id === dragId}
          registerRef={(el) => {
            rowRefs.current[s.id] = el;
          }}
          onGrip={(e) => startDrag(e, s.id)}
          onToggle={(done) => onToggle(s.id, done)}
          onText={(text) => onText(s.id, text)}
          onDelete={() => onDelete(s.id)}
        />
      ))}

      {/* Floating card that follows the cursor */}
      {dragItem && d && (
        <div className="fixed z-50 pointer-events-none" style={{ left: d.left, top: pointerY - d.grabOffset, width: d.width }}>
          <div className="flex items-start gap-1.5 rounded-[10px] bg-white border border-[#C9A96E] shadow-xl p-2 rotate-[-1deg]">
            <span className="pt-0.5"><Grip /></span>
            <input type="checkbox" checked={dragItem.done} readOnly className="mt-0.5 accent-[#C9A96E]" />
            <span className={`flex-1 text-[12px] leading-snug text-center ${dragItem.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"}`}>
              {dragItem.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SubtaskRow({
  s,
  isDragging,
  registerRef,
  onGrip,
  onToggle,
  onText,
  onDelete,
}: {
  s: Subtask;
  isDragging: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onGrip: (e: React.PointerEvent) => void;
  onToggle: (done: boolean) => void;
  onText: (text: string) => void;
  onDelete: () => void;
}) {
  const field = useSyncedField(s.text);
  return (
    <div
      ref={registerRef}
      className={`group flex items-start gap-1.5 rounded-[10px] bg-white p-2 border shadow-sm ${
        isDragging ? "border-dashed border-[#C9A96E] ring-2 ring-[#C9A96E]/30 opacity-60" : "border-[#E8E6E1]"
      }`}
    >
      <span
        onPointerDown={onGrip}
        title="↕"
        className="cursor-grab active:cursor-grabbing pt-1 px-0.5"
        style={{ touchAction: "none" }}
      >
        <Grip />
      </span>
      <input
        type="checkbox"
        checked={s.done}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-1 accent-[#C9A96E]"
      />
      <AutoTextarea
        value={field.value}
        onFocus={field.onFocus}
        onChange={(e) => field.setValue(e.target.value)}
        onBlur={() => {
          field.onBlur();
          if (field.value.trim() && field.value !== s.text) onText(field.value.trim());
        }}
        className={`flex-1 bg-transparent text-[12px] leading-snug text-center outline-none ${
          s.done ? "line-through text-[#A8A29E]" : "text-[#0A1931]"
        }`}
      />
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-[#DC2626] text-[12px] mt-0.5 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
