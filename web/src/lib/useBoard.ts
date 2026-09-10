import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Op } from "./types";
import { fetchBoard, seedIfEmpty, writeOp } from "./db";
import { applyOpLocal } from "./localReducer";
import { supabase } from "./supabaseClient";
import { isConfigured } from "./supabaseConfig";

export type ConnState = "connecting" | "online" | "reconnecting" | "offline";

export interface UseBoard {
  board: Board | null;
  conn: ConnState;
  error: string | null;
  send: (op: Op) => void;
  reload: () => void;
}

// Loads the board from Supabase, keeps it live via Postgres realtime, and
// dispatches optimistic ops. All state is in memory only.
export function useBoard(): UseBoard {
  const [board, setBoard] = useState<Board | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  const reload = useCallback(() => {
    fetchBoard()
      .then((b) => {
        setError(null);
        setBoard(b);
      })
      .catch((e: unknown) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setConn("offline");
      setError(
        "Supabase non è configurato: inserisci URL e anon key in supabaseConfig.ts (o nelle variabili VITE_SUPABASE_*)."
      );
      return;
    }

    let cancelled = false;

    // Initial load (seed on first run).
    (async () => {
      try {
        await seedIfEmpty();
        if (cancelled) return;
        reload();
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();

    // Debounced authoritative refresh on any realtime change.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reload(), 120);
    };

    const channel = supabase
      .channel("board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_meta" }, scheduleReload)
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setConn("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setConn("reconnecting");
        else if (status === "CLOSED") setConn("offline");
      });

    // Browser connectivity hints.
    const onOffline = () => setConn("reconnecting");
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const send = useCallback((op: Op) => {
    const current = boardRef.current;
    if (!current) return;
    // Optimistic apply for instant feedback.
    const optimistic = applyOpLocal(current, op);
    setBoard(optimistic);
    // Persist; realtime will reconcile to authoritative state.
    writeOp(op, current).catch((e: unknown) => {
      setError(errMsg(e));
      reload(); // undo the failed optimistic change
    });
  }, [reload]);

  return { board, conn, error, send, reload };
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
