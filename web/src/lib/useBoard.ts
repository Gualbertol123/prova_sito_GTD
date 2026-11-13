import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Op } from "./types";
import { fetchBoard, fetchChange, seedIfEmpty, writeOp, type ChangedTable } from "./db";
import { applyRowChange, type RowChange } from "./rowSync";
import { applyOpLocal } from "./localReducer";
import { supabase } from "./supabaseClient";
import { isConfigured } from "./supabaseConfig";
import { requestAuthCheck } from "./auth";

export type ConnState = "connecting" | "online" | "reconnecting" | "offline";

export interface UseBoard {
  board: Board | null;
  conn: ConnState;
  error: string | null;
  /** onError fires when the write is rejected, after the optimistic change is rolled back. */
  send: (op: Op, onError?: (message: string) => void) => void;
  reload: () => void;
}

// How often to re-pull the whole board as a safety net, in case a realtime
// event is ever missed (dropped socket, sleeping laptop, etc). Realtime is the
// primary path — and it now moves one row at a time — so this can be slow.
const POLL_MS = 30000;

// More changed rows than this in one burst (e.g. clearing the weekly review)
// and one full reload is cheaper than re-reading each row.
const MAX_ROW_FETCHES = 20;

const TABLES: ChangedTable[] = ["tasks", "weekly", "board_meta", "reflections", "projects", "personal_notes"];
// Tables re-read whole on any change (small, or one row): no id needed.
const WHOLE: ReadonlySet<ChangedTable> = new Set(["reflections", "personal_notes", "board_meta"]);

// Marks a reload skipped for lack of a session (not an error to show).
const SKIP = Symbol("no-session");

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
    // No live session (e.g. its refresh was refused after a password reset):
    // do not query with the bare public key — hand over to the login gate.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!data.session) {
          requestAuthCheck();
          throw SKIP;
        }
        return fetchBoard();
      })
      .then((b) => {
        if (seq !== loadSeq.current) return; // a newer reload already won
        setError(null);
        setBoard(b);
      })
      .catch((e: unknown) => {
        if (e === SKIP) return;
        setError(errMsg(e));
        requestAuthCheck(); // a refused read may mean the login has ended
      });
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
        // Seed only with a live session (never with the bare public key).
        const { data } = await supabase.auth.getSession();
        if (data.session) await seedIfEmpty();
        if (!cancelled) reload();
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();

    // Realtime: collect the changed rows for a moment, then re-read only those
    // rows and fold them in. A deleted row needs no read at all.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Map<string, { table: ChangedTable; id?: string }>();
    const deleted: RowChange[] = [];

    const flush = async () => {
      timer = null;
      const jobs = [...pending.values()];
      const gone = deleted.splice(0);
      pending.clear();
      if (!boardRef.current || jobs.length > MAX_ROW_FETCHES) {
        reload();
        return;
      }
      let changes: RowChange[];
      try {
        changes = [...gone, ...(await Promise.all(jobs.map((j) => fetchChange(j.table, j.id))))];
      } catch {
        reload(); // a refused or failed read: fall back to the full path
        return;
      }
      if (cancelled || changes.length === 0) return;
      // These rows are newer than any full reload already in flight.
      ++loadSeq.current;
      setBoard((prev) => (prev ? changes.reduce(applyRowChange, prev) : prev));
    };

    const onChange = (table: ChangedTable) => (payload: { eventType: string; new: unknown; old: unknown }) => {
      const id =
        ((payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id) || undefined;
      if (WHOLE.has(table)) {
        pending.set(table, { table });
      } else if (!id) {
        reload(); // cannot tell which row: take the full path
        return;
      } else if (payload.eventType === "DELETE") {
        pending.delete(`${table}:${id}`);
        deleted.push({ table, id, row: null } as RowChange);
      } else {
        pending.set(`${table}:${id}`, { table, id });
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 80);
    };

    let channel = supabase.channel("board-realtime");
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange(table));
    }
    channel.subscribe((status) => {
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
    (op: Op, onError?: (message: string) => void) => {
      const current = boardRef.current;
      if (!current) return;
      // Optimistic apply for instant feedback.
      setBoard(applyOpLocal(current, op));
      // Persist; realtime + poll reconcile to authoritative state.
      writeOp(op, current).catch((e: unknown) => {
        const message = errMsg(e);
        setError(message);
        // The banner at the top of the page is easy to miss, so let the caller
        // tell the person right where they acted that it did not save.
        onError?.(message);
        requestAuthCheck();
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
