import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, Op } from "./types";
import { applyOp } from "./reducer";
import { connectRealtime, fetchBoard, sendOp, type ConnState } from "./api";

export interface UseBoard {
  board: Board | null;
  conn: ConnState;
  error: string | null;
  send: (op: Op) => void;
  reload: () => void;
}

// Central hook: loads the board, subscribes to realtime broadcasts, and
// exposes an optimistic `send`. All state lives in memory only — nothing is
// ever written to localStorage / sessionStorage / IndexedDB.
export function useBoard(): UseBoard {
  const [board, setBoard] = useState<Board | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Keep the latest board in a ref so realtime callbacks can compare revs
  // without re-subscribing.
  const revRef = useRef<number>(-1);

  const applyRemote = useCallback((incoming: Board) => {
    // Only accept a newer (or equal-newer) revision to avoid flicker from
    // out-of-order frames.
    if (incoming.rev >= revRef.current) {
      revRef.current = incoming.rev;
      setBoard(incoming);
    }
  }, []);

  const reload = useCallback(() => {
    fetchBoard()
      .then((b) => {
        setError(null);
        applyRemote(b);
      })
      .catch((e: unknown) => setError(String((e as Error).message ?? e)));
  }, [applyRemote]);

  useEffect(() => {
    reload();
    const dispose = connectRealtime({
      onState: applyRemote,
      onConn: setConn,
      onResync: reload,
    });
    return dispose;
  }, [reload, applyRemote]);

  const send = useCallback(
    (op: Op) => {
      // Optimistic local apply for instant feedback.
      setBoard((prev) => {
        if (!prev) return prev;
        const next = applyOp(prev, op);
        revRef.current = next.rev;
        return next;
      });
      // Persist + broadcast. The authoritative result replaces local state.
      sendOp(op)
        .then((b) => {
          setError(null);
          applyRemote(b);
        })
        .catch((e: unknown) => {
          setError(String((e as Error).message ?? e));
          // Re-sync from the server to undo a failed optimistic change.
          reload();
        });
    },
    [applyRemote, reload]
  );

  return { board, conn, error, send, reload };
}
