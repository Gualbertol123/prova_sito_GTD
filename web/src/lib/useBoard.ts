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

// How often to re-pull the whole board as a safety net, in case a realtime
// event is ever missed (dropped socket, sleeping laptop, etc). Realtime is the
// primary path; this just guarantees convergence.
const POLL_MS = 12000;

// Loads the board from Supabase, keeps it live via Postgres realtime, and
// dispatches optimistic ops. All board state is in memory only.
export function useBoard(): UseBoard {
  const [board, setBoard] = useState<Board | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;

  // Guard against overlapping/stale reloads clobbering newer state.
  const loadSeq = useRef(0);

  const reload = useCallback(() => {
    const seq = ++loadSeq.current;
    fetchBoard()
      .then((b) => {
        if (seq !== loadSeq.current) return; // a newer reload already won
        setError(null);
        setBoard(b);
      })
      .catch((e: unknown) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setConn("offline");
      setError(
        "Supabase non è configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (o supabaseConfig.ts)."
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await seedIfEmpty();
        if (!cancelled) reload();
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();

    // Debounced authoritative refresh on any realtime change.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reload(), 80);
    };

    const channel = supabase
      .channel("board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_meta" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reflections" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, scheduleReload)
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConn("online");
          reload(); // pull anything changed while (re)subscribing
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConn("reconnecting");
        } else if (status === "CLOSED") {
          setConn("reconnecting");
        }
      });

    // Safety-net poll so clients always converge even if an event is missed.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);

    // Re-sync when the tab regains focus or the network comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const onOnline = () => {
      setConn("reconnecting");
      reload();
    };
    const onOffline = () => setConn("reconnecting");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const send = useCallback(
    (op: Op) => {
      const current = boardRef.current;
      if (!current) return;
      // Optimistic apply for instant feedback.
      setBoard(applyOpLocal(current, op));
      // Persist; realtime + poll reconcile to authoritative state.
      writeOp(op, current).catch((e: unknown) => {
        setError(errMsg(e));
        reload(); // undo a failed optimistic change
      });
    },
    [reload]
  );

  return { board, conn, error, send, reload };
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
}
