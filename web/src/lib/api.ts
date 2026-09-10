import { WebPubSubClient } from "@azure/web-pubsub-client";
import type { Board, Op } from "./types";

const API_BASE = "/api";

export type ConnState = "connecting" | "online" | "reconnecting" | "offline";

// Fetch the full authoritative board document.
export async function fetchBoard(): Promise<Board> {
  const res = await fetch(`${API_BASE}/board`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /board failed: ${res.status}`);
  return (await res.json()) as Board;
}

// Apply an operation. The server mutates the board authoritatively and
// returns the resulting document (also broadcast to every other client).
export async function sendOp(op: Op): Promise<Board> {
  const res = await fetch(`${API_BASE}/board`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`POST /board failed: ${res.status}`);
  return (await res.json()) as Board;
}

// Negotiate a Web PubSub client access URL (short-lived, per client).
async function negotiate(): Promise<string> {
  const res = await fetch(`${API_BASE}/negotiate`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /negotiate failed: ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

export interface RealtimeHandlers {
  onState: (board: Board) => void;
  onConn: (state: ConnState) => void;
  // Called after a (re)connection so the caller can re-sync missed changes.
  onResync: () => void;
}

// Connect to Azure Web PubSub and stream board-state broadcasts.
// Returns a disposer. Auto-reconnects on drop.
export function connectRealtime(h: RealtimeHandlers): () => void {
  let disposed = false;
  let client: WebPubSubClient | null = null;

  (async () => {
    try {
      h.onConn("connecting");
      client = new WebPubSubClient({
        getClientAccessUrl: async () => negotiate(),
      });

      client.on("connected", () => {
        if (disposed) return;
        h.onConn("online");
        h.onResync();
      });
      client.on("disconnected", () => {
        if (disposed) return;
        h.onConn("reconnecting");
      });
      client.on("stopped", () => {
        if (disposed) return;
        h.onConn("offline");
      });
      client.on("server-message", (e) => {
        if (disposed) return;
        const data = e.message.data as unknown;
        try {
          const parsed =
            typeof data === "string" ? JSON.parse(data) : (data as { type?: string; board?: Board });
          if (parsed && parsed.type === "state" && parsed.board) {
            h.onState(parsed.board as Board);
          }
        } catch {
          /* ignore malformed frame */
        }
      });

      await client.start();
    } catch {
      if (!disposed) h.onConn("offline");
    }
  })();

  return () => {
    disposed = true;
    try {
      client?.stop();
    } catch {
      /* noop */
    }
  };
}
